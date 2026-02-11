import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = await params
  const supabase = createServiceClient()

  // Location profile (all columns)
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (locError || !location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Integration syncs — get LATEST sync per source
  const { data: allSyncs } = await supabase
    .from('integration_syncs')
    .select('*')
    .eq('location_id', locationId)
    .order('completed_at', { ascending: false })

  // Deduplicate: keep only the most recent per source
  const latestSyncs: any[] = []
  const seenSources = new Set()
  for (const sync of (allSyncs || [])) {
    if (!seenSources.has(sync.source)) {
      seenSources.add(sync.source)
      latestSyncs.push(sync)
    }
  }

  // Action items count
  const { data: actionItems } = await supabase
    .from('action_items')
    .select('priority')
    .eq('location_id', locationId)
    .in('status', ['open', 'in_progress'])

  const actionCounts = {
    critical: (actionItems || []).filter((a: any) => a.priority === 'critical').length,
    high: (actionItems || []).filter((a: any) => a.priority === 'high').length,
    medium: (actionItems || []).filter((a: any) => a.priority === 'medium').length,
    low: (actionItems || []).filter((a: any) => a.priority === 'low').length,
    total: (actionItems || []).length,
  }

  // Today's KPI — fall back to most recent day with data
  const today = new Date().toISOString().split('T')[0]
  let todayKpi = null
  const { data: kpiData } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single()
  if (kpiData) todayKpi = kpiData

  // Quick stats
  const { data: activeStudents } = await supabase
    .from('students')
    .select('id, lessons_remaining')
    .eq('location_id', locationId)
    .eq('status', 'active')

  const outstandingDrives = (activeStudents || []).reduce((sum: number, s: any) => sum + (s.lessons_remaining || 0), 0)

  const { data: upcomingClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'in_progress'])

  const { data: openLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_archived', false)
    .is('converted_at', null)

  const { data: unrepliedReviews } = await supabase
    .from('gbp_reviews')
    .select('id')
    .eq('location_id', locationId)
    .eq('has_reply', false)

  // Custom field definitions
  const { data: fieldDefs } = await supabase
    .from('location_field_definitions')
    .select('*')
    .eq('organization_id', location.organization_id)
    .eq('is_active', true)
    .order('field_group')
    .order('display_order')

  // Custom field values for this location
  const { data: fieldValues } = await supabase
    .from('location_field_values')
    .select('*')
    .eq('location_id', locationId)

  return NextResponse.json({
    location,
    integrations: latestSyncs,
    action_items_count: actionCounts,
    today_kpi: todayKpi,
    quick_stats: {
      active_students: (activeStudents || []).length,
      outstanding_drives: outstandingDrives,
      upcoming_classes: (upcomingClasses || []).length,
      open_leads: (openLeads || []).length,
      unreplied_reviews: (unrepliedReviews || []).length,
      compliance_score: Number(todayKpi?.compliance_score || 100),
    },
    field_definitions: fieldDefs || [],
    field_values: fieldValues || [],
  })
}

// PATCH — update location settings
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const allowedFields = [
    'name', 'address_line1', 'address_line2', 'city', 'state', 'zip_code',
    'phone', 'email', 'timezone', 'manager_name', 'manager_email', 'manager_phone',
    'business_hours', 'google_place_id', 'google_ads_customer_id', 'meta_ad_account_id',
    'ctm_account_id', 'gbp_location_id', 'driveato_location_id', 'ghl_location_id',
    'notes', 'logo_url', 'opened_date',
    // Franchise core fields (migration 008)
    'location_number', 'franchise_status', 'sign_date', 'go_live_date', 'expedition_date',
    'franchise_owners', 'franchise_operator_name', 'franchise_operator_phone',
    'franchise_operator_email', 'assigned_support_partner', 'location_url',
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', locationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Handle custom field values
  if (body.custom_fields && typeof body.custom_fields === 'object') {
    for (const [fieldId, value] of Object.entries(body.custom_fields)) {
      const isJson = typeof value === 'object' && value !== null

      const { error: valError } = await supabase
        .from('location_field_values')
        .upsert({
          location_id: locationId,
          field_id: fieldId,
          value: isJson ? null : String(value ?? ''),
          value_json: isJson ? value : null,
        }, {
          onConflict: 'location_id,field_id',
        })

      if (valError) {
        console.error(`Failed to save field ${fieldId}:`, valError)
      }
    }
  }

  if (Object.keys(updates).length === 0 && !body.custom_fields) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
