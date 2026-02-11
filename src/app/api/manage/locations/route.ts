import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

// GET — list all locations for the org
export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new location
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
  }

  // Generate slug from name
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      organization_id: ORG_ID,
      name: body.name.trim(),
      slug,
      is_active: true,
      address_line1: body.address_line1 || null,
      city: body.city || null,
      state: body.state || null,
      zip_code: body.zip_code || null,
      phone: body.phone || null,
      manager_name: body.manager_name || null,
      timezone: 'America/Chicago',
      business_hours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: null,
      },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Link user to location via user_locations
  // Get the super_admin user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', ORG_ID)
    .limit(1)
    .single()

  if (user && location) {
    await supabase.from('user_locations').insert({
      user_id: user.id,
      location_id: location.id,
    }).select()
  }

  return NextResponse.json(location, { status: 201 })
}
