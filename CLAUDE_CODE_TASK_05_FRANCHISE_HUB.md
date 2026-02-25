# CLAUDE CODE TASK — Franchise Hub Page

> Read this entire document before making changes.
> This builds the franchisee "home base" — a per-location hub with tabs for operations, integrations setup, and location settings.
> Two personas see this page differently: the COO (setup/config) and the franchisee (operational cockpit).

---

## OVERVIEW

**Route:** `/hub/[id]` where `id` is the location UUID

**Tabs:**
1. **Overview** — The franchisee cockpit. Quick links, action items summary, today's key numbers. This is what a franchisee sees when they log in.
2. **Integrations** — Admin/COO view. Shows all data source connections with status, last sync time, and setup controls. This is where YOU wire up a new location.
3. **Settings** — Admin/COO view. Location profile info (address, phone, hours, manager, timezone).

For now (no auth), all tabs are visible. Later, franchisees won't see Integrations or Settings tabs.

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## PART 1: SUPABASE MIGRATION — Location Profile Fields

Run this SQL in the Supabase SQL editor. This adds profile columns to the existing `locations` table.

**IMPORTANT:** The `locations` table is pre-existing (from the lead management project). We're adding columns, not recreating the table.

```sql
-- Migration 007: Location profile + hub support
-- Adds profile fields to locations table for the franchise hub

ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_email TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "08:00", "close": "18:00"},
  "tuesday": {"open": "08:00", "close": "18:00"},
  "wednesday": {"open": "08:00", "close": "18:00"},
  "thursday": {"open": "08:00", "close": "18:00"},
  "friday": {"open": "08:00", "close": "18:00"},
  "saturday": {"open": "09:00", "close": "14:00"},
  "sunday": null
}'::JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ctm_account_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS gbp_location_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS driveato_location_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ghl_location_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS opened_date DATE;

-- Seed profile data for existing locations
UPDATE locations SET
  address_line1 = '4502 S 84th St',
  city = 'Omaha',
  state = 'NE',
  zip_code = '68127',
  phone = '(402) 555-0101',
  email = 'omaha@jungledrivingschool.com',
  timezone = 'America/Chicago',
  manager_name = 'Sarah Mitchell',
  manager_email = 'sarah.mitchell@jungledrivingschool.com',
  manager_phone = '(402) 555-0102',
  opened_date = '2024-03-15'
WHERE id = '27d7b25d-d329-4cbd-8a43-d3bb3664bbab'; -- Omaha

UPDATE locations SET
  address_line1 = '2801 Pine Lake Rd',
  city = 'Lincoln',
  state = 'NE',
  zip_code = '68516',
  phone = '(402) 555-0201',
  email = 'lincoln@jungledrivingschool.com',
  timezone = 'America/Chicago',
  manager_name = 'Tom Garcia',
  manager_email = 'tom.garcia@jungledrivingschool.com',
  manager_phone = '(402) 555-0202',
  opened_date = '2024-08-01'
WHERE id = 'c5fdf98d-6d2b-4fea-a515-0c063ae48bec'; -- Lincoln

UPDATE locations SET
  address_line1 = '1501 Galvin Rd S',
  city = 'Bellevue',
  state = 'NE',
  zip_code = '68005',
  phone = '(402) 555-0301',
  email = 'bellevue@jungledrivingschool.com',
  timezone = 'America/Chicago',
  manager_name = 'Jessica Park',
  manager_email = 'jessica.park@jungledrivingschool.com',
  manager_phone = '(402) 555-0302',
  opened_date = '2024-06-01'
WHERE id = 'bec4068e-1799-4859-87db-344c40c9ec73'; -- Bellevue

-- Seed some integration sync records so the hub has data to show
INSERT INTO integration_syncs (location_id, integration_type, last_sync_at, status, records_synced, error_message) VALUES
-- Omaha — fully connected
('27d7b25d-d329-4cbd-8a43-d3bb3664bbab', 'google_ads', NOW() - INTERVAL '6 hours', 'success', 12, NULL),
('27d7b25d-d329-4cbd-8a43-d3bb3664bbab', 'meta_ads', NOW() - INTERVAL '6 hours', 'success', 8, NULL),
('27d7b25d-d329-4cbd-8a43-d3bb3664bbab', 'call_tracking', NOW() - INTERVAL '4 hours', 'success', 23, NULL),
('27d7b25d-d329-4cbd-8a43-d3bb3664bbab', 'gbp', NOW() - INTERVAL '8 hours', 'success', 3, NULL),
-- Lincoln — partially connected, one errored
('c5fdf98d-6d2b-4fea-a515-0c063ae48bec', 'google_ads', NOW() - INTERVAL '6 hours', 'success', 7, NULL),
('c5fdf98d-6d2b-4fea-a515-0c063ae48bec', 'call_tracking', NOW() - INTERVAL '30 hours', 'error', 0, 'Authentication token expired. Re-authorize in CTM settings.'),
('c5fdf98d-6d2b-4fea-a515-0c063ae48bec', 'gbp', NOW() - INTERVAL '8 hours', 'success', 2, NULL),
-- Bellevue — fully connected
('bec4068e-1799-4859-87db-344c40c9ec73', 'google_ads', NOW() - INTERVAL '5 hours', 'success', 15, NULL),
('bec4068e-1799-4859-87db-344c40c9ec73', 'meta_ads', NOW() - INTERVAL '5 hours', 'success', 11, NULL),
('bec4068e-1799-4859-87db-344c40c9ec73', 'call_tracking', NOW() - INTERVAL '3 hours', 'success', 17, NULL),
('bec4068e-1799-4859-87db-344c40c9ec73', 'gbp', NOW() - INTERVAL '7 hours', 'success', 5, NULL),
('bec4068e-1799-4859-87db-344c40c9ec73', 'driveato', NOW() - INTERVAL '12 hours', 'success', 42, NULL)
ON CONFLICT DO NOTHING;
```

