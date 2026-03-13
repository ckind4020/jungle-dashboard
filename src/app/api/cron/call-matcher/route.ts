/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getCTMCredentials,
  fetchCTMCalls,
  getActivityType,
  getCallDirection,
  getCallType,
  getCallStartTime,
} from '@/lib/ctm/client'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

// ─── Phone helpers ───

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
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })
}

function prettifySource(source: string): string {
  const map: Record<string, string> = {
    google_ads: 'Google Ads',
    meta: 'Meta Ad',
    meta_ads: 'Meta Ad',
    web_form: 'Web Form',
    referral: 'Referral',
    walk_in: 'Walk-In',
    phone_call: 'Phone',
    manual_entry: 'Manual',
    other: 'Other',
  }
  return map[source] || source
}

// ─── Matching ───

async function matchCaller(supabase: any, locationId: string, callerNumber: string) {
  const normalized = normalizePhone(callerNumber)
  if (normalized.length < 10) return { type: 'unknown' as const, match: null }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, email, source, stage_id, is_archived')
    .eq('location_id', locationId)
    .eq('is_archived', false)

  const matchedLead = (leads || []).find(
    (l: any) => l.phone && normalizePhone(l.phone) === normalized
  )
  if (matchedLead) return { type: 'lead' as const, match: matchedLead }

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, status')
    .eq('location_id', locationId)

  const matchedStudent = (students || []).find(
    (s: any) => s.phone && normalizePhone(s.phone) === normalized
  )
  if (matchedStudent) return { type: 'student' as const, match: matchedStudent }

  return { type: 'unknown' as const, match: null }
}

// ─── Action item creation with dedup ───

