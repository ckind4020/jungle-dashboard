import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — single automation with steps and enrollment counts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: automation, error } = await supabase
    .from('automations')
    .select(`
      *,
      automation_steps ( * ),
      automation_enrollments ( id, status, lead_id, current_step_order, next_execution_at,
        leads ( id, first_name, last_name, email, phone )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  // Sort steps by position
  if (automation.automation_steps) {
    automation.automation_steps.sort((a: any, b: any) => a.position - b.position)
  }

  // Get location's stages (for stage_changed trigger and change_stage step)
  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, name, color, position')
    .eq('location_id', automation.location_id)
    .order('position')

  return NextResponse.json({ automation, stages: stages || [] })
}

// PATCH — update automation fields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const allowedFields = ['name', 'description', 'trigger_type', 'trigger_config', 'filter_conditions', 'is_active']
  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — delete automation and all related data
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Delete in order: logs → enrollments → steps → automation
  const { data: enrollments } = await supabase
    .from('automation_enrollments')
    .select('id')
    .eq('automation_id', id)

  if (enrollments?.length) {
    const enrollmentIds = enrollments.map((e: any) => e.id)
    await supabase.from('automation_logs').delete().in('enrollment_id', enrollmentIds)
  }
  await supabase.from('automation_enrollments').delete().eq('automation_id', id)
  await supabase.from('automation_steps').delete().eq('automation_id', id)

  const { error } = await supabase.from('automations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