**TELL THE USER** they need to run this SQL in Supabase SQL editor before the hub page will work. Or if they prefer, you can create a migration file and they can run it.

---

## PART 2: FILE STRUCTURE

```
src/
├── app/
│   ├── hub/
│   │   └── [id]/
│   │       └── page.tsx           # Hub page with tabs
│   └── api/
│       └── hub/
│           └── [id]/
│               └── route.ts       # GET hub data, PATCH location settings
├── lib/
│   └── types.ts                   # Add hub-related types
└── components/
    └── hub/
        ├── OverviewTab.tsx        # Franchisee cockpit
        ├── IntegrationsTab.tsx    # Integration connection cards
        ├── SettingsTab.tsx        # Location profile form
        └── IntegrationCard.tsx    # Single integration status card
```

---

## PART 3: TYPES — Add to `src/lib/types.ts`

```typescript
// === Hub ===

export interface LocationProfile {
  id: string
  name: string
  slug: string
  is_active: boolean
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  timezone: string
  manager_name: string | null
  manager_email: string | null
  manager_phone: string | null
  business_hours: Record<string, { open: string; close: string } | null>
  google_place_id: string | null
  google_ads_customer_id: string | null
  meta_ad_account_id: string | null
  ctm_account_id: string | null
  gbp_location_id: string | null
  driveato_location_id: string | null
  ghl_location_id: string | null
  notes: string | null
  logo_url: string | null
  opened_date: string | null
  // State minimums (from 006)
  state_min_classroom_hours: number | null
  state_min_drive_hours: number | null
  state_min_drive_count: number | null
}

export interface IntegrationSync {
  id: string
  location_id: string
  integration_type: string
  last_sync_at: string
  status: 'success' | 'error' | 'running' | 'never'
  records_synced: number
  error_message: string | null
}

export type IntegrationType = 'google_ads' | 'meta_ads' | 'call_tracking' | 'gbp' | 'driveato' | 'ghl' | 'social_media'

export interface IntegrationConfig {
  type: IntegrationType
  label: string
  description: string
  icon: string  // lucide icon name
  color: string // tailwind color
  accountIdField: keyof LocationProfile  // which location column stores the account ID
  docsUrl?: string
}

export interface HubData {
  location: LocationProfile
  integrations: IntegrationSync[]
  action_items_count: { critical: number; high: number; medium: number; low: number; total: number }
  today_kpi: any | null
  quick_stats: {
    active_students: number
    outstanding_drives: number
    upcoming_classes: number
    open_leads: number
    unreplied_reviews: number
    compliance_score: number
  }
}
```

