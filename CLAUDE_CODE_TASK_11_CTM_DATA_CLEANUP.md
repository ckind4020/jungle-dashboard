# CLAUDE_CODE_TASK_11_CTM_DATA_CLEANUP.md

## Task 11: CTM Data Cleanup + Callback Tracking Dashboard

### Problem
The current CTM sync pulls ALL activities (calls, texts, forms, chats) and treats them all the same. This means:
1. Text messages show as "missed calls" — massively skewing answer rates
2. No distinction between inbound vs outbound calls
3. No way to see who called us but hasn't been called back
4. No metric for average callback response time

### What to Build

#### Part 1: Update CTM Sync to Categorize Activity Types

**Modify `/api/sync/ctm/route.ts`:**

The CTM API call response includes fields that distinguish activity types. Look for fields like:
- `call_type` — may be "call", "text", "form", "chat"
- `activity_type` — similar categorization
- `business_phone_number` vs `caller_number` — direction indicator
- `direction` — "inbound" or "outbound"
- `duration` — texts have 0 duration
- `answered` — boolean

**Add a new column to call_tracking_records:**
```sql
ALTER TABLE call_tracking_records 
ADD COLUMN IF NOT EXISTS activity_type text DEFAULT 'call';
-- Values: 'call', 'text', 'form', 'chat'
```

**Mapping logic in the sync:**
```typescript
// Determine activity type from CTM response
// CTM may use different field names - check the actual API response
// Common patterns:
// - If call_type exists: use it directly
// - If duration is 0 and there's message content: it's a text
// - Check for 'sms', 'text', 'chat' in any type fields

function getActivityType(ctmCall: any): string {
  // Check explicit type fields first
  if (ctmCall.call_type) {
    const type = ctmCall.call_type.toLowerCase();
    if (type.includes('text') || type.includes('sms')) return 'text';
    if (type.includes('form')) return 'form';
    if (type.includes('chat')) return 'chat';
    return 'call';
  }
  // Fallback: if duration is 0 and no ring time, likely a text
  if (ctmCall.duration === 0 && !ctmCall.ring_time) return 'text';
  return 'call';
}
```

**IMPORTANT:** Before writing the mapping logic, do a test API call and log the raw response to understand the exact field names CTM returns. Add a debug endpoint or console.log the first response. The CTM API docs at https://postman.calltrackingmetrics.com/ show the schema, but actual field names may vary.

**Quick way to check:** Add a temporary debug route or modify the sync to log the first call object:
```typescript
// In the sync function, after fetching the first page:
console.log('CTM sample call:', JSON.stringify(data.calls?.[0], null, 2));
```

After checking the actual response shape, map fields appropriately.

**Also update the call_type derivation:**
```typescript
// Only derive answered/missed/voicemail for actual calls, not texts
function getCallType(ctmCall: any, activityType: string): string {
  if (activityType !== 'call') return activityType; // 'text', 'form', 'chat'
  if (ctmCall.voicemail) return 'voicemail';
  if (ctmCall.answered || ctmCall.status === 'answered') return 'answered';
  return 'missed';
}
```

**Re-sync after updating:** After deploying the fix, clear and re-sync Omaha's data:
- Delete existing records: `DELETE FROM call_tracking_records WHERE location_id = (SELECT id FROM locations WHERE location_number = 'JUNGLE-101');`
- Re-run sync: `GET /api/sync/ctm?loc=JUNGLE-101&days=30`

#### Part 2: Update Dashboard Lite API to Filter by Activity Type

**Modify `/api/dashboard/[locationId]/route.ts`:**

The call tracking section should ONLY count actual phone calls, not texts. Update all call_tracking queries to filter:

```sql
-- Add to all call_tracking_records queries:
WHERE activity_type = 'call'
-- or
WHERE activity_type IN ('call')
```

**Add a separate SMS summary section to the API response:**
```typescript
// In the dashboard API response, add:
sms: {
  total: number,         // total texts in period
  inbound: number,       // texts received
  outbound: number,      // texts sent
}
```

#### Part 3: Callback Tracking — "Unreturned Calls" Section

**New concept:** Match inbound missed calls with outbound calls to the same number within a time window.

**Add to the dashboard API (`/api/dashboard/[locationId]/route.ts`):**

```typescript
// Query: Find inbound missed calls that DON'T have a matching outbound call
// to the same caller_number within 24 business hours after the missed call

// Step 1: Get all missed inbound calls in the period
const missedCalls = await supabase
  .from('call_tracking_records')
  .select('*')
  .eq('location_id', locationId)
  .eq('activity_type', 'call')
  .eq('call_type', 'missed')
  .eq('direction', 'inbound')
  .gte('called_at', startDate)
  .lte('called_at', endDate)
  .order('called_at', { ascending: false });

// Step 2: Get all outbound calls in the period (plus a buffer after)
const outboundCalls = await supabase
  .from('call_tracking_records')
  .select('caller_number, called_at')
  .eq('location_id', locationId)
  .eq('activity_type', 'call')
  .eq('direction', 'outbound')
  .gte('called_at', startDate);

// Step 3: For each missed call, check if there's a later outbound call to that number
// A missed call is "unreturned" if no outbound call to the same number exists after it

// Step 4: Calculate average callback time for returned calls
// Only count business hours (M-F 8am-6pm local time)
```

