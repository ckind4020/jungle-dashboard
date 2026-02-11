import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// PATCH — update field definition
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const allowedFields = [
    'field_name', 'field_type', 'options', 'field_group',
    'display_order', 'description', 'is_required', 'is_active',
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // If renaming, also update field_key
  if (updates.field_name && body.update_key !== false) {
    updates.field_key = updates.field_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('location_field_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — delete field definition (and all its values)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Delete values first (CASCADE should handle this, but be explicit)
  await supabase
    .from('location_field_values')
    .delete()
    .eq('field_id', id)

  const { error } = await supabase
    .from('location_field_definitions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