---

## PART 4: API ROUTE — `src/app/api/hub/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = await params
  const supabase = createServiceClient()

  // Location profile (all columns)
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (locError || !location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Integration syncs — get LATEST sync per integration type
  const { data: allSyncs } = await supabase
    .from('integration_syncs')
    .select('*')
    .eq('location_id', locationId)
    .order('last_sync_at', { ascending: false })

  // Deduplicate: keep only the most recent per integration_type
  const latestSyncs: any[] = []
  const seenTypes = new Set()
  for (const sync of (allSyncs || [])) {
    if (!seenTypes.has(sync.integration_type)) {
      seenTypes.add(sync.integration_type)
      latestSyncs.push(sync)
    }
  }

  // Action items count
  const { data: actionItems } = await supabase
    .from('action_items')
    .select('priority')
    .eq('location_id', locationId)
    .in('status', ['open', 'in_progress'])

  const actionCounts = {
    critical: (actionItems || []).filter(a => a.priority === 'critical').length,
    high: (actionItems || []).filter(a => a.priority === 'high').length,
    medium: (actionItems || []).filter(a => a.priority === 'medium').length,
    low: (actionItems || []).filter(a => a.priority === 'low').length,
    total: (actionItems || []).length,
  }

  // Today's KPI
  const today = new Date().toISOString().split('T')[0]
  const { data: todayKpi } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .eq('date', today)
    .single()

  // Quick stats
  const { data: activeStudents } = await supabase
    .from('students')
    .select('id, lessons_remaining')
    .eq('location_id', locationId)
    .eq('status', 'active')

  const outstandingDrives = (activeStudents || []).reduce((sum, s) => sum + (s.lessons_remaining || 0), 0)

  const { data: upcomingClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'in_progress'])

  const { data: openLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_archived', false)
    .is('converted_at', null)

  const { data: unrepliedReviews } = await supabase
    .from('gbp_reviews')
    .select('id')
    .eq('location_id', locationId)
    .eq('has_reply', false)

  return NextResponse.json({
    location,
    integrations: latestSyncs,
    action_items_count: actionCounts,
    today_kpi: todayKpi,
    quick_stats: {
      active_students: (activeStudents || []).length,
      outstanding_drives: outstandingDrives,
      upcoming_classes: (upcomingClasses || []).length,
      open_leads: (openLeads || []).length,
      unreplied_reviews: (unrepliedReviews || []).length,
      compliance_score: Number(todayKpi?.compliance_score || 100),
    },
  })
}

