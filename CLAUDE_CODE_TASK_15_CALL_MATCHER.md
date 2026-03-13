# CLAUDE CODE TASK 15 — AI Sales Assistant Phase 2: Call Matcher

> Read this ENTIRE document before making changes.
> Also read PROJECT_BRIEF.md for schema context.
> Phase 1 (Task 14) must be deployed first — it creates the sync_state table and enhanced action_items columns.

---

## CRITICAL SCHEMA NOTES

### CTM API (already working — see Task 10/11)
- Account ID env var pattern: `CTM_{NUM}_ACCOUNT_ID` where NUM = number from location_number (e.g., JUNGLE-101 → CTM_101_ACCOUNT_ID)
- Auth: Basic auth with `access_key:secret_key` base64 encoded
- Endpoint: `GET https://api.calltrackingmetrics.com/api/v1/accounts/{account_id}/calls.json`
- Pagination: `?page=1&per_page=100`
- Existing sync route at `/api/sync/ctm` syncs the full daily batch into `call_tracking_records`

### Existing tables:
- `call_tracking_records`: location_id, external_id, caller_number, tracking_number, call_start, duration_seconds, call_type (answered/missed/voicemail), direction (inbound/outbound), activity_type (call/text/chat), recording_url, caller_city, caller_state, talk_time_seconds
- `leads`: id, location_id, first_name, last_name, phone, email, source, stage_id, is_archived, converted_at, follow_up_date, follow_up_type, last_contact_at, last_contact_type
- `sync_state`: location_id, sync_type, last_sync_at, last_record_id, metadata (UNIQUE on location_id + sync_type)
- `action_items`: now has action_type, lead_id, call_record_id, ai_suggestion, source_engine, overdue_days

### Omaha CTM credentials (in env):
```
CTM_101_ACCOUNT_ID=551391
CTM_101_ACCESS_KEY=a551391db02965326fd7fe83c0a05c0750c98dc2
CTM_101_SECRET_KEY=e70214ee291cc48e538e0dfaad3c57df5815
```

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## OVERVIEW

**What we're building:**

An hourly cron job that:
1. Fetches new CTM calls since the last sync
2. Matches each caller's phone number against existing leads (and students)
3. Creates action items based on the match + call type
4. Auto-creates new leads from unknown callers who left voicemails or were missed
5. Updates `last_contact_at` on leads that received answered calls

**Cron schedule:** Every hour during business hours (8 AM - 6 PM CT, Mon-Fri)
- UTC: `0 13-23 * * 1-5`

---

## PART 1: CRON ENDPOINT — `/api/cron/call-matcher/route.ts`

### High-Level Flow

```
1. Scan env vars for CTM_*_ACCOUNT_ID → build list of configured locations
2. For each location:
   a. Read sync_state (sync_type = 'ctm_call_matcher') → get last_sync_at
   b. Fetch CTM calls where call_start > last_sync_at AND activity_type = 'call'
   c. For each call:
      i.   Skip if activity_type is not 'call' (ignore texts, chats)
      ii.  Normalize caller phone number
      iii. Match against leads.phone for this location
      iv.  Match against students.phone if no lead match (optional)
      v.   Based on match + call details → create action item
      vi.  If answered + matched lead → update lead.last_contact_at
   d. Update sync_state.last_sync_at to now
3. Return summary
```

### Phone Number Normalization

```typescript
function normalizePhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')
  // If 11 digits starting with 1, strip the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  // If 10 digits, return as-is
  if (digits.length === 10) {
    return digits
  }
  // Return whatever we have (may not match, that's OK)
  return digits
}
```

### Phone Matching Logic

