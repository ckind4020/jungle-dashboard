import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')
  const status = searchParams.get('status') || 'open,in_progress'

  let query = supabase
    .from('action_items')
    .select('*')
    .eq('organization_id', ORG_ID)
    .in('status', status.split(','))
    .order('created_at', { ascending: false })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: items, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get location names
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)

  const enriched = (items || []).map(item => ({
    ...item,
    location_name: locations?.find(l => l.id === item.location_id)?.name || 'Unknown',
  }))

  // Sort by priority: critical, high, medium, low
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  enriched.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 4
    const pb = priorityOrder[b.priority] ?? 4
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Build summary counts
  const summary = {
    total: enriched.length,
    critical: enriched.filter(i => i.priority === 'critical').length,
    high: enriched.filter(i => i.priority === 'high').length,
    medium: enriched.filter(i => i.priority === 'medium').length,
    low: enriched.filter(i => i.priority === 'low').length,
    by_category: Object.entries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enriched.reduce((acc: any, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc }, {})
    ).map(([category, count]) => ({ category, count })),
  }

  return NextResponse.json({ items: enriched, summary })
}

export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { id, status } = body

  const { error } = await supabase
    .from('action_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
