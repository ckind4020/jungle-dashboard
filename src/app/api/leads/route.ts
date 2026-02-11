import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/leads?location_id=xxx&stage_id=xxx&source=xxx&search=xxx&page=1&limit=25
export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)

  const locationId = searchParams.get('location_id')
  const stageId = searchParams.get('stage_id')
  const source = searchParams.get('source')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = (page - 1) * limit

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('leads')
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, position )
    `, { count: 'exact' })
    .eq('location_id', locationId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stageId) query = query.eq('stage_id', stageId)
  if (source) query = query.eq('source', source)
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also fetch stages for this location (for filters)
  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, name, color, position')
    .eq('location_id', locationId)
    .order('position')

  return NextResponse.json({
    leads: data || [],
    stages: stages || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

// POST /api/leads — create a new lead
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.location_id || !body.first_name || !body.last_name) {
    return NextResponse.json({ error: 'location_id, first_name, and last_name are required' }, { status: 400 })
  }

  // Normalize phone for duplicate detection (phone_normalized is a generated column in DB)
  const phoneNormalized = body.phone
    ? body.phone.replace(/\D/g, '').slice(-10)
    : null

  // Check for duplicates (same location, same normalized phone or same email)
  if ((phoneNormalized || body.email) && !body.force) {
    let dupQuery = supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone')
      .eq('location_id', body.location_id)
      .eq('is_archived', false)

    if (phoneNormalized && body.email) {
      dupQuery = dupQuery.or(`phone_normalized.eq.${phoneNormalized},email.eq.${body.email}`)
    } else if (phoneNormalized) {
      dupQuery = dupQuery.eq('phone_normalized', phoneNormalized)
    } else if (body.email) {
      dupQuery = dupQuery.eq('email', body.email)
    }

    const { data: duplicates } = await dupQuery
    if (duplicates && duplicates.length > 0) {
      return NextResponse.json({
        error: 'Possible duplicate lead found',
        duplicates,
      }, { status: 409 })
    }
  }

  // Get the default stage (is_default = true) for this location
  const { data: newStage } = await supabase
    .from('lead_stages')
    .select('id')
    .eq('location_id', body.location_id)
    .eq('is_default', true)
    .single()

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      location_id: body.location_id,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      source: body.source || 'manual_entry',
      stage_id: newStage?.id || null,
      score: body.score || 0,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    })
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, position )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_logs').insert({
    lead_id: lead.id,
    activity_type: 'lead_created',
    notes: `Lead created via dashboard (source: ${body.source || 'manual_entry'})`,
  })

  return NextResponse.json(lead, { status: 201 })
}
