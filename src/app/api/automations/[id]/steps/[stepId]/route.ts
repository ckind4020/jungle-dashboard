import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// PATCH — update a step
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { id: automationId, stepId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const updates: Record<string, any> = {}
  if ('step_type' in body) updates.step_type = body.step_type
  if ('step_config' in body) updates.step_config = body.step_config
  if ('position' in body) updates.position = body.position
  if ('delay_seconds' in body) updates.delay_seconds = body.delay_seconds

  // Recompute delay_seconds for wait_delay
  if (body.step_type === 'wait_delay' && body.step_config) {
    const amount = body.step_config.delay_amount || 0
    const unit = body.step_config.delay_unit || 'minutes'
    if (unit === 'minutes') updates.delay_seconds = amount * 60
    else if (unit === 'hours') updates.delay_seconds = amount * 3600
    else if (unit === 'days') updates.delay_seconds = amount * 86400
  }

  const { data, error } = await supabase
    .from('automation_steps')
    .update(updates)
    .eq('id', stepId)
    .eq('automation_id', automationId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove a step
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('automation_steps')
    .delete()
    .eq('id', stepId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
