import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

function calculateOverdue(item: any) {
  const now = new Date()
  const created = new Date(item.created_at)
  const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

  // For follow_up type: overdue = days past follow_up_date
  if (item.action_type === 'follow_up' && item.lead?.follow_up_date) {
    const followUp = new Date(item.lead.follow_up_date)
    const daysPast = Math.floor((now.getTime() - followUp.getTime()) / (1000 * 60 * 60 * 24))
    return {
      overdue_days: Math.max(0, daysPast),
      overdue_level: daysPast >= 2 ? 'critical' : daysPast >= 1 ? 'warning' : daysPast === 0 ? 'due_today' : 'none',
    }
  }

  // For call_back type: overdue same day if not actioned
  if (item.action_type === 'call_back') {
    return {
      overdue_days: Math.max(0, daysSinceCreated),
      overdue_level: daysSinceCreated >= 2 ? 'critical' : daysSinceCreated >= 1 ? 'warning' : 'due_today',
    }
  }

  // For general items: overdue after 3 days
  return {
    overdue_days: Math.max(0, daysSinceCreated - 3),
    overdue_level: daysSinceCreated >= 5 ? 'critical' : daysSinceCreated >= 3 ? 'warning' : 'none',
  }
}

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

  // Get lead data for items that have lead_id
  const leadIds = [...new Set((items || []).filter(i => i.lead_id).map(i => i.lead_id))]
  let leadsMap: Record<string, any> = {}

  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from('leads')
      .select(`
        id, first_name, last_name, phone, email, source, location_id,
        follow_up_date, last_contact_at, last_contact_type,
        lead_stages!leads_stage_id_fkey ( name )
      `)
      .in('id', leadIds)

    if (leads) {
      for (const lead of leads) {
        leadsMap[lead.id] = {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          location_id: lead.location_id,
          stage_name: (lead as any).lead_stages?.name || null,
          follow_up_date: lead.follow_up_date,
          last_contact_at: lead.last_contact_at,
        }
      }
    }
  }

  // Enrich items with location names, lead data, and overdue calculation
  const enriched = (items || []).map(item => {
    const lead = item.lead_id ? leadsMap[item.lead_id] || null : null
    const itemWithLead = { ...item, lead }
    const { overdue_days, overdue_level } = calculateOverdue(itemWithLead)
    return {
      ...item,
      location_name: locations?.find(l => l.id === item.location_id)?.name || 'Unknown',
      lead,
      overdue_days,
      overdue_level,
    }
  })

  // Sort: overdue items first (by overdue_days desc), then by priority, then by created_at
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  enriched.sort((a, b) => {
    // Overdue items first
    if (b.overdue_days !== a.overdue_days) return b.overdue_days - a.overdue_days
    const pa = priorityOrder[a.priority] ?? 4
    const pb = priorityOrder[b.priority] ?? 4
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Build summary counts
  const byActionType: Record<string, number> = {}
  let overdueCount = 0
  for (const item of enriched) {
    const at = item.action_type || 'general'
    byActionType[at] = (byActionType[at] || 0) + 1
    if (item.overdue_days > 0) overdueCount++
  }

  const summary = {
    total: enriched.length,
    critical: enriched.filter(i => i.priority === 'critical').length,
    high: enriched.filter(i => i.priority === 'high').length,
    medium: enriched.filter(i => i.priority === 'medium').length,
    low: enriched.filter(i => i.priority === 'low').length,
    overdue_count: overdueCount,
    by_action_type: byActionType,
    by_category: Object.entries(
      enriched.reduce((acc: any, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc }, {})
    ).map(([category, count]) => ({ category, count })),
  }

  return NextResponse.json({ items: enriched, summary })
}

export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { id, action } = body

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  }

  // Get the action item first
  const { data: item, error: fetchError } = await supabase
    .from('action_items')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Action item not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (action === 'complete') {
    // Mark resolved
    await supabase
      .from('action_items')
      .update({ status: 'resolved', updated_at: now })
      .eq('id', id)

    // If there's a lead_id, update lead contact info and log activity
    if (item.lead_id) {
      const contactType = item.action_type === 'call_back' ? 'call_outbound' :
                          item.action_type === 'send_email' ? 'email_sent' :
                          item.action_type === 'follow_up' ? 'call_outbound' : null

      const leadUpdates: any = {
        last_contact_at: now,
      }
      if (contactType) leadUpdates.last_contact_type = contactType

      // Clear follow_up_date if this was a follow_up action
      if (item.action_type === 'follow_up') {
        leadUpdates.follow_up_date = null
      }

      await supabase
        .from('leads')
        .update(leadUpdates)
        .eq('id', item.lead_id)

      // Log activity
      await supabase.from('activity_logs').insert({
        lead_id: item.lead_id,
        activity_type: contactType || 'note',
        notes: `Action completed: ${item.title}`,
      })
    }
  } else if (action === 'snooze') {
    // Push to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await supabase
      .from('action_items')
      .update({ updated_at: now })
      .eq('id', id)

    // If there's a lead with a follow_up_date, push it too
    if (item.lead_id) {
      await supabase
        .from('leads')
        .update({ follow_up_date: tomorrowStr })
        .eq('id', item.lead_id)
    }
  } else if (action === 'skip') {
    await supabase
      .from('action_items')
      .update({ status: 'dismissed', updated_at: now })
      .eq('id', id)
  } else if (action === 'in_progress') {
    await supabase
      .from('action_items')
      .update({ status: 'in_progress', updated_at: now })
      .eq('id', id)
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
