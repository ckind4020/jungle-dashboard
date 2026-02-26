import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.GBP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  const { type, location_number, data } = body

  if (!type || !location_number || !data) {
    return NextResponse.json(
      { error: 'Missing required fields: type, location_number, data' },
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
    if (type === 'metrics') {
      return await handleMetrics(supabase, locationId, data)
    } else if (type === 'reviews') {
      return await handleReviews(supabase, locationId, data)
    } else {
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }
  } catch (err: any) {
    console.error('GBP webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function handleMetrics(supabase: any, locationId: string, data: any) {
  const rows = Array.isArray(data) ? data : [data]

  let upserted = 0
  for (const row of rows) {
    const record = {
      location_id: locationId,
      date: row.date,
      overall_rating: row.overall_rating ?? row.averageRating ?? null,
      total_review_count: row.total_review_count ?? row.totalReviewCount ?? null,
      search_views: row.search_views ?? row.searchViews ?? null,
      maps_views: row.maps_views ?? row.mapsViews ?? null,
      total_views: row.total_views ?? row.totalViews ?? null,
      website_clicks: row.website_clicks ?? row.websiteClicks ?? null,
      phone_calls: row.phone_calls ?? row.phoneCalls ?? null,
      direction_requests: row.direction_requests ?? row.directionRequests ?? null,
      booking_clicks: row.booking_clicks ?? row.bookingClicks ?? null,
      photo_views: row.photo_views ?? row.photoViews ?? null,
    }

    // Delete + insert pattern (no unique constraint on location_id+date)
    await supabase
      .from('gbp_metrics_daily')
      .delete()
      .eq('location_id', locationId)
      .eq('date', record.date)

    const { error } = await supabase
      .from('gbp_metrics_daily')
      .insert(record)

    if (error) throw error
    upserted++
  }

  return NextResponse.json({ success: true, upserted })
}

async function handleReviews(supabase: any, locationId: string, data: any) {
  const reviews = Array.isArray(data) ? data : [data]

  let upserted = 0
  let skipped = 0

  for (const review of reviews) {
    const reviewId = review.gbp_review_id ?? review.reviewId ?? review.name

    if (!reviewId) {
      skipped++
      continue
    }

    const record = {
      location_id: locationId,
      gbp_review_id: reviewId,
      reviewer_name: review.reviewer_name ?? review.reviewer?.displayName ?? 'Anonymous',
      star_rating: review.star_rating ?? review.starRating ?? mapRating(review.rating),
      review_text: review.review_text ?? review.comment ?? '',
      review_date: review.review_date ?? review.createTime ?? review.updateTime ?? new Date().toISOString(),
      reply_text: review.reply_text ?? review.reviewReply?.comment ?? null,
      reply_date: review.reply_date ?? review.reviewReply?.updateTime ?? null,
      has_reply: !!(review.has_reply ?? review.reply_text ?? review.reviewReply?.comment),
      sentiment: review.sentiment ?? null,
      tags: review.tags ?? null,
    }

    const { data: existing } = await supabase
      .from('gbp_reviews')
      .select('id')
      .eq('gbp_review_id', reviewId)
      .eq('location_id', locationId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('gbp_reviews')
        .update({
          reply_text: record.reply_text,
          reply_date: record.reply_date,
          has_reply: record.has_reply,
          star_rating: record.star_rating,
          review_text: record.review_text,
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('gbp_reviews')
        .insert(record)
      if (error) throw error
    }
    upserted++
  }

  return NextResponse.json({ success: true, upserted, skipped })
}

function mapRating(rating: string | number | undefined): number | null {
  if (typeof rating === 'number') return rating
  const map: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  }
  return map[rating?.toUpperCase() ?? ''] ?? null
}
