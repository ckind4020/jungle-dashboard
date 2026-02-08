import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations) return NextResponse.json({ error: 'No locations' }, { status: 404 })
  const locationIds = locations.map(l => l.id)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  // Ad spend daily (30 days, all locations)
  const { data: adSpend } = await supabase
    .from('ad_spend_daily')
    .select('location_id, date, source, spend, impressions, clicks, conversions, cpa')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locationIds)
    .order('date')

  // GBP metrics daily (30 days)
  const { data: gbpMetrics } = await supabase
    .from('gbp_metrics_daily')
    .select('location_id, date, overall_rating, total_review_count, search_views, maps_views, website_clicks, phone_calls, direction_requests')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locationIds)
    .order('date')

  // Unreplied reviews count per location
  const { data: unrepliedReviews } = await supabase
    .from('gbp_reviews')
    .select('location_id')
    .eq('has_reply', false)
    .in('location_id', locationIds)

  // Build per-location ad spend summaries
  const adSpendByLocation = locationIds.flatMap(locId => {
    const locName = locations.find(l => l.id === locId)?.name || ''
    const locData = adSpend?.filter(a => a.location_id === locId) || []
    const sources = [...new Set(locData.map(a => a.source))]

    return sources.map(source => {
      const sourceData = locData.filter(a => a.source === source)
      return {
        location_id: locId,
        location_name: locName,
        source,
        total_spend: sourceData.reduce((s, r) => s + Number(r.spend), 0),
        total_impressions: sourceData.reduce((s, r) => s + Number(r.impressions), 0),
        total_clicks: sourceData.reduce((s, r) => s + Number(r.clicks), 0),
        total_conversions: sourceData.reduce((s, r) => s + Number(r.conversions), 0),
        avg_cpl: sourceData.length ? sourceData.reduce((s, r) => s + Number(r.cpa || 0), 0) / sourceData.length : 0,
      }
    })
  })

  // Build ad spend trends (daily, enriched with location name)
  const adSpendTrends = (adSpend || []).map(a => ({
    ...a,
    location_name: locations.find(l => l.id === a.location_id)?.name || ''
  }))

  // Build GBP summaries per location
  const gbpSummaries = locationIds.map(locId => {
    const locName = locations.find(l => l.id === locId)?.name || ''
    const locGbp = gbpMetrics?.filter(g => g.location_id === locId) || []
    const latest = locGbp[locGbp.length - 1]
    const last7 = locGbp.slice(-7)
    const avg = (arr: Record<string, unknown>[], f: string) => arr.length ? arr.reduce((s, r) => s + Number(r[f] || 0), 0) / arr.length : 0

    return {
      location_id: locId,
      location_name: locName,
      overall_rating: Number(latest?.overall_rating || 0),
      total_reviews: latest?.total_review_count || 0,
      unreplied_count: unrepliedReviews?.filter(r => r.location_id === locId).length || 0,
      avg_search_views_7d: avg(last7, 'search_views'),
      avg_maps_views_7d: avg(last7, 'maps_views'),
      avg_website_clicks_7d: avg(last7, 'website_clicks'),
    }
  })

  return NextResponse.json({
    ad_spend_by_location: adSpendByLocation,
    ad_spend_trends: adSpendTrends,
    gbp_metrics: gbpSummaries,
  })
}
