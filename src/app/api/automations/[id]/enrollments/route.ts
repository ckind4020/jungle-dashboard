import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET — list enrolled leads
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('automation_enrollments')
    .select(`
      *,
      leads ( id, first_name, last_name, email, phone )
    `)
    .eq('automation_id', id)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — manually enroll a lead
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: automationId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.lead_id) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  }

  // Check not already enrolled
  const { data: existing } = await supabase
    .from('automation_enrollments')
    .select('id')
    .eq('automation_id', automationId)
    .eq('lead_id', body.lead_id)
    .eq('status', 'active')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Lead is already enrolled in this automation' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('automation_enrollments')
    .insert({
      automation_id: automationId,
      lead_id: body.lead_id,
      current_step_order: 1,
      status: 'active',
      next_execution_at: new Date().toISOString(),
    })
    .select(`
      *,
      leads ( id, first_name, last_name, email )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
