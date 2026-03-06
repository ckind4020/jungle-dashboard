import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.META_ADS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  const { location_number, data } = body

  if (!location_number || !data) {
    return NextResponse.json(
      { error: 'Missing required fields: location_number, data' },
      { status: 400 }
    )
  }

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('location_number', location_number)
    .single()

  if (!location) {
    return NextResponse.json(
      { error: `Location not found: ${location_number}` },
      { status: 404 }
    )
  }

  const locationId = location.id

  try {
    const rows = Array.isArray(data) ? data : [data]

    let upserted = 0
    for (const row of rows) {
      const date = row.date
      const campaignName = row.campaign_name ?? row.campaignName ?? row.campaign ?? 'Unknown Campaign'
      const spend = Number(row.spend ?? row.amount_spent ?? 0)
      const impressions = Number(row.impressions ?? 0)
      const clicks = Number(row.clicks ?? row.link_clicks ?? 0)
      const conversions = Number(row.conversions ?? row.results ?? row.leads ?? 0)

      const record = {
        location_id: locationId,
        date,
        source: 'meta',
        campaign_name: campaignName,
        spend,
        impressions,
        clicks,
        conversions,
        cpa: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
        roas: row.roas ? Number(row.roas) : null,
      }

      // Delete existing record for this date + campaign (dedup)
      await supabase
        .from('ad_spend_daily')
        .delete()
        .eq('location_id', locationId)
        .eq('date', date)
        .eq('source', 'meta')
        .eq('campaign_name', campaignName)

      const { error } = await supabase
        .from('ad_spend_daily')
        .insert(record)

      if (error) throw error
      upserted++
    }

    return NextResponse.json({ success: true, upserted })
  } catch (err: any) {
    console.error('Meta Ads webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
