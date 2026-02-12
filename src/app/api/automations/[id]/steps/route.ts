import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — list steps for an automation (sorted by position)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — add a new step
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: automationId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // Get next position
  const { data: existing } = await supabase
    .from('automation_steps')
    .select('position')
    .eq('automation_id', automationId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = ((existing?.[0]?.position || 0) + 1)

  // Compute delay_seconds for wait_delay steps
  let delaySecs = body.delay_seconds || 0
  if (body.step_type === 'wait_delay' && body.step_config) {
    const amount = body.step_config.delay_amount || 0
    const unit = body.step_config.delay_unit || 'minutes'
    if (unit === 'minutes') delaySecs = amount * 60
    else if (unit === 'hours') delaySecs = amount * 3600
    else if (unit === 'days') delaySecs = amount * 86400
  }

  const { data, error } = await supabase
    .from('automation_steps')
    .insert({
      automation_id: automationId,
      step_type: body.step_type || 'send_sms',
      step_config: body.step_config || {},
      position: body.position ?? nextPosition,
      delay_seconds: delaySecs,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PUT — reorder all steps (receives array of {id, position})
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: automationId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  if (!Array.isArray(body.steps)) {
    return NextResponse.json({ error: 'steps array required' }, { status: 400 })
  }

  for (const step of body.steps) {
    await supabase
      .from('automation_steps')
      .update({ position: step.position })
      .eq('id', step.id)
      .eq('automation_id', automationId)
  }

  return NextResponse.json({ success: true })
}