```typescript
async function matchCaller(supabase, locationId: string, callerNumber: string) {
  const normalized = normalizePhone(callerNumber)
  if (normalized.length < 10) return { type: 'unknown', match: null }

  // Try exact match on leads (normalize both sides)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, email, source, stage_id, is_archived')
    .eq('location_id', locationId)
    .eq('is_archived', false)

  // Normalize and compare
  const matchedLead = (leads || []).find(l => 
    l.phone && normalizePhone(l.phone) === normalized
  )

  if (matchedLead) {
    return { type: 'lead', match: matchedLead }
  }

  // Try students
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, status')
    .eq('location_id', locationId)

  const matchedStudent = (students || []).find(s =>
    s.phone && normalizePhone(s.phone) === normalized
  )

  if (matchedStudent) {
    return { type: 'student', match: matchedStudent }
  }

  return { type: 'unknown', match: null }
}
```

### Action Item Generation Rules

For each call, based on match type + call type:

```
INBOUND + MISSED + KNOWN LEAD:
  → action_type: 'call_back'
  → title: "Call back {lead_name} — missed call at {time}"
  → description: "{source} lead, stage: {stage}. Called from {number}."
  → priority: 'high'
  → lead_id: matched lead ID
  → ai_suggestion: "They called you — this is a hot lead. Call back ASAP."

INBOUND + MISSED + KNOWN STUDENT:
  → action_type: 'call_back'
  → title: "Call back {student_name} (existing student) — missed at {time}"
  → description: "Current student, may need to reschedule or has a question."
  → priority: 'medium'
  → No lead_id (student, not lead)

INBOUND + MISSED + UNKNOWN:
  → action_type: 'create_lead'
  → title: "Missed call from {number} — potential new lead"
  → description: "Unknown caller from {city}, {state}. No match in system."
  → priority: 'medium'
  → ai_suggestion: "Unknown missed caller — consider calling back and creating a lead if interested."
  → data_context: { caller_number, caller_city, caller_state }

INBOUND + VOICEMAIL + ANY:
  → Same as MISSED but with:
  → title includes "left voicemail"
  → priority bumped to 'high' (they made effort to leave a message)
  → data_context includes recording_url if available

INBOUND + ANSWERED + KNOWN LEAD:
  → NO action item created (call was handled)
  → Instead: UPDATE lead.last_contact_at = call_start, last_contact_type = 'call_inbound'
  → Log activity on lead

INBOUND + ANSWERED + UNKNOWN:
  → action_type: 'create_lead'
  → title: "New caller from {number} — answered call, {duration}s"
  → description: "Caller not in system. If interested, create a lead."
  → priority: 'low'
  → Only create if call duration > 60 seconds (real conversation, not wrong number)

OUTBOUND + ANSWERED + KNOWN LEAD:
  → NO action item
  → UPDATE lead.last_contact_at = call_start, last_contact_type = 'call_outbound'

OUTBOUND + ANY + ANY:
  → No action items for outbound calls (the GM already made the call)
  → But DO update lead.last_contact_at if matched
```

### Deduplication

Before creating an action item, check if one already exists for the same call:
```typescript
// Check by call_record_id to avoid duplicates on re-runs
const { data: existing } = await supabase
  .from('action_items')
  .select('id')
  .eq('call_record_id', callRecord.id)
  .limit(1)

if (existing && existing.length > 0) {
  // Already processed this call, skip
  continue
}
```

Also check: don't create a "call back" action if the lead already has an open call_back action item.

---

## PART 2: SYNC STATE MANAGEMENT

### Initialize on first run:

```typescript
// Upsert sync_state for this location
const { data: syncState } = await supabase
  .from('sync_state')
  .select('*')
  .eq('location_id', locationId)
  .eq('sync_type', 'ctm_call_matcher')
  .single()

let lastSyncAt: string
if (syncState) {
  lastSyncAt = syncState.last_sync_at
} else {
  // First run: start from 2 hours ago (don't process entire history)
  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)
  lastSyncAt = twoHoursAgo.toISOString()
}
```

### After processing:

```typescript
await supabase
  .from('sync_state')
  .upsert({
    location_id: locationId,
    sync_type: 'ctm_call_matcher',
    last_sync_at: new Date().toISOString(),
    metadata: { calls_processed: processedCount, actions_created: actionsCreated },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'location_id,sync_type' })
```

---

## PART 3: FETCHING CALLS FROM CTM

**Reuse the existing CTM fetch logic** from `/api/sync/ctm/route.ts`. Extract the CTM API call into a shared utility:

