import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/automations?location_id=xxx
export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 })
  }

  const { data: automations, error } = await supabase
    .from('automations')
    .select(`
      *,
      automation_steps ( id, step_type, position ),
      automation_enrollments ( id, status )
    `)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (automations || []).map((a: any) => ({
    ...a,
    step_count: a.automation_steps?.length || 0,
    enrolled_count: a.automation_enrollments?.filter((e: any) => e.status === 'active').length || 0,
    completed_count: a.automation_enrollments?.filter((e: any) => e.status === 'completed').length || 0,
    total_enrolled: a.automation_enrollments?.length || 0,
    automation_steps: undefined,
    automation_enrollments: undefined,
  }))

  return NextResponse.json(enriched)
}

// PATCH /api/automations — toggle active/paused
export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, any> = {}
  if ('is_active' in body) updates.is_active = body.is_active

  const { error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
