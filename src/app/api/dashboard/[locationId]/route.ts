import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

function businessHoursBetween(start: Date, end: Date): number {
  // Count hours only M-F 8am-6pm (Central Time)
  let hours = 0
  const current = new Date(start)

  while (current < end) {
    const day = current.getDay() // 0=Sun, 6=Sat
    const hour = current.getHours()

    if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) {
      hours++
    }
    current.setTime(current.getTime() + 60 * 60 * 1000) // add 1 hour
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
  const prevStartStr = prevStartDate.toISOString().split('T')[0]

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

  // === 6. Call tracking — ONLY actual calls (activity_type = 'call') ===
  const { data: calls } = await supabase
    .from('call_tracking_records')
    .select('call_type, call_start, duration_seconds, direction, caller_number, source, activity_type')
    .eq('location_id', locationId)
    .eq('activity_type', 'call')
    .gte('call_start', startDate.toISOString())
    .lte('call_start', endDate.toISOString())

  const callsArr = calls || []
  const callSummary = {
    total: callsArr.length,
    answered: callsArr.filter((c: any) => c.call_type === 'answered').length,
    missed: callsArr.filter((c: any) => c.call_type === 'missed').length,
    voicemail: callsArr.filter((c: any) => c.call_type === 'voicemail').length,
    avg_duration: 0,
    answer_rate: '0.0',
  }
  const answeredCalls = callsArr.filter((c: any) => c.call_type === 'answered')
  if (answeredCalls.length > 0) {
    callSummary.avg_duration = Math.round(
      answeredCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / answeredCalls.length
    )
  }
  if (callSummary.total > 0) {
    callSummary.answer_rate = ((callSummary.answered / callSummary.total) * 100).toFixed(1)
  }

  // Calls by hour (only actual calls)
  const callsByHour: number[] = new Array(24).fill(0)
  const missedByHour: number[] = new Array(24).fill(0)
  for (const call of callsArr) {
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
  // Get missed inbound calls
  const missedInbound = callsArr.filter(
    (c: any) => c.call_type === 'missed' && c.direction === 'inbound'
  )

  // Get all outbound calls (current period + 2 day buffer after)
  const bufferEnd = new Date(endDate)
  bufferEnd.setDate(bufferEnd.getDate() + 2)
  const { data: outboundCalls } = await supabase
    .from('call_tracking_records')
    .select('caller_number, call_start')
    .eq('location_id', locationId)
    .eq('activity_type', 'call')
    .eq('direction', 'outbound')
    .gte('call_start', startDate.toISOString())

  const outboundArr = outboundCalls || []

  // Match missed calls with subsequent outbound calls to same number
  const now = new Date()
  const unreturnedCalls: any[] = []
  let totalCallbackHours = 0
  let returnedCount = 0

  for (const missed of missedInbound) {
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

  const totalMissedInbound = missedInbound.length
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
    total_calls: callSummary.total,
    call_answer_rate: callSummary.answer_rate,
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