### Create: `src/lib/ctm/client.ts`

```typescript
interface CTMCredentials {
  accountId: string
  accessKey: string
  secretKey: string
}

interface CTMCall {
  id: number
  caller_number_format: string
  tracking_number_format: string
  start_time: string  // ISO timestamp
  duration: number
  talk_time: number
  call_status: string  // answered, missed, voicemail
  direction: string    // inbound, outbound
  call_type: string    // could be 'call', 'text', etc.
  recording_url?: string
  city?: string
  state?: string
  // ... other fields
}

export function getCTMCredentials(locationNumber: string): CTMCredentials | null {
  // Extract number: "JUNGLE-101" → "101"
  const num = locationNumber.replace(/\D/g, '').replace(/^0+/, '')
  const accountId = process.env[`CTM_${num}_ACCOUNT_ID`]
  const accessKey = process.env[`CTM_${num}_ACCESS_KEY`]
  const secretKey = process.env[`CTM_${num}_SECRET_KEY`]
  
  if (!accountId || !accessKey || !secretKey) return null
  return { accountId, accessKey, secretKey }
}

export async function fetchCTMCalls(
  creds: CTMCredentials,
  since: string,  // ISO timestamp
  options?: { maxPages?: number }
): Promise<CTMCall[]> {
  const authToken = Buffer.from(`${creds.accessKey}:${creds.secretKey}`).toString('base64')
  const allCalls: CTMCall[] = []
  const maxPages = options?.maxPages || 5
  
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.calltrackingmetrics.com/api/v1/accounts/${creds.accountId}/calls.json?page=${page}&per_page=100&start_date=${encodeURIComponent(since)}&sort_by=start_time&sort_order=asc`
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${authToken}` },
    })
    
    if (!response.ok) {
      console.error(`CTM API error: ${response.status}`)
      break
    }
    
    const data = await response.json()
    const calls = data.calls || []
    allCalls.push(...calls)
    
    // If fewer than 100 returned, we've reached the end
    if (calls.length < 100) break
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return allCalls
}
```

---

## PART 4: THE MAIN CRON HANDLER

