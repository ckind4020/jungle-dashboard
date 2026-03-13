/* eslint-disable @typescript-eslint/no-explicit-any */

const CTM_BASE_URL = 'https://api.calltrackingmetrics.com/api/v1'

export interface CTMCredentials {
  accountId: string
  accessKey: string
  secretKey: string
}

export interface CTMCall {
  id: number
  caller_number_bare?: string
  caller_number?: string
  caller_number_format?: string
  tracking_number_bare?: string
  tracking_number?: string
  tracking_number_format?: string
  called_at?: string
  occurred_at?: string
  created_at?: string
  start_time?: string
  duration: number
  talk_time: number
  dial_status?: string
  status?: string
  call_status?: string
  direction?: string
  call_type?: string
  voicemail?: boolean
  answered?: boolean
  audio?: string
  recording_url?: string
  message_id?: string
  source?: string
  city?: string
  state?: string
  summary?: string
  transcription_text?: string
  name?: string
  email?: string
}

export function getCTMCredentials(locationNumber: string): CTMCredentials | null {
  const num = locationNumber.replace(/^JUNGLE-/i, '').replace(/\D/g, '').replace(/^0+/, '')
  const accountId = process.env[`CTM_${num}_ACCOUNT_ID`]
  const accessKey = process.env[`CTM_${num}_ACCESS_KEY`]
  const secretKey = process.env[`CTM_${num}_SECRET_KEY`]

  if (!accountId || !accessKey || !secretKey) return null
  return { accountId, accessKey, secretKey }
}

export function getActivityType(call: any): 'call' | 'text' | 'form' | 'chat' {
  const dir = (call.direction || '').toLowerCase()
  if (dir.startsWith('msg_') || dir.includes('sms') || dir.includes('text')) return 'text'
  if (call.message_id && !call.audio) return 'text'
  if (dir.includes('form')) return 'form'
  if (dir.includes('chat')) return 'chat'
  return 'call'
}

export function getCallDirection(call: any): 'inbound' | 'outbound' {
  const dir = (call.direction || '').toLowerCase()
  if (dir.includes('outbound')) return 'outbound'
  return 'inbound'
}

export function getCallType(call: any, activityType: string): string {
  if (activityType !== 'call') return activityType
  if (call.voicemail) return 'voicemail'
  const status = (call.dial_status || call.status || '').toLowerCase()
  if (status === 'answered' || call.answered === true) return 'answered'
  if (status === 'voicemail') return 'voicemail'
  return 'missed'
}

export function getCallStartTime(call: any): string {
  return call.called_at || call.occurred_at || call.created_at || new Date().toISOString()
}

export async function fetchCTMCalls(
  creds: CTMCredentials,
  since: string,
  options?: { maxPages?: number }
): Promise<CTMCall[]> {
  const authToken = Buffer.from(`${creds.accessKey}:${creds.secretKey}`).toString('base64')
  const allCalls: CTMCall[] = []
  const maxPages = options?.maxPages || 5

  // Use start_date as date string for CTM API
  const sinceDate = new Date(since)
  const startDateStr = sinceDate.toISOString().split('T')[0]
  const endDateStr = new Date().toISOString().split('T')[0]

  for (let page = 1; page <= maxPages; page++) {
    const url = `${CTM_BASE_URL}/accounts/${creds.accountId}/calls.json?start_date=${startDateStr}&end_date=${endDateStr}&page=${page}&per_page=100`

    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${authToken}` },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.error(`CTM API error: ${response.status}`)
      break
    }

    const data = await response.json()
    const calls = data.calls || []
    allCalls.push(...calls)

    if (calls.length < 100) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Filter to only calls after the since timestamp
  const sinceTime = sinceDate.getTime()
  return allCalls.filter(call => {
    const callTime = new Date(getCallStartTime(call)).getTime()
    return callTime > sinceTime
  })
}
