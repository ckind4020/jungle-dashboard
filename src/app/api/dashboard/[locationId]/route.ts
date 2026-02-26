import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

const TZ = 'America/Chicago'

// Get hour and day-of-week in Central Time
function getCentralTime(date: Date): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date)

  const hourStr = parts.find(p => p.type === 'hour')?.value || '0'
  const dayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon'
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  return { hour: parseInt(hourStr), day: dayMap[dayStr] ?? 1 }
}

// Is this timestamp during business hours? M-F 8am-5pm Central
function isDuringBusinessHours(date: Date): boolean {
  const { hour, day } = getCentralTime(date)
  return day >= 1 && day <= 5 && hour >= 8 && hour < 17
}

// Count business hours between two dates. M-F 8am-5pm Central (9 hrs/day).
// If start is outside business hours, clock begins at next business hour.
function businessHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0

  let hours = 0
  // Step through in 1-hour increments
  const current = new Date(start)

  while (current < end) {
    if (isDuringBusinessHours(current)) {
      hours++
    }
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }
  return hours
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const { locationId } = await params
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)

  // Default to last 30 days, allow ?days=7 or ?days=90
  const days = parseInt(searchParams.get('days') || '30')
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  // Previous period for comparison
  const prevStartDate = new Date(startDate)
  prevStartDate.setDate(prevStartDate.getDate() - days)

  // === 1. Location info ===
  const { data: location } = await supabase
    .from('locations')
    .select('id, name, location_number, franchise_status')
    .eq('id', locationId)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // === 2. KPI daily trend ===
  const { data: kpiTrend } = await supabase
    .from('kpi_daily')
    .select('date, new_leads_count, total_calls_inbound, calls_answered, calls_missed, total_ad_spend, cost_per_lead, gbp_overall_rating, gbp_new_reviews, gbp_unreplied_reviews')
    .eq('location_id', locationId)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date')

  // === 3. Ad spend by source (current period) ===
  const { data: adSpendBySource } = await supabase
    .from('ad_spend_daily')
    .select('source, spend, impressions, clicks, conversions, cpa, roas')
    .eq('location_id', locationId)
    .gte('date', startStr)
    .lte('date', endStr)

  // Aggregate by source
  const sourceAgg: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {}
  for (const row of (adSpendBySource || [])) {
    const src = row.source || 'unknown'
    if (!sourceAgg[src]) sourceAgg[src] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    sourceAgg[src].spend += Number(row.spend || 0)
    sourceAgg[src].impressions += Number(row.impressions || 0)
    sourceAgg[src].clicks += Number(row.clicks || 0)
    sourceAgg[src].conversions += Number(row.conversions || 0)
  }

  const adSpendSummary = Object.entries(sourceAgg).map(([source, data]) => ({
    source,
    ...data,
    ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : '0.00',
    cpl: data.conversions > 0 ? (data.spend / data.conversions).toFixed(2) : null,
    roas: data.spend > 0 ? ((data.conversions * 100) / data.spend).toFixed(2) : null,
  }))

  // === 4. Ad spend daily trend (for chart) ===
  const { data: adSpendTrend } = await supabase
    .from('ad_spend_daily')
    .select('date, source, spend, conversions')
    .eq('location_id', locationId)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date')

  const dailyAdSpend: Record<string, Record<string, number>> = {}
  for (const row of (adSpendTrend || [])) {
    if (!dailyAdSpend[row.date]) dailyAdSpend[row.date] = {}
    const src = row.source || 'unknown'
    dailyAdSpend[row.date][src] = (dailyAdSpend[row.date][src] || 0) + Number(row.spend || 0)
  }
  const adSpendChartData = Object.entries(dailyAdSpend)
    .map(([date, sources]) => ({ date, ...sources }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // === 5. Leads by source (current period) ===
  const { data: leads } = await supabase
    .from('leads')
    .select('id, source, stage_id, is_archived, converted_at, created_at')
    .eq('location_id', locationId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const leadsBySource: Record<string, { total: number; converted: number }> = {}
  for (const lead of (leads || [])) {
    const src = lead.source || 'unknown'
    if (!leadsBySource[src]) leadsBySource[src] = { total: 0, converted: 0 }
    leadsBySource[src].total++
    if (lead.converted_at) leadsBySource[src].converted++
  }

  const leadSourceSummary = Object.entries(leadsBySource).map(([source, data]) => ({
    source,
    total: data.total,
    converted: data.converted,
    conversion_rate: data.total > 0 ? ((data.converted / data.total) * 100).toFixed(1) : '0.0',
  }))

  // Total leads previous period
  const { count: prevLeadCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', startDate.toISOString())

  // === 6. Call tracking — actual calls only (activity_type = 'call') ===
  const { data: calls } = await supabase
    .from('call_tracking_records')
    .select('call_type, call_start, duration_seconds, direction, caller_number, source, activity_type')
    .eq('location_id', locationId)
    .eq('activity_type', 'call')
    .gte('call_start', startDate.toISOString())
    .lte('call_start', endDate.toISOString())

  const callsArr = calls || []

  // Split inbound vs outbound
  const inboundCalls = callsArr.filter((c: any) => c.direction === 'inbound')
  const outboundTotal = callsArr.filter((c: any) => c.direction === 'outbound').length

  // Answer rate: only count inbound calls during business hours (M-F 8am-5pm CST)
  const bhInbound = inboundCalls.filter((c: any) => isDuringBusinessHours(new Date(c.call_start)))
  const bhAnswered = bhInbound.filter((c: any) => c.call_type === 'answered').length
  const bhTotal = bhInbound.length

  // Primary metrics: all inbound (total counts) + business-hours answer rate
  const callSummary = {
    total: inboundCalls.length,
    answered: inboundCalls.filter((c: any) => c.call_type === 'answered').length,
    missed: inboundCalls.filter((c: any) => c.call_type === 'missed').length,
    voicemail: inboundCalls.filter((c: any) => c.call_type === 'voicemail').length,
    outbound: outboundTotal,
    avg_duration: 0,
    answer_rate: '0.0',
    bh_total: bhTotal,
    bh_answered: bhAnswered,
    after_hours_missed: inboundCalls.filter((c: any) =>
      c.call_type === 'missed' && !isDuringBusinessHours(new Date(c.call_start))
    ).length,
  }
  const answeredInbound = inboundCalls.filter((c: any) => c.call_type === 'answered')
  if (answeredInbound.length > 0) {
    callSummary.avg_duration = Math.round(
      answeredInbound.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / answeredInbound.length
    )
  }
  // Answer rate based on business hours calls only
  if (bhTotal > 0) {
    callSummary.answer_rate = ((bhAnswered / bhTotal) * 100).toFixed(1)
  }

  // Calls by hour (inbound only)
  const callsByHour: number[] = new Array(24).fill(0)
  const missedByHour: number[] = new Array(24).fill(0)
  for (const call of inboundCalls) {
    const hour = new Date((call as any).call_start).getHours()
    callsByHour[hour]++
    if ((call as any).call_type === 'missed') missedByHour[hour]++
  }

  // === 6b. SMS summary ===
  const { data: smsRecords } = await supabase
    .from('call_tracking_records')
    .select('direction')
    .eq('location_id', locationId)
    .eq('activity_type', 'text')
    .gte('call_start', startDate.toISOString())
    .lte('call_start', endDate.toISOString())

  const smsArr = smsRecords || []
  const smsSummary = {
    total: smsArr.length,
    inbound: smsArr.filter((s: any) => s.direction === 'inbound').length,
    outbound: smsArr.filter((s: any) => s.direction === 'outbound').length,
  }

  // === 6c. Callback tracking ===
  // Get ALL inbound missed calls (no date filter — show everything that needs a callback)
  const { data: allMissedInbound } = await supabase
    .from('call_tracking_records')
    .select('call_type, call_start, caller_number, source, direction, activity_type')
    .eq('location_id', locationId)
    .eq('activity_type', 'call')
    .eq('call_type', 'missed')
    .eq('direction', 'inbound')
    .order('call_start', { ascending: false })

  const missedInboundArr = allMissedInbound || []

  // Get ALL outbound calls (no start date filter — need full history for matching)
  const { data: allOutboundCalls } = await supabase
    .from('call_tracking_records')
    .select('caller_number, call_start')
    .eq('location_id', locationId)
    .eq('activity_type', 'call')
    .eq('direction', 'outbound')

  const outboundArr = allOutboundCalls || []

  // Match missed calls with subsequent outbound calls to same number
  const now = new Date()
  const unreturnedCalls: any[] = []
  let totalCallbackHours = 0
  let returnedCount = 0

  for (const missed of missedInboundArr) {
    const missedTime = new Date((missed as any).call_start)
    const callerNum = (missed as any).caller_number

    if (!callerNum) continue

    // Find first outbound call to same number AFTER this missed call
    const callback = outboundArr.find((o: any) => {
      const outTime = new Date(o.call_start)
      return o.caller_number === callerNum && outTime > missedTime
    })

    if (callback) {
      const callbackTime = new Date((callback as any).call_start)
      const bh = businessHoursBetween(missedTime, callbackTime)
      totalCallbackHours += bh
      returnedCount++
    } else {
      const hoursWaiting = businessHoursBetween(missedTime, now)
      unreturnedCalls.push({
        caller_number: callerNum,
        called_at: (missed as any).call_start,
        source: (missed as any).source || null,
        hours_waiting: hoursWaiting,
      })
    }
  }

  // Deduplicate unreturned by caller_number (keep the most recent)
  const seenNumbers = new Set<string>()
  const dedupedUnreturned = unreturnedCalls
    .sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())
    .filter((c) => {
      if (seenNumbers.has(c.caller_number)) return false
      seenNumbers.add(c.caller_number)
      return true
    })

  const totalMissedInbound = missedInboundArr.length
  const callbacks = {
    unreturned_calls: dedupedUnreturned,
    unreturned_count: dedupedUnreturned.length,
    avg_callback_time_hours: returnedCount > 0 ? Math.round((totalCallbackHours / returnedCount) * 10) / 10 : 0,
    callback_rate: totalMissedInbound > 0 ? Math.round((returnedCount / totalMissedInbound) * 1000) / 10 : 100,
    returned_count: returnedCount,
  }

  // === 7. GBP summary ===
  const { data: latestGbp } = await supabase
    .from('gbp_metrics_daily')
    .select('overall_rating, total_review_count, search_views, maps_views, website_clicks, phone_calls')
    .eq('location_id', locationId)
    .order('date', { ascending: false })
    .limit(1)

  const { data: recentReviews } = await supabase
    .from('gbp_reviews')
    .select('reviewer_name, star_rating, review_text, review_date, has_reply')
    .eq('location_id', locationId)
    .order('review_date', { ascending: false })
    .limit(5)

  const { count: unrepliedCount } = await supabase
    .from('gbp_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('has_reply', false)

  // === 8. Summary KPIs ===
  const totalLeads = (leads || []).length
  const totalSpend = adSpendSummary.reduce((sum, s) => sum + s.spend, 0)
  const totalConversions = adSpendSummary.reduce((sum, s) => sum + s.conversions, 0)
  const overallCPL = totalConversions > 0 ? (totalSpend / totalConversions) : null

  const summary = {
    total_leads: totalLeads,
    prev_period_leads: prevLeadCount || 0,
    lead_change_pct: prevLeadCount && prevLeadCount > 0
      ? (((totalLeads - prevLeadCount) / prevLeadCount) * 100).toFixed(1)
      : null,
    total_ad_spend: totalSpend,
    overall_cpl: overallCPL,
    total_calls: callSummary.total, // inbound only
    call_answer_rate: callSummary.answer_rate, // business hours only
    gbp_rating: latestGbp?.[0]?.overall_rating || null,
    gbp_total_reviews: latestGbp?.[0]?.total_review_count || 0,
    unreplied_reviews: unrepliedCount || 0,
  }

  return NextResponse.json({
    location,
    summary,
    kpi_trend: kpiTrend || [],
    ad_spend_summary: adSpendSummary,
    ad_spend_chart: adSpendChartData,
    lead_source_summary: leadSourceSummary,
    call_summary: callSummary,
    calls_by_hour: callsByHour,
    missed_by_hour: missedByHour,
    sms_summary: smsSummary,
    callbacks,
    gbp: latestGbp?.[0] || null,
    recent_reviews: recentReviews || [],
    period: { start: startStr, end: endStr, days },
  })
}
