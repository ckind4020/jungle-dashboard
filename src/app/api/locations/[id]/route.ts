import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id: locationId } = await params

  // Location info
  const { data: location } = await supabase
    .from('locations')
    .select('id, name, slug, organization_id, is_active')
    .eq('id', locationId)
    .single()

  if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Today's KPI — fall back to most recent day if today has no data
  let { data: todayKpi } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .eq('date', today)
    .maybeSingle()

  if (!todayKpi) {
    const { data: latestKpi } = await supabase
      .from('kpi_daily')
      .select('*')
      .eq('location_id', locationId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    todayKpi = latestKpi
  }

  // 30-day trends
  const { data: trends } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date')

  // Students
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, status, program_type, total_lessons_purchased, lessons_completed, lessons_remaining, classroom_hours_completed, classroom_hours_remaining, balance_due, enrolled_at')
    .eq('location_id', locationId)
    .in('status', ['active', 'completed'])
    .order('status')
    .order('last_name')

  // Instructors
  const { data: instructors } = await supabase
    .from('instructors')
    .select('id, first_name, last_name, status, avg_student_rating, hire_date')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('last_name')

  // Vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, make, model, year, status, mileage')
    .eq('location_id', locationId)
    .order('year', { ascending: false })

  // Compliance items
  const { data: compliance } = await supabase
    .from('compliance_items')
    .select('id, entity_type, entity_name, compliance_type, expiry_date, status, days_until_expiry')
    .eq('location_id', locationId)
    .order('days_until_expiry')

  // Recent GBP reviews (last 30 days)
  const { data: reviews } = await supabase
    .from('gbp_reviews')
    .select('id, reviewer_name, star_rating, review_text, review_date, has_reply, reply_text, sentiment')
    .eq('location_id', locationId)
    .order('review_date', { ascending: false })
    .limit(20)

  // Active/upcoming classes with capacity
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, class_type, capacity, enrolled_count, status, start_date, end_date, instructor_id')
    .eq('location_id', locationId)
    .in('status', ['in_progress', 'scheduled'])
    .order('start_date')

  // Drive backlog: active students with remaining lessons
  const { data: driveBacklog } = await supabase
    .from('students')
    .select('id, first_name, last_name, total_lessons_purchased, lessons_completed, lessons_remaining, classroom_hours_remaining')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .gt('lessons_remaining', 0)
    .order('lessons_remaining', { ascending: false })

  // Scheduled (future) drives for this location
  const { data: scheduledDrives } = await supabase
    .from('drive_appointments')
    .select('id, student_id, instructor_id, scheduled_date, scheduled_time, status')
    .eq('location_id', locationId)
    .eq('status', 'scheduled')
    .gte('scheduled_date', today)
    .order('scheduled_date')

  return NextResponse.json({
    location,
    today: todayKpi,
    trends: trends || [],
    students: students || [],
    instructors: instructors || [],
    vehicles: vehicles || [],
    compliance_items: compliance || [],
    recent_reviews: reviews || [],
    classes: classes || [],
    drive_backlog: driveBacklog || [],
    scheduled_drives: scheduledDrives || [],
  })
}