### `/api/cron/call-matcher/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCTMCredentials, fetchCTMCalls } from '@/lib/ctm/client'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const results: any[] = []

  // Get all locations with CTM configured
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, location_number')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  for (const location of (locations || [])) {
    const creds = getCTMCredentials(location.location_number)
    if (!creds) continue  // No CTM configured for this location

    try {
      // Get last sync time
      const { data: syncState } = await supabase
        .from('sync_state')
        .select('*')
        .eq('location_id', location.id)
        .eq('sync_type', 'ctm_call_matcher')
        .maybeSingle()

      const lastSyncAt = syncState?.last_sync_at || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

      // Fetch new calls from CTM
      const ctmCalls = await fetchCTMCalls(creds, lastSyncAt, { maxPages: 3 })

      let actionsCreated = 0
      let leadsUpdated = 0

      for (const ctmCall of ctmCalls) {
        // Only process actual calls, not texts/chats
        const activityType = detectActivityType(ctmCall)
        if (activityType !== 'call') continue

        const callerNumber = ctmCall.caller_number_format || ''
        const direction = ctmCall.direction || 'inbound'
        const callType = ctmCall.call_status || 'unknown' // answered, missed, voicemail
        const callStart = ctmCall.start_time
        const duration = ctmCall.duration || 0
        const talkTime = ctmCall.talk_time || 0
        const recordingUrl = ctmCall.recording_url || null
        const callerCity = ctmCall.city || null
        const callerState = ctmCall.state || null

        // First, ensure this call is in call_tracking_records (may already exist from daily sync)
        const externalId = String(ctmCall.id)
        let callRecordId: string | null = null

        const { data: existingRecord } = await supabase
          .from('call_tracking_records')
          .select('id')
          .eq('external_id', externalId)
          .maybeSingle()

        if (existingRecord) {
          callRecordId = existingRecord.id
        } else {
          // Insert the call record
          const { data: newRecord } = await supabase
            .from('call_tracking_records')
            .insert({
              location_id: location.id,
              external_id: externalId,
              caller_number: callerNumber,
              tracking_number: ctmCall.tracking_number_format || '',
              call_start: callStart,
              duration_seconds: duration,
              talk_time_seconds: talkTime,
              call_type: callType,
              direction,
              activity_type: 'call',
              recording_url: recordingUrl,
              caller_city: callerCity,
              caller_state: callerState,
            })
            .select('id')
            .single()
          callRecordId = newRecord?.id || null
        }

        // Skip outbound calls for action items (GM already made the call)
        // But still update lead contact if matched
        const match = await matchCaller(supabase, location.id, callerNumber)

        if (direction === 'outbound') {
          if (match.type === 'lead' && match.match) {
            await updateLeadContact(supabase, match.match.id, callStart, 'call_outbound')
            leadsUpdated++
          }
          continue
        }

        // INBOUND calls — create action items
        if (callType === 'answered') {
          if (match.type === 'lead' && match.match) {
            // Answered call from known lead — just update contact
            await updateLeadContact(supabase, match.match.id, callStart, 'call_inbound')
            leadsUpdated++
          } else if (match.type === 'unknown' && duration > 60) {
            // Long answered call from unknown — suggest creating lead
            const created = await createActionItem(supabase, {
              organization_id: ORG_ID,
              location_id: location.id,
              action_type: 'create_lead',
              priority: 'low',
              title: `New caller from ${formatPhone(callerNumber)} — ${Math.round(duration / 60)}min call`,
              description: `Unknown caller${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${Math.round(duration / 60)} minute conversation — if interested, create a lead.`,
              recommended_action: 'If this was a prospective student, create a lead and schedule a follow-up.',
              ai_suggestion: `${Math.round(duration / 60)}-minute call suggests genuine interest. Consider creating a lead.`,
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: { caller_number: callerNumber, caller_city: callerCity, caller_state: callerState, duration, recording_url: recordingUrl },
            })
            if (created) actionsCreated++
          }
          // Short answered calls from unknowns — skip (likely wrong numbers)
        }

        if (callType === 'missed' || callType === 'voicemail') {
          const isVoicemail = callType === 'voicemail'
          
          if (match.type === 'lead' && match.match) {
            const lead = match.match
            // Check if there's already an open call_back for this lead
            const { data: existingAction } = await supabase
              .from('action_items')
              .select('id')
              .eq('lead_id', lead.id)
              .eq('action_type', 'call_back')
              .in('status', ['open', 'in_progress'])
              .maybeSingle()

            if (!existingAction) {
              const created = await createActionItem(supabase, {
                organization_id: ORG_ID,
                location_id: location.id,
                action_type: 'call_back',
                lead_id: lead.id,
                priority: isVoicemail ? 'high' : 'high',
                title: `Call back ${lead.first_name} ${lead.last_name} — ${isVoicemail ? 'left voicemail' : 'missed call'} at ${formatTime(callStart)}`,
                description: `${lead.source ? prettifySource(lead.source) + ' lead' : 'Lead'}. ${isVoicemail ? 'They left a voicemail — listen and call back.' : 'They called and you missed it.'}`,
                recommended_action: `Call ${lead.first_name} back at ${formatPhone(callerNumber)}.${isVoicemail && recordingUrl ? ' Listen to voicemail first.' : ''}`,
                ai_suggestion: 'They called YOU — this is the highest-intent signal. Call back within the hour.',
                call_record_id: callRecordId,
                source_engine: 'call_matcher',
                data_context: { caller_number: callerNumber, lead_name: `${lead.first_name} ${lead.last_name}`, lead_source: lead.source, recording_url: recordingUrl, is_voicemail: isVoicemail },
              })
              if (created) actionsCreated++
            }
          } else if (match.type === 'student' && match.match) {
            const student = match.match
            const created = await createActionItem(supabase, {
              organization_id: ORG_ID,
              location_id: location.id,
              action_type: 'call_back',
              priority: 'medium',
              title: `Call back ${student.first_name} ${student.last_name} (student) — ${isVoicemail ? 'voicemail' : 'missed'} at ${formatTime(callStart)}`,
              description: `Existing student. ${isVoicemail ? 'Left a voicemail.' : 'Missed their call.'} May need to reschedule or has a question.`,
              recommended_action: `Call ${student.first_name} back at ${formatPhone(callerNumber)}.`,
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: { caller_number: callerNumber, student_name: `${student.first_name} ${student.last_name}`, recording_url: recordingUrl, is_voicemail: isVoicemail },
            })
            if (created) actionsCreated++
          } else {
            // Unknown caller missed/voicemail
            const created = await createActionItem(supabase, {
              organization_id: ORG_ID,
              location_id: location.id,
              action_type: 'create_lead',
              priority: isVoicemail ? 'high' : 'medium',
              title: `${isVoicemail ? 'Voicemail' : 'Missed call'} from ${formatPhone(callerNumber)} — not in system`,
              description: `Unknown caller${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${isVoicemail ? 'Left a voicemail — listen and call back.' : 'Consider calling back.'}`,
              recommended_action: `Call ${formatPhone(callerNumber)} back.${isVoicemail && recordingUrl ? ' Listen to voicemail first.' : ''} If interested, create a lead.`,
              ai_suggestion: isVoicemail
                ? 'Voicemail from unknown number — they made the effort to leave a message. High chance of being a real prospect.'
                : 'Missed call from unknown number — could be a new lead or spam. Call back to find out.',
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: { caller_number: callerNumber, caller_city: callerCity, caller_state: callerState, recording_url: recordingUrl, is_voicemail: isVoicemail },
            })
            if (created) actionsCreated++
          }
        }
      }

      // Update sync state
      await supabase
        .from('sync_state')
        .upsert({
          location_id: location.id,
          sync_type: 'ctm_call_matcher',
          last_sync_at: new Date().toISOString(),
          metadata: { calls_processed: ctmCalls.length, actions_created: actionsCreated, leads_updated: leadsUpdated },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'location_id,sync_type' })

      results.push({
        location: location.name,
        calls_fetched: ctmCalls.length,
        actions_created: actionsCreated,
        leads_updated: leadsUpdated,
      })

    } catch (err: any) {
      console.error(`Call matcher failed for ${location.name}:`, err)
      results.push({ location: location.name, error: err.message })
    }
  }

  return NextResponse.json({ success: true, results })
}

