import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations) return NextResponse.json({ error: 'No locations' }, { status: 404 })

  // All compliance items across all locations
  const { data: items } = await supabase
    .from('compliance_items')
    .select('id, location_id, entity_type, entity_name, compliance_type, expiry_date, status, days_until_expiry')
    .in('location_id', locations.map(l => l.id))
    .order('days_until_expiry')

  // Enrich with location names + build per-location summaries
  const enrichedItems = (items || []).map(item => ({
    ...item,
    location_name: locations.find(l => l.id === item.location_id)?.name || ''
  }))

  const summaries = locations.map(loc => {
    const locItems = enrichedItems.filter(i => i.location_id === loc.id)
    return {
      location_id: loc.id,
      location_name: loc.name,
      total: locItems.length,
      current: locItems.filter(i => i.status === 'current').length,
      expiring_soon: locItems.filter(i => i.status === 'expiring_soon').length,
      expired: locItems.filter(i => i.status === 'expired').length,
      score: locItems.length ? Math.round((locItems.filter(i => i.status === 'current').length / locItems.length) * 1000) / 10 : 100,
    }
  })

  return NextResponse.json({ items: enrichedItems, summaries })
}