**Add to API response:**
```typescript
callbacks: {
  unreturned_calls: [
    {
      caller_number: string,
      called_at: string,      // when they called
      source: string,         // tracking source
      hours_waiting: number,  // business hours since missed call
    }
  ],
  unreturned_count: number,
  avg_callback_time_hours: number,  // average business hours to call back
  callback_rate: number,            // % of missed calls that got called back
  returned_count: number,
}
```

**Business hours calculation helper:**
```typescript
function businessHoursBetween(start: Date, end: Date): number {
  // Count hours only M-F 8am-6pm (10 hours per business day)
  // Timezone: Central Time (America/Chicago) for Jungle Driving School
  let hours = 0;
  let current = new Date(start);
  
  while (current < end) {
    const day = current.getDay(); // 0=Sun, 6=Sat
    const hour = current.getHours();
    
    if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) {
      hours++;
    }
    current = new Date(current.getTime() + 60 * 60 * 1000); // add 1 hour
  }
  return hours;
}
```

#### Part 4: Update Dashboard Lite UI Components

**Modify `CallTrackingCard.tsx`:**

1. **Split the main metrics into Calls vs Texts tabs or sections:**
   - Calls section: total calls, answered, missed, voicemail, answer rate (ONLY actual calls)
   - Texts section: total texts, inbound, outbound (simple counts)

2. **Add "Unreturned Calls" card:**
   - Big number: unreturned call count (red if > 0)
   - List of unreturned callers: phone number, when they called, source, hours waiting
   - Color code by urgency: < 1 hour green, 1-4 hours yellow, 4+ hours red
   - "Call Back" button (just links to phone number for now)

3. **Add "Callback Performance" metrics:**
   - Average callback time (in business hours)
   - Callback rate (% of missed calls returned)
   - Visual: progress bar or gauge

**Layout suggestion for the call section:**
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Total Calls   │  │   Answer Rate   │  │ Avg Callback    │
│     247         │  │     84%         │  │   2.3 hrs       │
│  ▲12% vs prior  │  │  ████████░░     │  │  (business hrs) │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📞 Unreturned Calls (3)                                     │
│                                                              │
│  🔴  (402) 555-1234  •  Yard Sign  •  6.5 hrs ago           │
│  🟡  (402) 555-5678  •  Website    •  2.1 hrs ago           │
│  🟢  (402) 555-9012  •  Google Ads •  0.5 hrs ago           │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐  ┌────────────────────────┐
│  📱 Text Messages               │  │  Missed Calls by Hour  │
│  Total: 834  In: 412  Out: 422  │  │  [bar chart]           │
└─────────────────────────────────┘  └────────────────────────┘
```

### Migration SQL

Run in Supabase SQL editor:
```sql
ALTER TABLE call_tracking_records 
ADD COLUMN IF NOT EXISTS activity_type text DEFAULT 'call';

-- Update existing records: try to identify texts by duration=0 pattern
-- (This is a rough heuristic — the re-sync will set proper values)
UPDATE call_tracking_records 
SET activity_type = 'text' 
WHERE duration_seconds = 0 AND call_type = 'missed';
```

### File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/sync/ctm/route.ts` | MODIFY | Add activity_type detection, fix call_type logic |
| `src/app/api/dashboard/[locationId]/route.ts` | MODIFY | Filter calls vs texts, add callback tracking queries |
| `src/components/dashboard-lite/CallTrackingCard.tsx` | MODIFY | Split calls/texts, add unreturned calls list, callback metrics |

### Testing Steps

1. Deploy the sync fix
2. Run SQL migration
3. Clear Omaha data: `DELETE FROM call_tracking_records WHERE location_id = (SELECT id FROM locations WHERE location_number = 'JUNGLE-101');`
4. Re-sync: `curl "https://jungle-dashboard.vercel.app/api/sync/ctm?loc=JUNGLE-101&days=30"`
5. Check dashboard — call metrics should now only reflect actual phone calls
6. Verify unreturned calls list shows missed calls with no callback

### Notes
- The CTM API response schema should be inspected first — add a console.log of the first call object to verify field names before writing mapping logic
- Business hours are M-F 8am-6pm Central Time
- "Unreturned" means: inbound missed call where no outbound call was made to the same phone number after the missed call
- Texts should be shown separately but not hidden — franchisees need to see text volume too
- The callback time metric is one of the most important operational KPIs — it directly correlates with lead conversion