// ─── Helper functions ───

async function matchCaller(supabase: any, locationId: string, callerNumber: string) {
  const normalized = normalizePhone(callerNumber)
  if (normalized.length < 10) return { type: 'unknown', match: null }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, email, source, stage_id, is_archived')
    .eq('location_id', locationId)
    .eq('is_archived', false)

  const matchedLead = (leads || []).find((l: any) =>
    l.phone && normalizePhone(l.phone) === normalized
  )
  if (matchedLead) return { type: 'lead', match: matchedLead }

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, status')
    .eq('location_id', locationId)

  const matchedStudent = (students || []).find((s: any) =>
    s.phone && normalizePhone(s.phone) === normalized
  )
  if (matchedStudent) return { type: 'student', match: matchedStudent }

  return { type: 'unknown', match: null }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return digits
}

function formatPhone(phone: string): string {
  const d = normalizePhone(phone)
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
}

function prettifySource(source: string): string {
  const map: Record<string, string> = {
    google_ads: 'Google Ads', meta: 'Meta Ad', meta_ads: 'Meta Ad',
    web_form: 'Web Form', referral: 'Referral', walk_in: 'Walk-In',
    phone_call: 'Phone', manual_entry: 'Manual', other: 'Other',
  }
  return map[source] || source
}

function detectActivityType(ctmCall: any): string {
  // Reuse the same detection logic from the existing CTM sync
  const callType = (ctmCall.call_type || '').toLowerCase()
  if (callType === 'text' || callType === 'sms') return 'text'
  if (callType === 'chat' || callType === 'webchat') return 'chat'
  if (callType === 'form') return 'form'
  if (ctmCall.talk_time === 0 && ctmCall.duration === 0 && !ctmCall.recording_url) {
    // Likely a text
    if (ctmCall.caller_number_format && !ctmCall.tracking_number_format) return 'text'
  }
  return 'call'
}

