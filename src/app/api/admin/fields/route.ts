import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

// GET — list all field definitions
export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('location_field_definitions')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('field_group')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new field definition
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.field_name?.trim()) {
    return NextResponse.json({ error: 'Field name is required' }, { status: 400 })
  }

  // Auto-generate field_key from name
  const fieldKey = body.field_key || body.field_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  // Get max display_order for this group
  const { data: existing } = await supabase
    .from('location_field_definitions')
    .select('display_order')
    .eq('organization_id', ORG_ID)
    .eq('field_group', body.field_group || 'General')
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = ((existing?.[0]?.display_order || 0) + 1)

  const { data, error } = await supabase
    .from('location_field_definitions')
    .insert({
      organization_id: ORG_ID,
      field_name: body.field_name.trim(),
      field_key: fieldKey,
      field_type: body.field_type || 'text',
      options: body.options || [],
      field_group: body.field_group || 'General',
      display_order: body.display_order ?? nextOrder,
      description: body.description || null,
      is_required: body.is_required || false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A field with key "${fieldKey}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
