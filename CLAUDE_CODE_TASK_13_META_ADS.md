# CLAUDE CODE TASK 13 — Meta Ads Integration (Make.com → Webhook)

> Read this ENTIRE document before making changes.
> Also read PROJECT_BRIEF.md for schema context.
> No migration needed — `ad_spend_daily` table already exists (migration 002).

---

## CRITICAL SCHEMA NOTES

| Table | Columns |
|-------|---------|
| `ad_spend_daily` | location_id, date, source (text), campaign_name, spend (numeric), impressions (integer), clicks (integer), conversions (integer), cpa (numeric), roas (numeric) |

**GOTCHAS:**
- `source` is a text field — use `'meta'` for Meta/Facebook ads
- `spend` is numeric (dollars, not cents)
- `cpa` = cost per acquisition (spend / conversions)
- `roas` = return on ad spend (revenue / spend) — may be null if no revenue tracking
- Deduplication key: (location_id, date, source, campaign_name) — use delete+insert pattern
- No unique constraint exists — must handle dedup manually

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## OVERVIEW

**Architecture:**
```
Meta Ads API (via Business Manager)
        ↓
   Make.com Scenario (daily schedule)
        ↓ HTTP POST
   /api/webhooks/meta-ads  (our webhook)
        ↓
   Supabase: ad_spend_daily table
        ↓
   Dashboard Lite reads ad spend chart + CPL table
```

**What we're building:**
1. **Webhook endpoint** — `/api/webhooks/meta-ads` that receives daily campaign data from Make.com
2. No dashboard changes needed — Dashboard Lite already reads from `ad_spend_daily` and renders the Ad Spend Chart + CPL Table

---

## PART 1: WEBHOOK ENDPOINT — `/api/webhooks/meta-ads/route.ts`

### Authentication

Use a shared secret (same pattern as GBP webhook):

```
META_ADS_WEBHOOK_SECRET=<generate-with-crypto-randomBytes>
```

### Endpoint Logic

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

  // Look up location by location_number
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
    // data can be a single campaign object or array of campaign objects
    const rows = Array.isArray(data) ? data : [data]

    let upserted = 0
    for (const row of rows) {
      const date = row.date // YYYY-MM-DD
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
```

### Payload Example

```json
{
  "location_number": "JUNGLE-101",
  "data": [
    {
      "date": "2026-03-04",
      "campaign_name": "Omaha - Teen Drivers Spring 2026",
      "spend": 45.23,
      "impressions": 2150,
      "clicks": 67,
      "conversions": 3
    },
    {
      "date": "2026-03-04",
      "campaign_name": "Omaha - Adult Lessons Retargeting",
      "spend": 22.10,
      "impressions": 890,
      "clicks": 34,
      "conversions": 1
    }
  ]
}
```

### Bulk/Summary Payload (if no campaign-level detail)

If Make.com only provides account-level daily totals:

```json
{
  "location_number": "JUNGLE-101",
  "data": {
    "date": "2026-03-04",
    "campaign_name": "All Campaigns",
    "spend": 67.33,
    "impressions": 3040,
    "clicks": 101,
    "conversions": 4
  }
}
```

---

## PART 2: ENV VARS

Add to `.env.local` and Vercel:

```
META_ADS_WEBHOOK_SECRET=<generate-secret>
```

Generate:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## PART 3: FILE STRUCTURE

```
src/
└── app/
    └── api/
        └── webhooks/
            ├── gbp/
            │   └── route.ts          # Already exists (Task 12)
            └── meta-ads/
                └── route.ts          # NEW — Meta Ads webhook
```

---

## BUILD ORDER

1. Add `META_ADS_WEBHOOK_SECRET` env var to `.env.local` and Vercel
2. Create webhook endpoint: `src/app/api/webhooks/meta-ads/route.ts`
3. Test with curl:
   ```bash
   curl -X POST "http://localhost:3000/api/webhooks/meta-ads?secret=YOUR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "location_number": "JUNGLE-101",
       "data": [
         {
           "date": "2026-03-04",
           "campaign_name": "Omaha - Teen Drivers Spring 2026",
           "spend": 45.23,
           "impressions": 2150,
           "clicks": 67,
           "conversions": 3
         }
       ]
     }'
   ```
4. Verify data appears in `ad_spend_daily` table
5. Verify Dashboard Lite Ad Spend Chart and CPL Table show the data
6. Push to GitHub

---

## TESTING CHECKLIST

- [ ] Webhook rejects requests without valid secret (401)
- [ ] Webhook rejects missing fields (400)
- [ ] Webhook rejects unknown location_number (404)
- [ ] Single campaign object inserts correctly
- [ ] Array of campaign objects all insert
- [ ] Duplicate sends don't create duplicate rows (delete+insert pattern)
- [ ] CPA calculates correctly (spend / conversions)
- [ ] CPA is null when conversions = 0
- [ ] Source is always 'meta' in the inserted rows
- [ ] Dashboard Lite Ad Spend Chart shows data
- [ ] Dashboard Lite CPL Table shows "Meta Ads" (pretty-printed from 'meta')
- [ ] KPI card shows total ad spend

---

## DASHBOARD INTEGRATION (ALREADY DONE)

No dashboard changes needed. The existing Dashboard Lite already:
- Queries `ad_spend_daily` and aggregates by source
- Shows stacked area chart (Ad Spend Over Time)
- Shows CPL table with per-source breakdown
- Pretty-prints 'meta' as "Meta Ads" in the source label map
- Shows total ad spend in the KPI cards

Once data is in `ad_spend_daily`, it automatically appears on the dashboard.