async function createActionItem(supabase: any, item: any): Promise<boolean> {
  if (item.call_record_id) {
    const { data: existing } = await supabase
      .from('action_items')
      .select('id')
      .eq('call_record_id', item.call_record_id)
      .maybeSingle()
    if (existing) return false
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const { error } = await supabase.from('action_items').insert({
    ...item,
    status: 'open',
    category: 'lead_followup',
    generated_by: 'system_rule',
    rule_id: `CALL_MATCHER_${(item.action_type || 'GENERAL').toUpperCase()}`,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('Failed to create action item:', error)
    return false
  }
  return true
}

async function updateLeadContact(
  supabase: any,
  leadId: string,
  callTime: string,
  contactType: string
) {
  await supabase
    .from('leads')
    .update({
      last_contact_at: callTime,
      last_contact_type: contactType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
}

// ─── Main handler ───

export async function GET(request: Request) {
  // Verify cron secret (allow open access for manual testing)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: any[] = []

  // Get all active locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, location_number')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  for (const location of locations || []) {
    if (!location.location_number) continue
    const creds = getCTMCredentials(location.location_number)
    if (!creds) continue

    try {
      // Get last sync time
      const { data: syncState } = await supabase
        .from('sync_state')
        .select('*')
        .eq('location_id', location.id)
        .eq('sync_type', 'ctm_call_matcher')
        .maybeSingle()

      const lastSyncAt =
        syncState?.last_sync_at || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

      // Fetch new calls from CTM
      const ctmCalls = await fetchCTMCalls(creds, lastSyncAt, { maxPages: 3 })

      let actionsCreated = 0
      let leadsUpdated = 0

      for (const ctmCall of ctmCalls) {
        // Only process actual calls
        const activityType = getActivityType(ctmCall)
        if (activityType !== 'call') continue

        const callerNumber = ctmCall.caller_number_bare || ctmCall.caller_number || ''
        const direction = getCallDirection(ctmCall)
        const callType = getCallType(ctmCall, activityType)
        const callStart = getCallStartTime(ctmCall)
        const duration = ctmCall.duration || 0
        const recordingUrl = ctmCall.audio || ctmCall.recording_url || null
        const callerCity = ctmCall.city || null
        const callerState = ctmCall.state || null

        // Ensure call record exists in call_tracking_records
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
          const { data: newRecord } = await supabase
            .from('call_tracking_records')
            .insert({
              location_id: location.id,
              organization_id: ORG_ID,
              external_id: externalId,
              caller_number: callerNumber,
              tracking_number: ctmCall.tracking_number_bare || ctmCall.tracking_number || '',
              call_start: callStart,
              duration_seconds: duration,
              talk_time_seconds: ctmCall.talk_time ?? null,
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

        // Match caller against leads/students
        const match = await matchCaller(supabase, location.id, callerNumber)

        // ── Outbound calls: update lead contact only, no action items ──
        if (direction === 'outbound') {
          if (match.type === 'lead' && match.match) {
            await updateLeadContact(supabase, match.match.id, callStart, 'call_outbound')
            leadsUpdated++
          }
          continue
        }

        // ── Inbound answered calls ──
        if (callType === 'answered') {
          if (match.type === 'lead' && match.match) {
            await updateLeadContact(supabase, match.match.id, callStart, 'call_inbound')
            leadsUpdated++
          } else if (match.type === 'unknown' && duration > 60) {
            const created = await createActionItem(supabase, {
              organization_id: ORG_ID,
              location_id: location.id,
              action_type: 'create_lead',
              priority: 'low',
              title: `New caller from ${formatPhone(callerNumber)} \u2014 ${Math.round(duration / 60)}min call`,
              description: `Unknown caller${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${Math.round(duration / 60)} minute conversation \u2014 if interested, create a lead.`,
              recommended_action:
                'If this was a prospective student, create a lead and schedule a follow-up.',
              ai_suggestion: `${Math.round(duration / 60)}-minute call suggests genuine interest. Consider creating a lead.`,
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: {
                caller_number: callerNumber,
                caller_city: callerCity,
                caller_state: callerState,
                duration,
                recording_url: recordingUrl,
              },
            })
            if (created) actionsCreated++
          }
          // Short answered calls from unknowns — skip (likely wrong numbers)
        }

        // ── Inbound missed / voicemail calls ──
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
                priority: 'high',
                title: `Call back ${lead.first_name} ${lead.last_name} \u2014 ${isVoicemail ? 'left voicemail' : 'missed call'} at ${formatTime(callStart)}`,
                description: `${lead.source ? prettifySource(lead.source) + ' lead' : 'Lead'}. ${isVoicemail ? 'They left a voicemail \u2014 listen and call back.' : 'They called and you missed it.'}`,
                recommended_action: `Call ${lead.first_name} back at ${formatPhone(callerNumber)}.${isVoicemail && recordingUrl ? ' Listen to voicemail first.' : ''}`,
                ai_suggestion:
                  'They called YOU \u2014 this is the highest-intent signal. Call back within the hour.',
                call_record_id: callRecordId,
                source_engine: 'call_matcher',
                data_context: {
                  caller_number: callerNumber,
                  lead_name: `${lead.first_name} ${lead.last_name}`,
                  lead_source: lead.source,
                  recording_url: recordingUrl,
                  is_voicemail: isVoicemail,
                },
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
              title: `Call back ${student.first_name} ${student.last_name} (student) \u2014 ${isVoicemail ? 'voicemail' : 'missed'} at ${formatTime(callStart)}`,
              description: `Existing student. ${isVoicemail ? 'Left a voicemail.' : 'Missed their call.'} May need to reschedule or has a question.`,
              recommended_action: `Call ${student.first_name} back at ${formatPhone(callerNumber)}.`,
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: {
                caller_number: callerNumber,
                student_name: `${student.first_name} ${student.last_name}`,
                recording_url: recordingUrl,
                is_voicemail: isVoicemail,
              },
            })
            if (created) actionsCreated++
          } else {
            // Unknown caller missed/voicemail
            const created = await createActionItem(supabase, {
              organization_id: ORG_ID,
              location_id: location.id,
              action_type: 'create_lead',
              priority: isVoicemail ? 'high' : 'medium',
              title: `${isVoicemail ? 'Voicemail' : 'Missed call'} from ${formatPhone(callerNumber)} \u2014 not in system`,
              description: `Unknown caller${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${isVoicemail ? 'Left a voicemail \u2014 listen and call back.' : 'Consider calling back.'}`,
              recommended_action: `Call ${formatPhone(callerNumber)} back.${isVoicemail && recordingUrl ? ' Listen to voicemail first.' : ''} If interested, create a lead.`,
              ai_suggestion: isVoicemail
                ? 'Voicemail from unknown number \u2014 they made the effort to leave a message. High chance of being a real prospect.'
                : 'Missed call from unknown number \u2014 could be a new lead or spam. Call back to find out.',
              call_record_id: callRecordId,
              source_engine: 'call_matcher',
              data_context: {
                caller_number: callerNumber,
                caller_city: callerCity,
                caller_state: callerState,
                recording_url: recordingUrl,
                is_voicemail: isVoicemail,
              },
            })
            if (created) actionsCreated++
          }
        }
      }

      // Update sync state
      await supabase.from('sync_state').upsert(
        {
          location_id: location.id,
          sync_type: 'ctm_call_matcher',
          last_sync_at: new Date().toISOString(),
          metadata: {
            calls_processed: ctmCalls.length,
            actions_created: actionsCreated,
            leads_updated: leadsUpdated,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id,sync_type' }
      )

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

export async function POST(request: Request) {
  return GET(request)
}
