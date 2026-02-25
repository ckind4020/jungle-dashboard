# CLAUDE_CODE_TASK_10_CTM_SYNC.md

## Task 10: CTM Call Tracking Sync

### Context
JungleOS has a `call_tracking_records` table that feeds the Dashboard Lite call tracking section. We need to pull call data from CallTrackingMetrics (CTM) API and insert it into this table. Starting with Omaha (JUNGLE-101) only.

### CTM API Info
- **Base URL:** `https://api.calltrackingmetrics.com/api/v1`
- **Auth:** Basic authentication using Access Key + Secret Key
  - Header: `Authorization: Basic <base64(access_key:secret_key)>`
- **List calls:** `GET /accounts/{account_id}/calls.json?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&page=1&per_page=100`
- **Call fields we need:** id, caller_number, tracking_number, duration, answered (bool), voicemail (bool), source, created_at/occurred_at, direction (inbound/outbound), status, recording_url

### Environment Variables (already added by user)
```
CTM_101_ACCOUNT_ID=551391
CTM_101_ACCESS_KEY=a551391db02965326fd7fe83c0a05c0750c98dc2
CTM_101_SECRET_KEY=e70214ee291cc48e538e0dfaad3c57df5815
```

### What to Build

#### 1. API Route: `/api/sync/ctm/route.ts`

**GET handler** — manual trigger to sync calls. Accepts query params:
- `loc` — location number, e.g. `JUNGLE-101` (required)
- `days` — how many days back to sync (default: 30)

**Logic:**
```
1. Look up location by location_number to get location_id (UUID)
2. Look up CTM credentials from env vars based on location number:
   - CTM_{num}_ACCOUNT_ID, CTM_{num}_ACCESS_KEY, CTM_{num}_SECRET_KEY
   - Where {num} is extracted from location_number (e.g., "101" from "JUNGLE-101")
3. Calculate date range: today - {days} days → today
4. Call CTM API to list calls, paginate through all pages
5. For each call, upsert into call_tracking_records:
   - Use ctm call ID as external_id to prevent duplicates
   - Map CTM fields → our schema
6. Return summary: { synced: N, skipped: N, errors: N }
```

**CTM API call example:**
```typescript
const accountId = process.env.CTM_101_ACCOUNT_ID;
const accessKey = process.env.CTM_101_ACCESS_KEY;
const secretKey = process.env.CTM_101_SECRET_KEY;
const basicAuth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');

const response = await fetch(
  `https://api.calltrackingmetrics.com/api/v1/accounts/${accountId}/calls.json?start_date=${startDate}&end_date=${endDate}&page=${page}&per_page=100`,
  {
    headers: {
      'Authorization': `Basic ${basicAuth}`,
    }
  }
);
const data = await response.json();
// data.calls = array of call objects
// data.total_entries = total count
// data.total_pages = number of pages
```

**Field mapping (CTM → call_tracking_records):**
```
ctm.id                  → external_id (text, for dedup)
ctm.caller_number_bare  → caller_number
ctm.tracking_number     → tracking_number  
ctm.source              → source (e.g., "Google Ads", "Yard Sign")
ctm.duration            → duration_seconds (integer)
ctm.talk_time           → talk_time_seconds (integer, if available)
ctm.answered            → answered (boolean) — CTM may use "status" field
ctm.voicemail           → voicemail (boolean)
ctm.direction           → direction ('inbound' or 'outbound')
ctm.occurred_at         → called_at (timestamptz)
ctm.recording_url       → recording_url (text, nullable)
ctm.city                → caller_city (text, nullable)
ctm.state               → caller_state (text, nullable)
location_id             → location_id (from step 1 lookup)
organization_id         → '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'
```

**Important:** The CTM API response format may vary slightly. The code should handle:
- Missing fields gracefully (null defaults)
- The `answered` field might be derived from `status` ("answered" vs "missed" vs "voicemail")
- Pagination: keep fetching while page < total_pages
- Rate limiting: add a small delay between pages if needed

#### 2. Check/create `call_tracking_records` table columns

The table should already exist from an earlier migration. Verify it has these columns. If `external_id` column doesn't exist, add it:

```sql
-- Run in Supabase SQL editor if needed
ALTER TABLE call_tracking_records 
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS recording_url text,
ADD COLUMN IF NOT EXISTS caller_city text,
ADD COLUMN IF NOT EXISTS caller_state text,
ADD COLUMN IF NOT EXISTS talk_time_seconds integer;

-- Unique constraint for dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_tracking_external_id 
ON call_tracking_records(external_id) WHERE external_id IS NOT NULL;
```

#### 3. Cron endpoint: `/api/cron/sync-ctm/route.ts`

Daily cron that syncs the last 2 days of calls for all configured locations.

**Logic:**
```
1. Scan env vars to find all CTM_*_ACCOUNT_ID entries
2. For each, extract location number and sync last 2 days
3. Log results
```

**Add to vercel.json crons:**
```json
{
  "path": "/api/cron/sync-ctm",
  "schedule": "0 6 * * *"
}
```
This runs at 6 AM UTC (midnight CST) daily.

### File Summary

| File | Type | Description |
|------|------|-------------|
| `src/app/api/sync/ctm/route.ts` | API Route | Manual CTM sync endpoint with loc + days params |
| `src/app/api/cron/sync-ctm/route.ts` | Cron | Daily auto-sync for all configured CTM locations |

### Testing

After building, test with:
```
curl "https://jungle-dashboard.vercel.app/api/sync/ctm?loc=JUNGLE-101&days=30"
```

Or locally:
```
curl "http://localhost:3000/api/sync/ctm?loc=JUNGLE-101&days=30"
```

Expected response:
```json
{
  "success": true,
  "location": "JUNGLE-101",
  "synced": 145,
  "skipped": 0,
  "errors": 0,
  "date_range": { "start": "2025-01-26", "end": "2025-02-25" }
}
```

### Notes
- The CTM API uses Basic Auth (not OAuth), so no token refresh needed
- We use `external_id` for idempotent upserts — safe to re-run
- The sync pulls ALL call types (inbound, outbound, missed, voicemail)
- Per-location env var pattern: `CTM_{NUM}_ACCOUNT_ID` where NUM is the number portion of location_number (e.g., "101" for JUNGLE-101)
- When adding more locations later, just add their 3 env vars and the cron auto-picks them up
- Network access: This route needs to make outbound HTTP calls to `api.calltrackingmetrics.com` — ensure Vercel's network settings allow this
