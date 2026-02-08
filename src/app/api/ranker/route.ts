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
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  // Today's snapshot — fall back to most recent day
  let { data: todayKpis } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('date', today)
    .in('location_id', locationIds)

  if (!todayKpis || todayKpis.length === 0) {
    const { data: latestRow } = await supabase
      .from('kpi_daily')
      .select('date')
      .in('location_id', locationIds)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestRow) {
      const { data: fallback } = await supabase
        .from('kpi_daily')
        .select('*')
        .eq('date', latestRow.date)
        .in('location_id', locationIds)
      todayKpis = fallback
    }
  }

  // 7-day data for aggregates
  const { data: weekKpis } = await supabase
    .from('kpi_daily')
    .select('location_id, new_leads, leads_enrolled, revenue_collected, total_ad_spend, cost_per_lead')
    .gte('date', sevenDaysAgoStr)
    .in('location_id', locationIds)

  // --- NEW: Drive backlog per location ---
  const { data: studentBacklog } = await supabase
    .from('students')
    .select('location_id, lessons_remaining')
    .eq('status', 'active')
    .in('location_id', locationIds)

  // --- NEW: Instructor utilization (completed drives last 7 days) ---
  const { data: recentDrives } = await supabase
    .from('drive_appointments')
    .select('location_id, instructor_id, status')
    .eq('status', 'completed')
    .gte('scheduled_date', sevenDaysAgoStr)
    .in('location_id', locationIds)

  const rows = locations.map(loc => {
    const today_kpi = todayKpis?.find(k => k.location_id === loc.id)
    const week = weekKpis?.filter(k => k.location_id === loc.id) || []
    const sum = (arr: Record<string, unknown>[], f: string) => arr.reduce((s, r) => s + Number(r[f] || 0), 0)
    const avg = (arr: Record<string, unknown>[], f: string) => arr.length ? sum(arr, f) / arr.length : 0

    return {
      id: loc.id,
      name: loc.name,
      active_students: today_kpi?.active_students || 0,
      new_leads_7d: sum(week, 'new_leads'),
      leads_enrolled_7d: sum(week, 'leads_enrolled'),
      contact_rate: Number(today_kpi?.contact_rate || 0),
      missed_call_rate: Number(today_kpi?.missed_call_rate || 0),
      compliance_score: Number(today_kpi?.compliance_score || 0),
      gbp_rating: Number(today_kpi?.gbp_overall_rating || 0),
      unreplied_reviews: today_kpi?.gbp_unreplied_reviews || 0,
      cost_per_lead_7d: avg(week, 'cost_per_lead'),
      revenue_7d: sum(week, 'revenue_collected'),
      ad_spend_7d: sum(week, 'total_ad_spend'),

      // Drive backlog: sum of remaining lessons for active students
      drive_backlog: (studentBacklog?.filter(s => s.location_id === loc.id) || [])
        .reduce((s, r) => s + (r.lessons_remaining || 0), 0),

      // Instructor utilization: completed drives / (instructors × 6 slots × 5 days)
      instructor_utilization: (() => {
        const locDrives = recentDrives?.filter(d => d.location_id === loc.id) || []
        const activeInstructors = today_kpi?.active_instructors || 1
        const maxCapacity = activeInstructors * 6 * 5
        return maxCapacity > 0 ? Math.round((locDrives.length / maxCapacity) * 100) : 0
      })(),

      // Revenue per student
      rev_per_student: (today_kpi?.active_students || 0) > 0
        ? sum(week, 'revenue_collected') / today_kpi.active_students
        : 0,
    }
  })

  return NextResponse.json({ rows })
}