// PATCH — update location settings
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // Only allow updating specific fields
  const allowedFields = [
    'name', 'address_line1', 'address_line2', 'city', 'state', 'zip_code',
    'phone', 'email', 'timezone', 'manager_name', 'manager_email', 'manager_phone',
    'business_hours', 'google_place_id', 'google_ads_customer_id', 'meta_ad_account_id',
    'ctm_account_id', 'gbp_location_id', 'driveato_location_id', 'ghl_location_id',
    'notes', 'logo_url', 'opened_date',
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', locationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

---

## PART 5: INTEGRATION DEFINITIONS

Create `src/lib/integrations.ts`:

```typescript
import { IntegrationConfig } from './types'

export const INTEGRATIONS: IntegrationConfig[] = [
  {
    type: 'google_ads',
    label: 'Google Ads',
    description: 'Daily ad spend, impressions, clicks, and conversions from Google Ads campaigns.',
    icon: 'Search',       // lucide icon
    color: 'blue',
    accountIdField: 'google_ads_customer_id',
  },
  {
    type: 'meta_ads',
    label: 'Meta Ads',
    description: 'Facebook and Instagram ad performance — spend, reach, clicks, and leads.',
    icon: 'Facebook',     // lucide doesn't have this, use 'Share2' or 'Megaphone'
    color: 'indigo',
    accountIdField: 'meta_ad_account_id',
  },
  {
    type: 'call_tracking',
    label: 'Call Tracking (CTM)',
    description: 'Inbound and outbound calls — answered, missed, duration, and recordings.',
    icon: 'Phone',
    color: 'emerald',
    accountIdField: 'ctm_account_id',
  },
  {
    type: 'gbp',
    label: 'Google Business Profile',
    description: 'Reviews, ratings, search views, maps views, website clicks, and phone calls.',
    icon: 'MapPin',
    color: 'red',
    accountIdField: 'gbp_location_id',
  },
  {
    type: 'driveato',
    label: 'Driveato',
    description: 'Student enrollment, instructor assignments, vehicle fleet, and scheduling data.',
    icon: 'Car',
    color: 'amber',
    accountIdField: 'driveato_location_id',
  },
  {
    type: 'ghl',
    label: 'GoHighLevel',
    description: 'Lead pipeline stages, opportunity values, and contact activity.',
    icon: 'Workflow',
    color: 'purple',
    accountIdField: 'ghl_location_id',
  },
]
```

---

## PART 6: HUB PAGE — `src/app/hub/[id]/page.tsx`

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🌴 Omaha                                                       │
│  4502 S 84th St, Omaha, NE 68127  ·  Manager: Sarah Mitchell   │
│                                                                  │
│  [Overview]  [Integrations]  [Settings]                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  (Tab content renders here)                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Page header:** Location name (large), address + manager subtitle, tab switcher.

**Tab implementation:** Use URL search params (`?tab=overview`, `?tab=integrations`, `?tab=settings`) or local state. Local state is simpler for now.

**Tab styling:** Horizontal pill buttons. Active tab gets `bg-gray-900 text-white`, inactive gets `bg-gray-100 text-gray-600 hover:bg-gray-200`. Use a rounded-lg pill shape.

---

## PART 7: OVERVIEW TAB — `src/components/hub/OverviewTab.tsx`

This is the franchisee's home screen. Clean, scannable, action-oriented.

### Section A: Quick Stats Row (6 cards)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  👥 Active    │ │  🚗 Drives   │ │  📋 Classes   │
│  Students     │ │  Remaining   │ │  Active       │
│      8        │ │     47       │ │      2        │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  📥 Open     │ │  ⭐ Unreplied │ │  🛡️ Compliance│
│  Leads       │ │  Reviews     │ │  Score       │
│      5       │ │      2       │ │    88.9%     │
└──────────────┘ └──────────────┘ └──────────────┘
```

Use KpiCard component. Color code: compliance < 90% = yellow, unreplied reviews > 0 = yellow, etc.

### Section B: Action Items Alert (if any exist)

Only show if action_items_count.total > 0. Compact card:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ 7 action items need attention                       │
│                                                          │
│  🔴 2 Critical  🟠 3 High  🟡 1 Medium  🟢 1 Low      │
│                                                          │
│  [View All Action Items →]                              │
└─────────────────────────────────────────────────────────┘
```

Link goes to `/actions?location_id={id}` (filtered to this location).

### Section C: Quick Links Grid

```
┌─────────────────────────┐ ┌─────────────────────────┐
│  📊 Location Dashboard  │ │  ⚡ Action Items         │
│  View detailed metrics  │ │  See what needs doing    │
│  and trends             │ │                          │
└─────────────────────────┘ └─────────────────────────┘
┌─────────────────────────┐ ┌─────────────────────────┐
│  📥 Lead Pipeline       │ │  🛡️ Compliance          │
│  Manage incoming leads  │ │  Track certifications   │
│  and follow-ups         │ │  and renewals           │
└─────────────────────────┘ └─────────────────────────┘
┌─────────────────────────┐ ┌─────────────────────────┐
│  📈 Marketing           │ │  🏆 Network Rankings    │
│  Ad performance and     │ │  See how you compare    │
│  GBP analytics          │ │                          │
└─────────────────────────┘ └─────────────────────────┘
```

Each card is a `<Link>` to:
- Location Dashboard → `/locations/{id}`
- Action Items → `/actions?location_id={id}`
- Lead Pipeline → `/leads/{id}` (doesn't exist yet — show as "Coming Soon" with muted styling)
- Compliance → `/compliance?location_id={id}` (or just `/compliance` for now)
- Marketing → `/marketing`
- Network Rankings → `/ranker`

Style: White cards with left icon, title bold, subtitle muted. `hover:shadow-md hover:border-gray-300 transition-all cursor-pointer`. "Coming Soon" cards get `opacity-60 cursor-not-allowed` and a small "Coming Soon" badge.

### Section D: Integration Status Strip

A compact horizontal strip at the bottom showing integration connection status at a glance. NOT the full setup view (that's the Integrations tab) — just dots.

```
┌─────────────────────────────────────────────────────────┐
│  Data Connections                                        │
│                                                          │
│  🟢 Google Ads  🟢 CTM  🟢 GBP  ⚪ Meta  ⚪ Driveato  │
│                                                          │
│  Last sync: 4 hours ago              [Manage →]          │
└─────────────────────────────────────────────────────────┘
```

🟢 = connected + last sync successful
🟡 = connected but last sync errored
⚪ = not connected (no account ID set on location)

"Manage →" links to the Integrations tab.

---

## PART 8: INTEGRATIONS TAB — `src/components/hub/IntegrationsTab.tsx`

This is the admin setup view. One card per integration.

### Integration Card — `src/components/hub/IntegrationCard.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Google Ads                          [🟢 Connected]  │
│                                                          │
│  Daily ad spend, impressions, clicks, and conversions    │
│  from Google Ads campaigns.                              │
│                                                          │
│  Account ID: 123-456-7890                                │
│  Last Sync: Feb 8, 2026 at 6:32 AM · 12 records        │
│  Status: ✅ Success                                      │
│                                                          │
│  [Edit Account ID]  [View Sync History]                 │
└─────────────────────────────────────────────────────────┘
```

**States:**

1. **Connected + Syncing OK** (green):
   - Header badge: 🟢 Connected
   - Shows account ID, last sync time, records count
   - Border: `border-l-4 border-emerald-500`

2. **Connected + Sync Error** (yellow/red):
   - Header badge: 🟡 Error
   - Shows account ID, last sync time, error message in red text
   - Border: `border-l-4 border-amber-500`
   - Extra button: [Retry Sync]

3. **Not Connected** (gray):
   - Header badge: ⚪ Not Connected
   - No sync info shown
   - Shows input field for account ID
   - Border: `border-l-4 border-gray-300`
   - Button: [Connect]

**"Edit Account ID" behavior:**
When clicked, turns the Account ID line into an editable text input. On save, sends PATCH to `/api/hub/[id]` with the appropriate field (e.g. `{ google_ads_customer_id: '123-456-7890' }`). Show a success toast or inline confirmation.

**"Connect" behavior (for unconnected):**
Shows input field for the account/location ID. On save, sends PATCH. Card refreshes to show "Connected" state.

**Card layout:** 2-column grid on desktop (`grid-cols-1 lg:grid-cols-2`), stacked on mobile.

### Integrations Header

```
┌─────────────────────────────────────────────────────────┐
│  Data Integrations                                       │
│  Connect your location's data sources. Each integration  │
│  syncs automatically via Make.com once configured.       │
│                                                          │
│  Connected: 4/6  ·  Last sync: 4h ago                   │
└─────────────────────────────────────────────────────────┘
```

---

## PART 9: SETTINGS TAB — `src/components/hub/SettingsTab.tsx`

A form with sections for editing location profile info. All fields are editable. Changes save via PATCH to `/api/hub/[id]`.

### Section A: Location Info

```
Location Name:     [Jungle Driving School — Omaha  ]
Address Line 1:    [4502 S 84th St                  ]
Address Line 2:    [                                 ]
City:              [Omaha          ]
State:             [NE  ]
Zip Code:          [68127     ]
Phone:             [(402) 555-0101      ]
Email:             [omaha@jungledrivingschool.com   ]
Timezone:          [America/Chicago  ▾]
Opened Date:       [2024-03-15      ]
```

### Section B: Manager

```
Manager Name:      [Sarah Mitchell                   ]
Manager Email:     [sarah.mitchell@jungledriving...  ]
Manager Phone:     [(402) 555-0102                   ]
```

### Section C: Business Hours

Interactive grid for each day of the week:

```
Monday:     [08:00 ▾] to [18:00 ▾]   ☑ Open
Tuesday:    [08:00 ▾] to [18:00 ▾]   ☑ Open
Wednesday:  [08:00 ▾] to [18:00 ▾]   ☑ Open
Thursday:   [08:00 ▾] to [18:00 ▾]   ☑ Open
Friday:     [08:00 ▾] to [18:00 ▾]   ☑ Open
Saturday:   [09:00 ▾] to [14:00 ▾]   ☑ Open
Sunday:                                ☐ Closed
```

Unchecking "Open" sets that day to null in the JSONB.

### Section D: Notes

```
Notes:             [Large textarea for internal notes]
```

### Save Button

Single `[Save Changes]` button at the bottom. On click:
1. Collect all form fields into an object
2. PATCH to `/api/hub/[id]`
3. Show success toast / green "Saved!" inline message
4. Disable button while saving (loading state)

**Form styling:** Clean, spacious, white background cards per section. Labels in `text-sm font-medium text-gray-700`. Inputs in `border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500`.

---

## PART 10: SIDEBAR UPDATE

Add "Hub" links to the sidebar. Under the "Locations" section, each location should link to `/hub/[id]` instead of (or in addition to) `/locations/[id]`.

**Option A (recommended):** Change the location links in the sidebar to go to `/hub/[id]`. Add a "Dashboard" quick link inside the hub that goes to `/locations/[id]`.

**Option B:** Add a separate "Hub" section above Locations.

Go with Option A — the hub IS the location's home page now. The sidebar location links should go to hub.

Update `Sidebar.tsx`:
- Location links: `href={/hub/${loc.id}}` instead of `/locations/${loc.id}`
- Active state detection: highlight when pathname starts with `/hub/${loc.id}`

---

## PART 11: ADD HUB LINK TO LOCATION DETAIL PAGE

On the existing location detail page (`/locations/[id]/page.tsx`), add a small breadcrumb or back link:

```
← Back to Omaha Hub
```

This links to `/hub/[id]` and helps navigate between the detailed dashboard and the hub.

---

## BUILD ORDER

1. **Ask user to run the SQL migration** (Part 1) in Supabase SQL editor
2. Add types to `src/lib/types.ts` (Part 3)
3. Create `src/lib/integrations.ts` (Part 5)
4. Create API route `src/app/api/hub/[id]/route.ts` (Part 4)
5. Create IntegrationCard component (Part 8)
6. Create OverviewTab component (Part 7)
7. Create IntegrationsTab component (Part 8)
8. Create SettingsTab component (Part 9)
9. Create Hub page `src/app/hub/[id]/page.tsx` (Part 6)
10. Update Sidebar links to point to hub (Part 10)
11. Add "Back to Hub" link on location detail page (Part 11)
12. Test: visit `/hub/27d7b25d-d329-4cbd-8a43-d3bb3664bbab` (Omaha hub)
13. Test: edit settings, verify PATCH saves, check integrations show status

## EXPECTED RESULTS WITH SEED DATA

| Location | Connected Integrations | Sync Status |
|----------|----------------------|-------------|
| Omaha | Google Ads ✅, Meta ✅, CTM ✅, GBP ✅ (4/6) | All green |
| Lincoln | Google Ads ✅, CTM ❌ (error), GBP ✅ (2/6) | CTM shows error: "Authentication token expired" |
| Bellevue | Google Ads ✅, Meta ✅, CTM ✅, GBP ✅, Driveato ✅ (5/6) | All green — best connected |

Lincoln's CTM error is intentional — demonstrates the error state in the UI and shows the COO that something needs fixing.
