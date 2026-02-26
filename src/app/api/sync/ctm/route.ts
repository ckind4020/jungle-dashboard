import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'
const CTM_BASE_URL = 'https://api.calltrackingmetrics.com/api/v1'

interface CtmCall {
  id: number | string
  caller_number_bare?: string
  caller_number?: string
  tracking_number?: string
  source?: string
  duration?: number
  talk_time?: number
  answered?: boolean
  status?: string
  voicemail?: boolean
  direction?: string
  occurred_at?: string
  created_at?: string
  recording_url?: string
  city?: string
  state?: string
}

interface SyncResult {
  synced: number
  skipped: number
  errors: number
}

function getCtmCredentials(locationNumber: string) {
  // Extract numeric portion: "JUNGLE-101" → "101"
  const num = locationNumber.replace(/^JUNGLE-/i, '')
  const accountId = process.env[`CTM_${num}_ACCOUNT_ID`]
  const accessKey = process.env[`CTM_${num}_ACCESS_KEY`]
  const secretKey = process.env[`CTM_${num}_SECRET_KEY`]

  if (!accountId || !accessKey || !secretKey) {
    return null
  }

  return { accountId, accessKey, secretKey }
}

function mapCtmCall(call: CtmCall, locationId: string) {
  // Determine call_type from CTM fields
  let callType: 'answered' | 'missed' | 'voicemail' = 'missed'
  if (call.voicemail) {
    callType = 'voicemail'
  } else if (call.answered === true || call.status === 'answered') {
    callType = 'answered'
  }

  return {
    external_id: String(call.id),
    location_id: locationId,
    organization_id: ORG_ID,
    caller_number: call.caller_number_bare || call.caller_number || null,
    tracking_number: call.tracking_number || null,
    source: call.source || null,
    duration_seconds: call.duration ?? 0,
    talk_time_seconds: call.talk_time ?? null,
    call_type: callType,
    direction: call.direction || 'inbound',
    call_start: call.occurred_at || call.created_at || new Date().toISOString(),
    recording_url: call.recording_url || null,
    caller_city: call.city || null,
    caller_state: call.state || null,
  }
}

export async function syncCtmCalls(
  locationNumber: string,
  days: number
): Promise<{ success: boolean; error?: string; location: string; synced: number; skipped: number; errors: number; date_range: { start: string; end: string } }> {
  const supabase = createServiceClient()

  // 1. Look up location by location_number
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('location_number', locationNumber)
    .single()

  if (locError || !location) {
    return { success: false, error: `Location not found: ${locationNumber}`, location: locationNumber, synced: 0, skipped: 0, errors: 0, date_range: { start: '', end: '' } }
  }

  // 2. Get CTM credentials
  const creds = getCtmCredentials(locationNumber)
  if (!creds) {
    return { success: false, error: `No CTM credentials for ${locationNumber}`, location: locationNumber, synced: 0, skipped: 0, errors: 0, date_range: { start: '', end: '' } }
  }

  // 3. Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  // 4. Fetch calls from CTM API with pagination
  const basicAuth = Buffer.from(`${creds.accessKey}:${creds.secretKey}`).toString('base64')
  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 }
  let firstError: string | null = null

  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const url = `${CTM_BASE_URL}/accounts/${creds.accountId}/calls.json?start_date=${startStr}&end_date=${endStr}&page=${page}&per_page=100`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`CTM API error (page ${page}):`, response.status, text)
      return {
        success: false,
        error: `CTM API returned ${response.status}: ${text.slice(0, 200)}`,
        location: locationNumber,
        ...result,
        date_range: { start: startStr, end: endStr },
      }
    }

    const data = await response.json()
    totalPages = data.total_pages || 1
    const calls: CtmCall[] = data.calls || []

    // 5. Upsert each call
    for (const call of calls) {
      const mapped = mapCtmCall(call, location.id)

      const { error: upsertError } = await supabase
        .from('call_tracking_records')
        .upsert(mapped, { onConflict: 'external_id' })

      if (upsertError) {
        console.error(`Upsert error for call ${call.id}:`, upsertError.message)
        if (!firstError) firstError = upsertError.message
        result.errors++
      } else {
        result.synced++
      }
    }

    page++

    // Small delay between pages to avoid rate limiting
    if (page <= totalPages) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return {
    success: true,
    location: locationNumber,
    ...result,
    ...(firstError ? { first_error: firstError } : {}),
    date_range: { start: startStr, end: endStr },
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const loc = searchParams.get('loc')
  const days = parseInt(searchParams.get('days') || '30', 10)

  if (!loc) {
    return NextResponse.json(
      { error: 'Missing required parameter: loc (e.g., JUNGLE-101)' },
      { status: 400 }
    )
  }

  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json(
      { error: 'Invalid days parameter. Must be between 1 and 365.' },
      { status: 400 }
    )
  }

  const result = await syncCtmCalls(loc, days)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