async function createActionItem(supabase: any, item: any): Promise<boolean> {
  // Check for duplicate by call_record_id
  if (item.call_record_id) {
    const { data: existing } = await supabase
      .from('action_items')
      .select('id')
      .eq('call_record_id', item.call_record_id)
      .maybeSingle()
    if (existing) return false
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // Call matcher items persist 30 days

  const { error } = await supabase.from('action_items').insert({
    ...item,
    status: 'open',
    category: item.action_type === 'call_back' ? 'lead_followup' : 'lead_followup',
    generated_by: 'system_rule',
    rule_id: `CALL_MATCHER_${item.action_type?.toUpperCase() || 'GENERAL'}`,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('Failed to create action item:', error)
    return false
  }
  return true
}

async function updateLeadContact(supabase: any, leadId: string, callTime: string, contactType: string) {
  await supabase
    .from('leads')
    .update({
      last_contact_at: callTime,
      last_contact_type: contactType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
}
```

---

## PART 5: UPDATE VERCEL CRON

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/kpi-rollup", "schedule": "30 12 * * *" },
    { "path": "/api/cron/sync-ctm", "schedule": "0 6 * * *" },
    { "path": "/api/cron/call-matcher", "schedule": "0 13-23 * * 1-5" }
  ]
}
```

Note: The call-matcher runs at the top of every hour from 1 PM to 11 PM UTC (7 AM to 5 PM CT), Monday through Friday.

**IMPORTANT:** Verify Vercel plan supports hourly crons. If not, the endpoint can still be triggered manually or via Make.com.

---

## PART 6: FILE STRUCTURE

```
src/
├── lib/
│   └── ctm/
│       └── client.ts             # NEW — shared CTM API client
├── app/
│   └── api/
│       └── cron/
│           ├── call-matcher/
│           │   └── route.ts      # NEW — hourly call matcher
│           ├── sync-ctm/
│           │   └── route.ts      # EXISTING — daily full sync (update to use shared client)
│           └── kpi-rollup/
│               └── route.ts      # EXISTING — no changes
```

---

## BUILD ORDER

1. Create `src/lib/ctm/client.ts` (shared CTM API client)
2. Create `/api/cron/call-matcher/route.ts` (main cron handler)
3. Update vercel.json with new cron schedule
4. Optionally refactor `/api/sync/ctm/route.ts` to use shared client (not required, but cleaner)
5. Test manually: `curl https://jungle-dashboard.vercel.app/api/cron/call-matcher`
6. Verify action items appear on the actions page
7. Push to GitHub

---

## TESTING CHECKLIST

- [ ] CTM client extracts credentials from env vars correctly
- [ ] Phone normalization handles: (402) 555-1234, +14025551234, 4025551234, 402-555-1234
- [ ] Calls since last_sync_at are fetched (not full history)
- [ ] Texts and chats are skipped (only calls processed)
- [ ] Matched lead: missed call → creates call_back action item with lead_id
- [ ] Matched lead: answered call → updates last_contact_at, NO action item
- [ ] Matched student: missed call → creates call_back action item (no lead_id)
- [ ] Unknown: missed call → creates create_lead action item
- [ ] Unknown: voicemail → creates higher priority create_lead item
- [ ] Unknown: short answered call (<60s) → skipped
- [ ] Unknown: long answered call (>60s) → low priority create_lead item
- [ ] Outbound calls: no action items, but lead contact updated if matched
- [ ] Duplicate calls don't create duplicate action items (call_record_id check)
- [ ] Duplicate lead call_back: doesn't create second if one already open
- [ ] sync_state updates after processing
- [ ] Action items appear on /actions page grouped under "Call Back" section
- [ ] Call back actions show lead phone as clickable tel: link
- [ ] Recording URL included in data_context for voicemails
