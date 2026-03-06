# CLAUDE CODE TASK 12 — GBP Integration (Make.com → Webhook)

> Read this ENTIRE document before making changes.
> Also read PROJECT_BRIEF.md for schema context.
> No migration needed — `gbp_metrics_daily` and `gbp_reviews` tables already exist (migration 003).

---

## CRITICAL SCHEMA NOTES

| Table | Columns |
|-------|---------|
| `gbp_metrics_daily` | location_id, date, overall_rating, total_review_count, search_views, maps_views, total_views, website_clicks, phone_calls, direction_requests, booking_clicks, photo_views |
| `gbp_reviews` | location_id, gbp_review_id, reviewer_name, **star_rating** (not rating), review_text, **review_date** (not published_at), reply_text, reply_date, **has_reply** (boolean), sentiment, tags |

**GOTCHAS:**
- GBP rating lives in `gbp_metrics_daily`, NOT in a `gbp_locations` table
- `gbp_reviews` uses `review_date` not `published_at`
- `gbp_reviews` uses `star_rating` not `rating`
- `gbp_reviews` uses `has_reply` (boolean) not checking reply_text IS NULL
- `gbp_review_id` is the deduplication key (Google's review ID)

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## OVERVIEW

**Architecture:**
```
Google Business Profile API
        ↓
   Make.com Scenario (scheduled)
        ↓ HTTP POST
   /api/webhooks/gbp  (our webhook)
        ↓
   Supabase tables (gbp_metrics_daily, gbp_reviews)
        ↓
   Dashboard Lite reads from tables
```

**What we're building:**
1. **Webhook endpoint** — `/api/webhooks/gbp` that receives metrics + reviews from Make.com
2. **Enhanced Dashboard API** — Add GBP metrics trend + discovery stats to `/api/dashboard/[locationId]`
3. **Enhanced GBP dashboard section** — Expand GbpCard with discovery metrics (search views, maps views, clicks, direction requests, photo views)

---

## PART 1: WEBHOOK ENDPOINT — `/api/webhooks/gbp/route.ts`

### Authentication

Use a shared secret passed as a query parameter or header. Store in env:

```
GBP_WEBHOOK_SECRET=jungle-gbp-2024-secure
```

The Make.com scenario will POST to:
```
https://jungle-dashboard.vercel.app/api/webhooks/gbp?secret=jungle-gbp-2024-secure
```

### Endpoint Logic

The webhook accepts two payload types: `metrics` and `reviews`.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Auth check
  if (secret !== process.env.GBP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  // Determine payload type
  const { type, location_number, data } = body

  if (!type || !location_number || !data) {
    return NextResponse.json(
      { error: 'Missing required fields: type, location_number, data' },
      { status: 400 }
    )
  }

  // Look up location by location_number (e.g., "JUNGLE-101")
  const { data: location, error: locError } = await supabase
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
  // data can be a single object or array of daily metric objects
  const rows = Array.isArray(data) ? data : [data]

  let upserted = 0
  for (const row of rows) {
    const record = {
      location_id: locationId,
      date: row.date, // YYYY-MM-DD
      overall_rating: row.overall_rating ?? row.averageRating ?? null,
      total_review_count: row.total_review_count ?? row.totalReviewCount ?? null,
      search_views: row.search_views ?? row.searchViews ?? row.QUERIES_DIRECT + row.QUERIES_INDIRECT ?? null,
      maps_views: row.maps_views ?? row.mapsViews ?? row.VIEWS_MAPS ?? null,
      total_views: row.total_views ?? row.totalViews ?? null,
      website_clicks: row.website_clicks ?? row.websiteClicks ?? row.ACTIONS_WEBSITE ?? null,
      phone_calls: row.phone_calls ?? row.phoneCalls ?? row.ACTIONS_PHONE ?? null,
      direction_requests: row.direction_requests ?? row.directionRequests ?? row.ACTIONS_DRIVING_DIRECTIONS ?? null,
      booking_clicks: row.booking_clicks ?? row.bookingClicks ?? null,
      photo_views: row.photo_views ?? row.photoViews ?? row.PHOTOS_VIEWS_MERCHANT ?? null,
    }

    // Upsert on (location_id, date) — need unique constraint
    // Use delete + insert pattern since gbp_metrics_daily may not have a unique constraint
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
  // data is an array of review objects
  const reviews = Array.isArray(data) ? data : [data]

  let upserted = 0
  let skipped = 0

  for (const review of reviews) {
    const reviewId = review.gbp_review_id ?? review.reviewId ?? review.name // Google review resource name

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

    // Check if review exists
    const { data: existing } = await supabase
      .from('gbp_reviews')
      .select('id')
      .eq('gbp_review_id', reviewId)
      .eq('location_id', locationId)
      .maybeSingle()

    if (existing) {
      // Update existing review (may have new reply)
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
      // Insert new review
      const { error } = await supabase
        .from('gbp_reviews')
        .insert(record)
      if (error) throw error
    }
    upserted++
  }

  return NextResponse.json({ success: true, upserted, skipped })
}

// Helper: Google API returns "FIVE", "FOUR", etc. — convert to number
function mapRating(rating: string | number | undefined): number | null {
  if (typeof rating === 'number') return rating
  const map: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5
  }
  return map[rating?.toUpperCase() ?? ''] ?? null
}
```

### Payload Examples

**Metrics payload (from Make.com):**
```json
{
  "type": "metrics",
  "location_number": "JUNGLE-101",
  "data": {
    "date": "2025-02-24",
    "overall_rating": 4.6,
    "total_review_count": 142,
    "search_views": 1250,
    "maps_views": 890,
    "total_views": 2140,
    "website_clicks": 67,
    "phone_calls": 23,
    "direction_requests": 45,
    "booking_clicks": 12,
    "photo_views": 334
  }
}
```

**Reviews payload (from Make.com):**
```json
{
  "type": "reviews",
  "location_number": "JUNGLE-101",
  "data": [
    {
      "gbp_review_id": "accounts/123/locations/456/reviews/789",
      "reviewer_name": "Sarah M.",
      "star_rating": 5,
      "review_text": "Great experience! The instructor was very patient...",
      "review_date": "2025-02-20T14:30:00Z",
      "reply_text": "Thank you Sarah! We're glad you had a great experience.",
      "reply_date": "2025-02-21T09:00:00Z",
      "has_reply": true
    },
    {
      "gbp_review_id": "accounts/123/locations/456/reviews/790",
      "reviewer_name": "Mike T.",
      "star_rating": 4,
      "review_text": "Good instruction but parking was hard to find.",
      "review_date": "2025-02-22T10:15:00Z",
      "has_reply": false
    }
  ]
}
```

---

## PART 2: ENHANCED DASHBOARD API

Update `/api/dashboard/[locationId]/route.ts` to include:

### 2A: GBP Metrics Trend (for chart)

Add this query alongside the existing GBP section:

```typescript
// GBP metrics trend (for discovery chart)
const { data: gbpTrend } = await supabase
  .from('gbp_metrics_daily')
  .select('date, search_views, maps_views, total_views, website_clicks, phone_calls, direction_requests, photo_views')
  .eq('location_id', locationId)
  .gte('date', startStr)
  .lte('date', endStr)
  .order('date')

// GBP period totals
const gbpTotals = (gbpTrend || []).reduce((acc, row) => ({
  search_views: acc.search_views + (row.search_views || 0),
  maps_views: acc.maps_views + (row.maps_views || 0),
  total_views: acc.total_views + (row.total_views || 0),
  website_clicks: acc.website_clicks + (row.website_clicks || 0),
  phone_calls: acc.phone_calls + (row.phone_calls || 0),
  direction_requests: acc.direction_requests + (row.direction_requests || 0),
  photo_views: acc.photo_views + (row.photo_views || 0),
}), {
  search_views: 0, maps_views: 0, total_views: 0,
  website_clicks: 0, phone_calls: 0, direction_requests: 0, photo_views: 0,
})
```

### 2B: Add to response object

```typescript
return NextResponse.json({
  // ... existing fields ...
  gbp_trend: gbpTrend || [],
  gbp_totals: gbpTotals,
})
```

---

## PART 3: ENHANCED GBP DASHBOARD SECTION

Replace the existing simple GbpCard with a full GBP section. This should be a significant expansion.

### Layout

```
═══ Google Business Profile ══════════════════════════════════════

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ ⭐ Rating │  │ Reviews  │  │ Search   │  │ Actions  │
│   4.6    │  │   142    │  │ Views    │  │   135    │
│          │  │ 3 unread │  │  2,140   │  │ clicks+  │
│          │  │          │  │          │  │ calls+dir│
└──────────┘  └──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────────────────────────┐
│  Discovery Over Time                                         │
│  [Line chart — Search Views (blue) + Maps Views (green)]    │
│  X axis: dates, Y axis: views                               │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐ ┌────────────────────────────┐
│  Customer Actions (period)    │ │  Recent Reviews            │
│                               │ │                            │
│  🌐 Website Clicks:    67    │ │  ⭐⭐⭐⭐⭐ Sarah M. — 2/20  │
│  📞 Phone Calls:       23    │ │  "Great experience..."     │
│  🗺️ Direction Requests: 45   │ │  ✅ Replied                │
│  📸 Photo Views:       334   │ │                            │
│  📅 Booking Clicks:    12    │ │  ⭐⭐⭐⭐ Mike T. — 2/22     │
│                               │ │  "Good instruction but..." │
│                               │ │  ⚠️ Needs Reply            │
└───────────────────────────────┘ └────────────────────────────┘
```

### Component: `GbpSection.tsx`

This replaces `GbpCard.tsx` with a more comprehensive section. Build as a single component that takes all GBP data from the dashboard API.

```typescript
interface GbpSectionProps {
  gbp: {
    overall_rating: number | null
    total_review_count: number
    search_views: number
    maps_views: number
    website_clicks: number
    phone_calls: number
  } | null
  gbpTotals: {
    search_views: number
    maps_views: number
    total_views: number
    website_clicks: number
    phone_calls: number
    direction_requests: number
    photo_views: number
  }
  gbpTrend: Array<{
    date: string
    search_views: number
    maps_views: number
    total_views: number
    website_clicks: number
    phone_calls: number
    direction_requests: number
    photo_views: number
  }>
  recentReviews: Array<{
    reviewer_name: string
    star_rating: number
    review_text: string
    review_date: string
    has_reply: boolean
  }>
  unrepliedCount: number
}
```

**Sub-sections:**

1. **4 KPI mini-cards** across the top:
   - Rating (⭐ + number, total reviews as subtext)
   - Reviews (total count, unreplied as red badge)
   - Search Views (period total from gbpTotals)
   - Customer Actions (website_clicks + phone_calls + direction_requests combined)

2. **Discovery trend chart** (Recharts `LineChart`):
   - Two lines: Search Views (blue `#4285F4`) and Maps Views (green `#34A853`)
   - X axis: dates
   - Y axis: view count
   - Tooltip with both values
   - If no data: "No GBP metrics yet. Connect Google Business Profile via Make.com."

3. **Customer Actions card** (left side):
   - Simple stat list with icons:
     - 🌐 Website Clicks
     - 📞 Phone Calls (from GBP)
     - 🗺️ Direction Requests
     - 📸 Photo Views
     - 📅 Booking Clicks
   - All values are period totals from `gbpTotals`

4. **Recent Reviews card** (right side):
   - Same as existing GbpCard review list
   - Show star rating as yellow stars
   - Reviewer name + date
   - Review text snippet (first 120 chars)
   - Green "✓ Replied" or red "⚠ Needs Reply" badge
   - If unrepliedCount > 0, show alert banner at top: "3 reviews need a reply"

### Empty State

When `gbp` is null AND `gbpTrend` is empty:
```
┌─────────────────────────────────────────────────────┐
│  📍 Google Business Profile                          │
│                                                      │
│  No GBP data yet.                                    │
│                                                      │
│  Connect your Google Business Profile through        │
│  Make.com to start tracking reviews, ratings,        │
│  and how customers discover your business.           │
│                                                      │
│  [Set Up GBP Integration →]  (links to Hub)         │
└─────────────────────────────────────────────────────┘
```

---

## PART 4: ENV VARS

Add to `.env.local` and Vercel:

```
GBP_WEBHOOK_SECRET=jungle-gbp-2024-secure
```

Generate a real secret — use this command and paste the result:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## PART 5: FILE STRUCTURE

```
src/
├── app/
│   └── api/
│       ├── webhooks/
│       │   └── gbp/
│       │       └── route.ts          # NEW — GBP webhook
│       └── dashboard/
│           └── [locationId]/
│               └── route.ts          # UPDATE — add gbp_trend + gbp_totals
├── components/
│   └── dashboard-lite/
│       ├── GbpSection.tsx            # NEW — replaces GbpCard.tsx
│       └── GbpCard.tsx               # DELETE or keep as fallback
└── app/
    └── dashboard/
        └── [locationId]/
            └── page.tsx              # UPDATE — use GbpSection instead of GbpCard
```

---

## BUILD ORDER

1. Add `GBP_WEBHOOK_SECRET` env var to `.env.local` and Vercel
2. Create webhook endpoint: `src/app/api/webhooks/gbp/route.ts`
3. Update dashboard API: add `gbp_trend` and `gbp_totals` to response
4. Create `GbpSection.tsx` component
5. Update Dashboard Lite page to use `GbpSection` instead of `GbpCard`
6. Test webhook with curl:
   ```bash
   curl -X POST "http://localhost:3000/api/webhooks/gbp?secret=YOUR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "metrics",
       "location_number": "JUNGLE-101",
       "data": {
         "date": "2025-02-24",
         "overall_rating": 4.6,
         "total_review_count": 142,
         "search_views": 1250,
         "maps_views": 890,
         "website_clicks": 67,
         "phone_calls": 23,
         "direction_requests": 45,
         "photo_views": 334
       }
     }'
   ```
7. Test review webhook
8. Verify dashboard shows GBP data
9. Push to GitHub

---

## STYLING NOTES

Match existing design system:
- Card: `bg-white rounded-xl shadow-sm border border-gray-200 p-6`
- Section header: `text-lg font-semibold text-gray-900 mb-4`
- GBP colors (Google brand):
  - Google Blue: `#4285F4`
  - Google Green: `#34A853`
  - Google Yellow: `#FBBC05` (for stars)
  - Google Red: `#EA4335` (for unreplied badge)
- Star rating: filled yellow stars (⭐ or SVG star icon)
- Review badges: green for replied, red for needs reply
- Discovery chart: blue line for search, green line for maps

---

## TESTING CHECKLIST

- [ ] Webhook rejects requests without valid secret (401)
- [ ] Webhook rejects missing fields (400)
- [ ] Webhook rejects unknown location_number (404)
- [ ] Metrics upsert correctly (no duplicates on same date)
- [ ] Reviews insert new, update existing (check reply status changes)
- [ ] Google rating formats (ONE, TWO, etc.) convert to numbers
- [ ] Dashboard API returns gbp_trend and gbp_totals
- [ ] GBP section shows 4 KPI mini-cards
- [ ] Discovery trend chart renders with data
- [ ] Customer actions card shows period totals
- [ ] Recent reviews show with star ratings and reply badges
- [ ] Unreplied review alert banner appears when count > 0
- [ ] Empty state shows when no GBP data
- [ ] Responsive layout (cards stack on mobile)
