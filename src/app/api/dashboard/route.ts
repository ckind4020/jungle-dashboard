import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  // Get all active locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, slug')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)
    .order('name')

  if (!locations) return NextResponse.json({ error: 'No locations found' }, { status: 404 })

  // Get today's KPI snapshot for each location — fall back to most recent day
  let { data: todayKpis } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('date', new Date().toISOString().split('T')[0])
    .in('location_id', locations.map(l => l.id))

  if (!todayKpis || todayKpis.length === 0) {
    // No data for today — get the most recent date that has data
    const { data: latestRow } = await supabase
      .from('kpi_daily')
      .select('date')
      .in('location_id', locations.map(l => l.id))
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestRow) {
      const { data: fallback } = await supabase
        .from('kpi_daily')
        .select('*')
        .eq('date', latestRow.date)
        .in('location_id', locations.map(l => l.id))
      todayKpis = fallback
    }
  }

  // Get 7-day aggregates per location
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const { data: weekKpis } = await supabase
    .from('kpi_daily')
    .select('location_id, new_leads, leads_enrolled, revenue_collected, total_ad_spend, cost_per_lead')
    .gte('date', sevenDaysAgoStr)
    .in('location_id', locations.map(l => l.id))

  // Get 30-day trends for charts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: trends } = await supabase
    .from('kpi_daily')
    .select('date, location_id, new_leads, active_students, revenue_collected, compliance_score, total_ad_spend, cost_per_lead, gbp_overall_rating, missed_call_rate')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locations.map(l => l.id))
    .order('date')

  // Drive backlog across all locations
  const { data: allBacklog } = await supabase
    .from('students')
    .select('location_id, lessons_remaining')
    .eq('status', 'active')
    .in('location_id', locations.map(l => l.id))

  // Build per-location summaries
  const locationSummaries = locations.map(loc => {
    const today = todayKpis?.find(k => k.location_id === loc.id)
    const weekData = weekKpis?.filter(k => k.location_id === loc.id) || []
    const sum = (arr: Record<string, unknown>[], field: string) => arr.reduce((s, r) => s + Number(r[field] || 0), 0)

    return {
      id: loc.id,
      name: loc.name,
      slug: loc.slug,
      active_students: today?.active_students || 0,
      new_leads_7d: sum(weekData, 'new_leads'),
      contact_rate: Number(today?.contact_rate || 0),
      missed_call_rate: Number(today?.missed_call_rate || 0),
      compliance_score: Number(today?.compliance_score || 0),
      gbp_rating: Number(today?.gbp_overall_rating || 0),
      gbp_unreplied_reviews: today?.gbp_unreplied_reviews || 0,
      revenue_collected_7d: sum(weekData, 'revenue_collected'),
      ad_spend_7d: sum(weekData, 'total_ad_spend'),
      cost_per_lead: Number(today?.cost_per_lead || 0),
      drive_backlog: (allBacklog?.filter(s => s.location_id === loc.id) || [])
        .reduce((sum, s) => sum + (s.lessons_remaining || 0), 0),
    }
  })

  // Build network totals
  const totals = {
    total_active_students: locationSummaries.reduce((s, l) => s + l.active_students, 0),
    total_new_leads_7d: locationSummaries.reduce((s, l) => s + l.new_leads_7d, 0),
    avg_contact_rate: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.contact_rate, 0) / locationSummaries.length : 0,
    avg_compliance_score: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.compliance_score, 0) / locationSummaries.length : 0,
    avg_gbp_rating: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.gbp_rating, 0) / locationSummaries.length : 0,
    total_revenue_7d: locationSummaries.reduce((s, l) => s + l.revenue_collected_7d, 0),
    total_ad_spend_7d: locationSummaries.reduce((s, l) => s + l.ad_spend_7d, 0),
    total_unreplied_reviews: locationSummaries.reduce((s, l) => s + l.gbp_unreplied_reviews, 0),
  }

  // Enrich trends with location names
  const enrichedTrends = (trends || []).map(t => ({
    ...t,
    location_name: locations.find(l => l.id === t.location_id)?.name || 'Unknown'
  }))

  return NextResponse.json({ locations: locationSummaries, totals, trends: enrichedTrends, updated_at: new Date().toISOString() })
}
