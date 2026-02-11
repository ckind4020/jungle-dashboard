import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/leads/[id] — full lead detail with activity timeline
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, position ),
      locations ( id, name )
    `)
    .eq('id', id)
    .single()

  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Get activity timeline
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get available stages for this location (for the stage dropdown)
  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, name, color, position')
    .eq('location_id', lead.location_id)
    .order('position')

  return NextResponse.json({
    lead,
    activities: activities || [],
    stages: stages || [],
  })
}

// PATCH /api/leads/[id] — update lead fields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // If changing stage, log it
  if (body.stage_id) {
    const { data: oldLead } = await supabase
      .from('leads')
      .select('stage_id, lead_stages!leads_stage_id_fkey(name)')
      .eq('id', id)
      .single()

    const { data: newStage } = await supabase
      .from('lead_stages')
      .select('name')
      .eq('id', body.stage_id)
      .single()

    if (oldLead && newStage) {
      await supabase.from('activity_logs').insert({
        lead_id: id,
        activity_type: 'stage_change',
        notes: `Stage changed from "${(oldLead as any).lead_stages?.name || 'Unknown'}" to "${newStage.name}"`,
      })

      // Auto-enroll in matching automations (stage_changed trigger)
      const { data: leadForLocation } = await supabase.from('leads').select('location_id').eq('id', id).single()
      if (leadForLocation) {
        const { data: matchingAutos } = await supabase
          .from('automations')
          .select('id, trigger_config')
          .eq('location_id', leadForLocation.location_id)
          .eq('is_active', true)
          .eq('trigger_type', 'stage_changed')

        if (matchingAutos?.length) {
          for (const auto of matchingAutos) {
            const tc = auto.trigger_config as any
            if (tc?.to_stage_id && tc.to_stage_id !== body.stage_id) continue
            if (tc?.from_stage_id && tc.from_stage_id !== (oldLead as any).stage_id) continue

            // Check not already actively enrolled
            const { data: existingEnroll } = await supabase
              .from('automation_enrollments')
              .select('id')
              .eq('automation_id', auto.id)
              .eq('lead_id', id)
              .eq('status', 'active')
              .limit(1)

            if (existingEnroll && existingEnroll.length > 0) continue

            await supabase.from('automation_enrollments').insert({
              automation_id: auto.id,
              lead_id: id,
              current_step_order: 1,
              status: 'active',
              next_execution_at: new Date().toISOString(),
            })

            await supabase.from('activity_logs').insert({
              lead_id: id,
              activity_type: 'automation_enrolled',
              notes: `Auto-enrolled in automation (stage changed to "${newStage.name}")`,
            })
          }
        }
      }
    }
  }

  // If archiving
  if (body.is_archived === true) {
    await supabase.from('activity_logs').insert({
      lead_id: id,
      activity_type: 'lead_archived',
      notes: 'Lead archived',
    })
  }

  // If converting
  if (body.converted_at) {
    await supabase.from('activity_logs').insert({
      lead_id: id,
      activity_type: 'lead_converted',
      notes: 'Lead converted to enrolled student',
    })
  }

  const allowedFields = [
    'first_name', 'last_name', 'email', 'phone', 'stage_id',
    'score', 'is_archived', 'converted_at',
    'utm_source', 'utm_medium', 'utm_campaign',
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // phone_normalized is a generated column — no manual update needed

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, position )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/leads/[id]?action=note — add a note
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const supabase = createServiceClient()

  if (action === 'note') {
    const body = await request.json()
    const { error } = await supabase.from('activity_logs').insert({
      lead_id: id,
      activity_type: 'note',
      notes: body.notes,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
