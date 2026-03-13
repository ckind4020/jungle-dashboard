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

// ─── Description helpers ───

function buildCallerLabel(
  callerNumber: string,
  ctmCallerName: string | null,
  ctmSource: string | null
): string {
  const name = ctmCallerName || formatPhone(callerNumber)
  const via = ctmSource ? ` via ${ctmSource}` : ''
  return `${name}${via}`
}

function appendSummary(description: string, summary: string | null): string {
  if (!summary) return description
  return `${description}\n\nSummary: ${summary}`
}

// ─── Action item creation / update with phone-based dedup ───

async function findExistingActionByPhone(
  supabase: any,
  locationId: string,
  callerPhone: string,
  actionType: string
): Promise<any | null> {
  const { data: openItems } = await supabase
    .from('action_items')
    .select('id, title, description, data_context, priority')
    .eq('location_id', locationId)
    .eq('action_type', actionType)
    .in('status', ['open', 'in_progress'])
    .not('data_context', 'is', null)

  if (!openItems) return null

  const normalized = normalizePhone(callerPhone)
  return openItems.find((item: any) => {
    const ctx = item.data_context
    if (!ctx?.caller_number) return false
    return normalizePhone(ctx.caller_number) === normalized
  }) || null
}

async function upsertConsolidatedAction(
  supabase: any,
  existingId: string | null,
  item: any
): Promise<'created' | 'updated' | false> {
  if (existingId) {
    const { error } = await supabase
      .from('action_items')
      .update({
        title: item.title,
        description: item.description,
        priority: item.priority,
        recommended_action: item.recommended_action,
        ai_suggestion: item.ai_suggestion,
        call_record_id: item.call_record_id,
        data_context: item.data_context,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingId)
    if (error) {
      console.error('Failed to update action item:', error)
      return false
    }
    return 'updated'
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
  return 'created'
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
      let actionsUpdated = 0
      let leadsUpdated = 0

      // ── Pass 1: Process calls, upsert records, group by caller phone ──
      interface ProcessedCall {
        callerNumber: string
        direction: string
        callType: string
        callStart: string
        duration: number
        recordingUrl: string | null
        callerCity: string | null
        callerState: string | null
        callRecordId: string | null
        match: Awaited<ReturnType<typeof matchCaller>>
        ctmCallerName: string | null
        ctmEmail: string | null
        ctmSource: string | null
        callSummary: string | null
      }

      const callsByPhone = new Map<string, ProcessedCall[]>()

      for (const ctmCall of ctmCalls) {
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
        const ctmCallerName = ctmCall.name || null
        const ctmEmail = ctmCall.email || null
        const ctmSource = ctmCall.source || null
        const callSummary = ctmCall.summary || null
        const transcriptionText = ctmCall.transcription_text || null

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
          // Update existing record with new CTM fields if available
          const updateFields: Record<string, any> = {}
          if (callSummary) updateFields.call_summary = callSummary
          if (transcriptionText) updateFields.transcription_text = transcriptionText
          if (ctmCallerName) updateFields.ctm_caller_name = ctmCallerName
          if (ctmSource) updateFields.ctm_source = ctmSource
          if (Object.keys(updateFields).length > 0) {
            await supabase
              .from('call_tracking_records')
              .update(updateFields)
              .eq('id', existingRecord.id)
          }
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
              call_summary: callSummary,
              transcription_text: transcriptionText,
              ctm_caller_name: ctmCallerName,
              ctm_source: ctmSource,
            })
            .select('id')
            .single()
          callRecordId = newRecord?.id || null
        }

        // Match caller against leads/students
        const match = await matchCaller(supabase, location.id, callerNumber)

        // Outbound calls: update lead contact only, no action items
        if (direction === 'outbound') {
          if (match.type === 'lead' && match.match) {
            await updateLeadContact(supabase, match.match.id, callStart, 'call_outbound')
            leadsUpdated++
          }
          continue
        }

        // Group inbound calls by normalized phone
        const normalizedPhone = normalizePhone(callerNumber)
        const processed: ProcessedCall = {
          callerNumber, direction, callType, callStart,
          duration, recordingUrl, callerCity, callerState,
          callRecordId, match, ctmCallerName, ctmEmail,
          ctmSource, callSummary,
        }

        if (!callsByPhone.has(normalizedPhone)) {
          callsByPhone.set(normalizedPhone, [])
        }
        callsByPhone.get(normalizedPhone)!.push(processed)
      }

      // ── Pass 2: Create/update consolidated action items per caller ──
      for (const [, calls] of callsByPhone) {
        // Sort calls chronologically
        calls.sort((a, b) => new Date(a.callStart).getTime() - new Date(b.callStart).getTime())

        const firstCall = calls[0]
        const lastCall = calls[calls.length - 1]
        const callerNumber = firstCall.callerNumber
        const callerCity = firstCall.callerCity
        const callerState = firstCall.callerState
        const match = firstCall.match

        // Extract CTM enrichment from most recent call (prefer non-null values)
        const ctmCallerName = [...calls].reverse().find(c => c.ctmCallerName)?.ctmCallerName || null
        const ctmEmail = [...calls].reverse().find(c => c.ctmEmail)?.ctmEmail || null
        const ctmSource = [...calls].reverse().find(c => c.ctmSource)?.ctmSource || null
        const latestSummary = [...calls].reverse().find(c => c.callSummary)?.callSummary || null
        const callerLabel = buildCallerLabel(callerNumber, ctmCallerName, ctmSource)

        // Separate by type
        const missedOrVmCalls = calls.filter(c => c.callType === 'missed' || c.callType === 'voicemail')
        const answeredCalls = calls.filter(c => c.callType === 'answered')

        // ── Handle answered calls (update lead contact) ──
        if (answeredCalls.length > 0) {
          if (match.type === 'lead' && match.match) {
            const latest = answeredCalls[answeredCalls.length - 1]
            await updateLeadContact(supabase, match.match.id, latest.callStart, 'call_inbound')
            leadsUpdated++
          } else if (match.type === 'unknown') {
            // Consolidate long answered calls from unknowns
            const longCalls = answeredCalls.filter(c => c.duration > 60)
            if (longCalls.length > 0) {
              const totalDuration = longCalls.reduce((sum, c) => sum + c.duration, 0)
              const callCount = longCalls.length
              const mostRecentCall = longCalls[longCalls.length - 1]

              const callTimesDesc = longCalls
                .map(c => `${formatTime(c.callStart)} (${Math.round(c.duration / 60)}min)`)
                .join(', ')

              const existing = await findExistingActionByPhone(
                supabase, location.id, callerNumber, 'create_lead'
              )

              const prevCount = existing?.data_context?.call_count || 0
              const totalCount = prevCount + callCount

              const callRecords = longCalls.map(c => ({
                call_record_id: c.callRecordId,
                call_start: c.callStart,
                call_type: c.callType,
                duration: c.duration,
                recording_url: c.recordingUrl,
              }))

              const hasContactInfo = !!(ctmCallerName || ctmEmail)
              const contactNote = hasContactInfo ? ' AI concierge collected contact info.' : ''

              const baseDesc = totalCount > 1
                ? `${callerLabel} called${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. Called at ${callTimesDesc}. ${Math.round(totalDuration / 60)} total minutes \u2014 if interested, create a lead.${contactNote}`
                : `${callerLabel} called${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${Math.round(totalDuration / 60)} minute conversation \u2014 if interested, create a lead.${contactNote}`

              const result = await upsertConsolidatedAction(supabase, existing?.id || null, {
                organization_id: ORG_ID,
                location_id: location.id,
                action_type: 'create_lead',
                priority: totalCount >= 2 ? 'critical' : 'high',
                title: totalCount > 1
                  ? `Call back ${ctmCallerName || formatPhone(callerNumber)} \u2014 called ${totalCount} times today`
                  : `New caller ${ctmCallerName || formatPhone(callerNumber)} \u2014 ${Math.round(totalDuration / 60)}min call`,
                description: appendSummary(baseDesc, latestSummary),
                recommended_action:
                  'If this was a prospective student, create a lead and schedule a follow-up.',
                ai_suggestion: totalCount >= 2
                  ? `Called ${totalCount} times \u2014 clearly trying to reach you. High-priority callback.`
                  : `${Math.round(totalDuration / 60)}-minute call suggests genuine interest. Consider creating a lead.`,
                call_record_id: mostRecentCall.callRecordId,
                source_engine: 'call_matcher',
                data_context: {
                  caller_number: callerNumber,
                  caller_city: callerCity,
                  caller_state: callerState,
                  ctm_caller_name: ctmCallerName,
                  ctm_email: ctmEmail,
                  ctm_source: ctmSource,
                  call_count: totalCount,
                  call_records: [
                    ...(existing?.data_context?.call_records || []),
                    ...callRecords,
                  ],
                },
              })
              if (result === 'created') actionsCreated++
              else if (result === 'updated') actionsUpdated++
            }
          }
        }

        // ── Handle missed / voicemail calls (consolidated) ──
        if (missedOrVmCalls.length === 0) continue

        const callCount = missedOrVmCalls.length
        const hasVoicemail = missedOrVmCalls.some(c => c.callType === 'voicemail')
        const voicemailRecording = missedOrVmCalls.find(c => c.callType === 'voicemail' && c.recordingUrl)?.recordingUrl || null
        const mostRecentCallRecordId = missedOrVmCalls[missedOrVmCalls.length - 1].callRecordId

        // Build call times description
        const callTimesDesc = missedOrVmCalls
          .map(c => `${formatTime(c.callStart)} (${c.callType})`)
          .join(', ')

        // Build call records array for data_context
        const callRecords = missedOrVmCalls.map(c => ({
          call_record_id: c.callRecordId,
          call_start: c.callStart,
          call_type: c.callType,
          duration: c.duration,
          recording_url: c.recordingUrl,
        }))

        if (match.type === 'lead' && match.match) {
          const lead = match.match
          const actionType = 'call_back'

          const existing = await findExistingActionByPhone(
            supabase, location.id, callerNumber, actionType
          )

          const prevCount = existing?.data_context?.call_count || 0
          const totalCount = prevCount + callCount
          const totalPriority = totalCount >= 2 ? 'critical' : 'high'

          const baseDesc = totalCount > 1
            ? `${lead.source ? prettifySource(lead.source) + ' lead' : 'Lead'}. ${callerLabel} called at ${callTimesDesc}.${hasVoicemail ? ' Left a voicemail \u2014 listen and call back.' : ''}`
            : `${lead.source ? prettifySource(lead.source) + ' lead' : 'Lead'}. ${callerLabel} called. ${hasVoicemail ? 'They left a voicemail \u2014 listen and call back.' : 'They called and you missed it.'}`

          const result = await upsertConsolidatedAction(supabase, existing?.id || null, {
            organization_id: ORG_ID,
            location_id: location.id,
            action_type: actionType,
            lead_id: lead.id,
            priority: totalPriority,
            title: totalCount > 1
              ? `Call back ${lead.first_name} ${lead.last_name} \u2014 called ${totalCount} times`
              : `Call back ${lead.first_name} ${lead.last_name} \u2014 ${hasVoicemail ? 'left voicemail' : 'missed call'} at ${formatTime(lastCall.callStart)}`,
            description: appendSummary(baseDesc, latestSummary),
            recommended_action: `Call ${lead.first_name} back at ${formatPhone(callerNumber)}.${hasVoicemail && voicemailRecording ? ' Listen to voicemail first.' : ''}`,
            ai_suggestion: totalCount >= 2
              ? `Called ${totalCount} times \u2014 they clearly need to reach you. Call back immediately.`
              : 'They called YOU \u2014 this is the highest-intent signal. Call back within the hour.',
            call_record_id: mostRecentCallRecordId,
            source_engine: 'call_matcher',
            data_context: {
              caller_number: callerNumber,
              lead_name: `${lead.first_name} ${lead.last_name}`,
              lead_source: lead.source,
              ctm_caller_name: ctmCallerName,
              ctm_source: ctmSource,
              recording_url: voicemailRecording,
              has_voicemail: hasVoicemail,
              call_count: totalCount,
              call_records: [
                ...(existing?.data_context?.call_records || []),
                ...callRecords,
              ],
            },
          })
          if (result === 'created') actionsCreated++
          else if (result === 'updated') actionsUpdated++
        } else if (match.type === 'student' && match.match) {
          const student = match.match
          const actionType = 'call_back'

          const existing = await findExistingActionByPhone(
            supabase, location.id, callerNumber, actionType
          )

          const prevCount = existing?.data_context?.call_count || 0
          const totalCount = prevCount + callCount
          const totalPriority = totalCount >= 2 ? 'critical' : 'medium'

          const baseDesc = totalCount > 1
            ? `Existing student. ${callerLabel} called at ${callTimesDesc}.${hasVoicemail ? ' Left a voicemail.' : ''} May need to reschedule or has a question.`
            : `Existing student. ${callerLabel} called. ${hasVoicemail ? 'Left a voicemail.' : 'Missed their call.'} May need to reschedule or has a question.`

          const result = await upsertConsolidatedAction(supabase, existing?.id || null, {
            organization_id: ORG_ID,
            location_id: location.id,
            action_type: actionType,
            priority: totalPriority,
            title: totalCount > 1
              ? `Call back ${student.first_name} ${student.last_name} (student) \u2014 called ${totalCount} times`
              : `Call back ${student.first_name} ${student.last_name} (student) \u2014 ${hasVoicemail ? 'voicemail' : 'missed'} at ${formatTime(lastCall.callStart)}`,
            description: appendSummary(baseDesc, latestSummary),
            recommended_action: `Call ${student.first_name} back at ${formatPhone(callerNumber)}.`,
            call_record_id: mostRecentCallRecordId,
            source_engine: 'call_matcher',
            data_context: {
              caller_number: callerNumber,
              student_name: `${student.first_name} ${student.last_name}`,
              ctm_caller_name: ctmCallerName,
              ctm_source: ctmSource,
              recording_url: voicemailRecording,
              has_voicemail: hasVoicemail,
              call_count: totalCount,
              call_records: [
                ...(existing?.data_context?.call_records || []),
                ...callRecords,
              ],
            },
          })
          if (result === 'created') actionsCreated++
          else if (result === 'updated') actionsUpdated++
        } else {
          // Unknown caller missed/voicemail
          const actionType = 'create_lead'

          const existing = await findExistingActionByPhone(
            supabase, location.id, callerNumber, actionType
          )

          const prevCount = existing?.data_context?.call_count || 0
          const totalCount = prevCount + callCount
          const totalPriority = totalCount >= 2 ? 'critical' : (hasVoicemail ? 'high' : 'medium')

          const hasContactInfo = !!(ctmCallerName || ctmEmail)
          const contactNote = hasContactInfo ? ' AI concierge collected contact info.' : ''

          const baseDesc = totalCount > 1
            ? `${callerLabel} called${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. Called at ${callTimesDesc}.${hasVoicemail ? ' Left a voicemail \u2014 listen and call back.' : ''}${contactNote}`
            : `${callerLabel} called${callerCity ? ` from ${callerCity}${callerState ? ', ' + callerState : ''}` : ''}. ${hasVoicemail ? 'Left a voicemail \u2014 listen and call back.' : 'Consider calling back.'}${contactNote}`

          const result = await upsertConsolidatedAction(supabase, existing?.id || null, {
            organization_id: ORG_ID,
            location_id: location.id,
            action_type: actionType,
            priority: totalPriority,
            title: totalCount > 1
              ? `Call back ${ctmCallerName || formatPhone(callerNumber)} \u2014 called ${totalCount} times`
              : `${hasVoicemail ? 'Voicemail' : 'Missed call'} from ${ctmCallerName || formatPhone(callerNumber)} \u2014 not in system`,
            description: appendSummary(baseDesc, latestSummary),
            recommended_action: `Call ${ctmCallerName || formatPhone(callerNumber)} back.${hasVoicemail && voicemailRecording ? ' Listen to voicemail first.' : ''} If interested, create a lead.`,
            ai_suggestion: totalCount >= 2
              ? `Called ${totalCount} times \u2014 clearly trying to reach you. High chance of being a real prospect.`
              : hasVoicemail
                ? 'Voicemail from unknown number \u2014 they made the effort to leave a message. High chance of being a real prospect.'
                : 'Missed call from unknown number \u2014 could be a new lead or spam. Call back to find out.',
            call_record_id: mostRecentCallRecordId,
            source_engine: 'call_matcher',
            data_context: {
              caller_number: callerNumber,
              caller_city: callerCity,
              caller_state: callerState,
              ctm_caller_name: ctmCallerName,
              ctm_email: ctmEmail,
              ctm_source: ctmSource,
              recording_url: voicemailRecording,
              has_voicemail: hasVoicemail,
              call_count: totalCount,
              call_records: [
                ...(existing?.data_context?.call_records || []),
                ...callRecords,
              ],
            },
          })
          if (result === 'created') actionsCreated++
          else if (result === 'updated') actionsUpdated++
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
            actions_updated: actionsUpdated,
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
        actions_updated: actionsUpdated,
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
