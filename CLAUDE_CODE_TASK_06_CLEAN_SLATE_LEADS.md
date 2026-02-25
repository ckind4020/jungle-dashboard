# CLAUDE CODE TASK 06 — Clean Slate + Add Location + Lead Management Port

> Read this ENTIRE document before making changes.
> This task has 4 parts:
> 1. SQL to wipe all test data (user runs in Supabase)
> 2. "Add Location" flow so the COO can create new locations from the app
> 3. Port lead management pages from Express+React into Next.js
> 4. Port automations view into Next.js
>
> **CONTEXT:** This project shares a Supabase database with a previously-built lead management system (Express+React). We're merging everything into this single Next.js app. The lead management tables (leads, lead_stages, automations, etc.) already exist in Supabase — we just need Next.js pages and API routes that talk to them.

---

## CRITICAL SCHEMA NOTES

Before writing ANY code, remember these gotchas:

| Table | Gotcha |
|-------|--------|
| `leads` | **NO `status` column.** Uses `is_archived` (boolean) + `converted_at` (timestamp) + `stage_id` (UUID) |
| `leads` | `source` is a Postgres enum (`lead_source`). Cast with `::TEXT` in queries |
| `leads` | Has `location_id` but NO `organization_id`. Join through locations if needed |
| `leads` | Has `phone_normalized` for duplicate detection |
| `lead_stages` | Auto-created by trigger when a location is inserted (6 default stages: New, Contacted, Qualified, Proposal Sent, Enrolled, Lost) |
| `activity_logs` | Called `activity_logs` NOT `lead_activities`. Columns: `lead_id, activity_type, channel, direction, notes, metadata, created_at` |
| `call_tracking_records` | Uses `call_start` (timestamp) not `call_date`, `call_type` for answered/missed |
| `students` | Uses `enrolled_at` not `enrollment_date` |
| `automations` | Has `trigger_type`, `trigger_config` (JSONB), `filter_conditions` (JSONB), `is_active` (boolean), `location_id` |
| `automation_steps` | Has `step_type`, `step_config` (JSONB), `step_order` (integer), `delay_seconds`, `automation_id` |
| `automation_enrollments` | Has `lead_id`, `automation_id`, `current_step_order`, `status`, `next_execution_at` |

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`
**User email:** `ckindschuh@jungledriving.com` (super_admin — DO NOT DELETE)

---

## PART 1: DATA WIPE SQL

**TELL THE USER:** "Before I build the new features, you need to run this SQL in the Supabase SQL editor to wipe all test data. This keeps the schema, your user account, and the organization — just removes all fake locations, leads, students, etc. Ready?"

**Then show them this SQL.** Do NOT run it yourself. The user runs it.

```sql
-- ============================================================
-- JUNGLE DRIVING SCHOOL — CLEAN SLATE
-- Wipes ALL test/seed data. Keeps schema + org + user account.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Disable triggers temporarily to avoid cascade issues
SET session_replication_role = 'replica';

-- === DASHBOARD TABLES (migration 002-007 data) ===
TRUNCATE TABLE action_items CASCADE;
TRUNCATE TABLE kpi_daily CASCADE;
TRUNCATE TABLE network_benchmarks CASCADE;
TRUNCATE TABLE integration_syncs CASCADE;
TRUNCATE TABLE integration_credentials CASCADE;
TRUNCATE TABLE ad_spend_daily CASCADE;
TRUNCATE TABLE call_tracking_records CASCADE;
TRUNCATE TABLE compliance_items CASCADE;
TRUNCATE TABLE ghl_pipeline_records CASCADE;

-- === GBP & SOCIAL (migration 003) ===
TRUNCATE TABLE gbp_reviews CASCADE;
TRUNCATE TABLE gbp_metrics_daily CASCADE;
TRUNCATE TABLE social_media_posts_daily CASCADE;
TRUNCATE TABLE social_media_accounts CASCADE;
-- gbp_locations may or may not exist
DO $$ BEGIN
  EXECUTE 'TRUNCATE TABLE gbp_locations CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- === CLASSES & DRIVES (migration 006) ===
TRUNCATE TABLE drive_appointments CASCADE;
TRUNCATE TABLE class_enrollments CASCADE;
TRUNCATE TABLE classes CASCADE;

-- === STUDENTS, INSTRUCTORS, VEHICLES ===
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE instructors CASCADE;
TRUNCATE TABLE vehicles CASCADE;

-- === LEAD MANAGEMENT (from 001 schema) ===
TRUNCATE TABLE automation_logs CASCADE;
TRUNCATE TABLE automation_enrollments CASCADE;
TRUNCATE TABLE automation_steps CASCADE;
TRUNCATE TABLE automations CASCADE;
TRUNCATE TABLE webhook_logs CASCADE;
TRUNCATE TABLE webhook_endpoints CASCADE;
TRUNCATE TABLE lead_custom_values CASCADE;
TRUNCATE TABLE lead_custom_fields CASCADE;
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE lead_stages CASCADE;

-- === INTEGRATIONS ===
-- Only truncate if table exists (from lead mgmt 001)
DO $$ BEGIN
  EXECUTE 'TRUNCATE TABLE integrations CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'TRUNCATE TABLE message_templates CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- === LOCATIONS (wipe all test locations) ===
TRUNCATE TABLE user_locations CASCADE;
TRUNCATE TABLE locations CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- === VERIFY ===
SELECT 'organizations' AS tbl, COUNT(*) FROM organizations
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'kpi_daily', COUNT(*) FROM kpi_daily;
-- Expected: organizations = 1, everything else = 0
```

**After user confirms it ran successfully**, proceed with the build.

---

## PART 2: ADD LOCATION FLOW

### 2A: New Corporate Management Page

Create `/manage` — this is where the COO manages all locations. Simple page with:

**Route:** `src/app/manage/page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Franchise Management                                            │
│  Add and manage franchise locations                              │
│                                                        [+ Add Location] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  (empty state when no locations exist)                          │
│  "No locations yet. Click 'Add Location' to get started."       │
│                                                                  │
│  OR (when locations exist):                                     │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🌴 Omaha                                    [Active] ✅  │  │
│  │  4502 S 84th St, Omaha, NE 68127                         │  │
│  │  Manager: Sarah Mitchell  ·  Opened: Mar 15, 2024        │  │
│  │  [Open Hub →]                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2B: Add Location Modal/Flow

When "Add Location" is clicked, show a modal with a simple form:

**Required fields:**
- Location Name (e.g. "Jungle Driving School — Omaha")

**Optional fields (can fill in later on Settings tab):**
- Address Line 1
- City
- State (dropdown of US states)
- Zip Code
- Phone
- Manager Name

**On submit:**
1. POST to `/api/manage/locations` (new route)
2. Creates location in Supabase with `organization_id = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'`
3. Supabase trigger auto-creates 6 default lead stages
4. Also creates a `user_locations` entry linking the current user to this location
5. Redirects to `/hub/[new-id]?tab=settings` so they can fill in the rest

### 2C: API Route — `src/app/api/manage/locations/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

// GET — list all locations for the org
export async function GET() {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new location
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
  }

  // Generate slug from name
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      organization_id: ORG_ID,
      name: body.name.trim(),
      slug,
      is_active: true,
      address_line1: body.address_line1 || null,
      city: body.city || null,
      state: body.state || null,
      zip_code: body.zip_code || null,
      phone: body.phone || null,
      manager_name: body.manager_name || null,
      timezone: 'America/Chicago',
      business_hours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: null,
      },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // NOTE: The Supabase trigger should auto-create 6 default lead_stages for this location.
  // If it doesn't (check if trigger exists), we may need to create them manually here.
  // Default stages: New (order 1), Contacted (2), Qualified (3), Proposal Sent (4), Enrolled (5), Lost (6)

  return NextResponse.json(location, { status: 201 })
}
```

### 2D: Sidebar Update

The sidebar currently fetches locations and shows them as links. After the wipe there will be zero locations, so:

1. When there are 0 locations, show: "No locations yet" with a small [+ Add] link to `/manage`
2. When locations exist, show them as hub links (already done)
3. Add "Manage" link at the bottom of the sidebar (gear icon) → `/manage`

---

## PART 3: LEAD MANAGEMENT PAGES

These pages replace the Express+React lead management app. They talk directly to Supabase via Next.js API routes.

### File Structure

```
src/
├── app/
│   ├── leads/
│   │   └── [locationId]/
│   │       ├── page.tsx              # Lead list/inbox for a location
│   │       └── [leadId]/
│   │           └── page.tsx          # Individual lead detail
│   └── api/
│       └── leads/
│           ├── route.ts              # GET (list) + POST (create)
│           └── [id]/
│               └── route.ts          # GET (single) + PATCH (update) + DELETE
├── components/
│   └── leads/
│       ├── LeadTable.tsx             # Lead list table with search/filter
│       ├── LeadCard.tsx              # Lead detail card
│       ├── AddLeadModal.tsx          # New lead form with duplicate detection
│       ├── ActivityTimeline.tsx      # Activity feed for a lead
│       ├── StageDropdown.tsx         # Change lead stage
│       └── LeadFilters.tsx           # Search bar + filter pills
```

### 3A: Leads API — `src/app/api/leads/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/leads?location_id=xxx&stage_id=xxx&source=xxx&search=xxx&page=1&limit=25
export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  
  const locationId = searchParams.get('location_id')
  const stageId = searchParams.get('stage_id')
  const source = searchParams.get('source')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = (page - 1) * limit

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  // Build query
  let query = supabase
    .from('leads')
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, stage_order )
    `, { count: 'exact' })
    .eq('location_id', locationId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stageId) query = query.eq('stage_id', stageId)
  if (source) query = query.eq('source', source)
  if (search) {
    // Search by name, email, or phone
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also fetch stages for this location (for filters)
  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, name, color, stage_order')
    .eq('location_id', locationId)
    .order('stage_order')

  return NextResponse.json({
    leads: data || [],
    stages: stages || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

// POST /api/leads — create a new lead
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.location_id || !body.first_name || !body.last_name) {
    return NextResponse.json({ error: 'location_id, first_name, and last_name are required' }, { status: 400 })
  }

  // Normalize phone for duplicate detection
  const phoneNormalized = body.phone
    ? body.phone.replace(/\D/g, '').slice(-10)
    : null

  // Check for duplicates (same location, same normalized phone or same email)
  if (phoneNormalized || body.email) {
    let dupQuery = supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone')
      .eq('location_id', body.location_id)
      .eq('is_archived', false)

    if (phoneNormalized && body.email) {
      dupQuery = dupQuery.or(`phone_normalized.eq.${phoneNormalized},email.eq.${body.email}`)
    } else if (phoneNormalized) {
      dupQuery = dupQuery.eq('phone_normalized', phoneNormalized)
    } else if (body.email) {
      dupQuery = dupQuery.eq('email', body.email)
    }

    const { data: duplicates } = await dupQuery
    if (duplicates && duplicates.length > 0) {
      return NextResponse.json({
        error: 'Possible duplicate lead found',
        duplicates,
      }, { status: 409 })
    }
  }

  // Get the "New" stage (stage_order = 1) for this location
  const { data: newStage } = await supabase
    .from('lead_stages')
    .select('id')
    .eq('location_id', body.location_id)
    .eq('stage_order', 1)
    .single()

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      location_id: body.location_id,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      phone_normalized: phoneNormalized,
      source: body.source || 'manual_entry',
      stage_id: newStage?.id || null,
      lead_score: body.lead_score || 0,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    })
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, stage_order )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_logs').insert({
    lead_id: lead.id,
    activity_type: 'lead_created',
    notes: `Lead created via dashboard (source: ${body.source || 'manual_entry'})`,
  })

  return NextResponse.json(lead, { status: 201 })
}
```

### 3B: Single Lead API — `src/app/api/leads/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/leads/[id] — full lead detail with activity timeline
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, stage_order ),
      locations ( id, name )
    `)
    .eq('id', id)
    .single()

  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Get activity timeline
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get available stages for this location (for the stage dropdown)
  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, name, color, stage_order')
    .eq('location_id', lead.location_id)
    .order('stage_order')

  return NextResponse.json({
    lead,
    activities: activities || [],
    stages: stages || [],
  })
}

// PATCH /api/leads/[id] — update lead fields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // If changing stage, log it
  if (body.stage_id) {
    // Get old stage name
    const { data: oldLead } = await supabase
      .from('leads')
      .select('stage_id, lead_stages!leads_stage_id_fkey(name)')
      .eq('id', id)
      .single()

    // Get new stage name
    const { data: newStage } = await supabase
      .from('lead_stages')
      .select('name')
      .eq('id', body.stage_id)
      .single()

    if (oldLead && newStage) {
      await supabase.from('activity_logs').insert({
        lead_id: id,
        activity_type: 'stage_change',
        notes: `Stage changed from "${(oldLead as any).lead_stages?.name || 'Unknown'}" to "${newStage.name}"`,
      })
    }
  }

  // If archiving
  if (body.is_archived === true) {
    await supabase.from('activity_logs').insert({
      lead_id: id,
      activity_type: 'lead_archived',
      notes: 'Lead archived',
    })
  }

  const allowedFields = [
    'first_name', 'last_name', 'email', 'phone', 'stage_id',
    'lead_score', 'is_archived', 'converted_at', 'notes',
    'utm_source', 'utm_medium', 'utm_campaign',
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // Re-normalize phone if changed
  if (updates.phone) {
    updates.phone_normalized = updates.phone.replace(/\D/g, '').slice(-10)
  }

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      lead_stages!leads_stage_id_fkey ( id, name, color, stage_order )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/leads/[id] — add a note (using POST with action param)
// Usage: POST /api/leads/[id]?action=note  body: { notes: "..." }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const supabase = createServiceClient()

  if (action === 'note') {
    const body = await request.json()
    const { error } = await supabase.from('activity_logs').insert({
      lead_id: id,
      activity_type: 'note',
      notes: body.notes,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

### 3C: Lead List Page — `src/app/leads/[locationId]/page.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Hub                                                   │
│  Leads — Omaha                                [+ Add Lead]       │
│                                                                  │
│  🔍 [Search by name, email, phone...        ]                   │
│                                                                  │
│  [All] [New] [Contacted] [Qualified] [Proposal] [Enrolled] [Lost] │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Name            │ Source      │ Stage      │ Score │ Created    │
│──────────────────│─────────────│────────────│───────│────────────│
│  John Smith      │ Google Ads  │ 🟢 New     │  45   │ 2 hrs ago  │
│  Jane Doe        │ Web Form    │ 🔵 Contacted│  72   │ 1 day ago  │
│  ...             │             │            │       │            │
├──────────────────────────────────────────────────────────────────┤
│  Showing 1-25 of 47           [← Prev]  [Next →]                │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Search box (debounced, 300ms) filters by name/email/phone
- Stage filter pills across the top (from lead_stages for this location, each with its color)
- Source filter dropdown (optional)
- Click a row → navigate to `/leads/[locationId]/[leadId]`
- Pagination at bottom
- "+ Add Lead" button opens AddLeadModal
- "← Back to Hub" links to `/hub/[locationId]`
- Empty state: "No leads yet. Add your first lead or connect an integration to start capturing them automatically."

**Stage pills:** Each lead_stage has a `color` field (hex). Use that for the pill backgrounds. Active filter gets solid fill, inactive gets outline.

### 3D: Add Lead Modal — `src/components/leads/AddLeadModal.tsx`

Modal form with:
- First Name (required)
- Last Name (required)
- Email
- Phone
- Source (dropdown: Manual Entry, Phone Call, Walk-In, Web Form, Google Ads, Meta Ads, Referral, Other)

**On submit:**
1. POST to `/api/leads` with `location_id` from URL
2. If 409 (duplicate): show warning "Possible duplicate: John Smith (john@example.com). Create anyway?" with [Cancel] [Create Anyway] buttons
3. If success: close modal, refresh lead list, show success toast

### 3E: Lead Detail Page — `src/app/leads/[locationId]/[leadId]/page.tsx`

Two-column layout:

```
┌─────────────────────────────────┐ ┌──────────────────────────────────┐
│  ← Back to Leads                │ │  Activity Timeline                │
│                                  │ │                                   │
│  John Smith           Score: 72  │ │  📝 Note added              2m   │
│  john@example.com               │ │  "Called, left voicemail"          │
│  (402) 555-1234                 │ │                                   │
│                                  │ │  🔄 Stage changed           1h   │
│  Stage: [Contacted ▾]          │ │  New → Contacted                  │
│  Source: Google Ads              │ │                                   │
│  Created: Feb 10, 2026          │ │  ✉️ SMS sent               2h    │
│                                  │ │  "Hi John, thanks for your..."    │
│  UTM: google / cpc / spring25   │ │                                   │
│                                  │ │  ➕ Lead created            3h   │
│  [Edit] [Archive] [Convert]    │ │  Source: Google Ads                │
│                                  │ │                                   │
│  ─────────────────────────────  │ │  [Add Note]                       │
│  Add Note:                       │ │  [________________________]       │
│  [________________________]     │ │  [Post]                           │
│  [Post Note]                    │ │                                   │
└─────────────────────────────────┘ └──────────────────────────────────┘
```

**Left column:**
- Lead info (name, email, phone, source, UTM data)
- Stage dropdown (PATCH on change, logs stage_change activity)
- Lead score (editable, 0-100)
- Action buttons:
  - Edit → makes fields editable
  - Archive → PATCH `is_archived: true`, redirect back to list
  - Convert → PATCH `converted_at: new Date().toISOString()`, changes stage to "Enrolled"

**Right column:**
- Activity timeline (from activity_logs)
- Each entry shows: icon (based on activity_type), description, relative time
- Add note input at bottom → POST /api/leads/[id]?action=note
- Activity type icons:
  - `lead_created` → ➕
  - `stage_change` → 🔄
  - `note` → 📝
  - `sms_sent` → 💬
  - `email_sent` → ✉️
  - `call_inbound` / `call_outbound` → 📞
  - `lead_archived` → 📦
  - Default → 📋

### 3F: Hub Overview Update

The "Lead Pipeline" quick link in OverviewTab is currently "Coming Soon". Update it:

```typescript
// Change from:
{ title: 'Lead Pipeline', subtitle: 'Coming Soon', href: '#', comingSoon: true }
// To:
{ title: 'Lead Pipeline', subtitle: 'Manage incoming leads', href: `/leads/${location.id}` }
```

Remove the `opacity-60 cursor-not-allowed` styling and "Coming Soon" badge.

---

## PART 4: AUTOMATIONS PAGE

For now, this is a **read-only view** of automations. Full create/edit can come later — we want to see what automations exist and their status.

### 4A: Route — `src/app/automations/[locationId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Hub                                                   │
│  Automations — Omaha                                             │
│                                                                  │
│  (empty state when no automations)                              │
│  "No automations yet. Automations will auto-send SMS, emails,   │
│   and update leads based on triggers you define."                │
│                                                                  │
│  OR:                                                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  New Lead Welcome Sequence           [🟢 Active] [⏸ Pause] │  │
│  │  Trigger: lead_created                                     │  │
│  │  Steps: 4  ·  Enrolled: 12  ·  Completed: 8              │  │
│  │  Last run: 2 hours ago                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4B: Automations API — `src/app/api/automations/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/automations?location_id=xxx
export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 })
  }

  const { data: automations, error } = await supabase
    .from('automations')
    .select(`
      *,
      automation_steps ( id, step_type, step_order ),
      automation_enrollments ( id, status )
    `)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute summary for each automation
  const enriched = (automations || []).map(a => ({
    ...a,
    step_count: a.automation_steps?.length || 0,
    enrolled_count: a.automation_enrollments?.filter((e: any) => e.status === 'active').length || 0,
    completed_count: a.automation_enrollments?.filter((e: any) => e.status === 'completed').length || 0,
    total_enrolled: a.automation_enrollments?.length || 0,
  }))

  return NextResponse.json(enriched)
}

// PATCH /api/automations?id=xxx — toggle active/paused
export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, any> = {}
  if ('is_active' in body) updates.is_active = body.is_active

  const { error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

### 4C: Add Automations link to Hub

In OverviewTab quick links, add:
```typescript
{ title: 'Automations', subtitle: 'SMS & email sequences', href: `/automations/${location.id}`, icon: 'Workflow' }
```

---

## PART 5: SIDEBAR RESTRUCTURE

The sidebar needs to handle the "no locations" state gracefully and include new links.

```
┌──────────────────────────┐
│  🌴 Jungle Driving School │
│     Franchise OS          │
│                           │
│  📊 Network Dashboard     │  ← /dashboard (corporate overview)
│  🏆 Rankings              │  ← /ranker
│  ⚡ Action Items          │  ← /actions
│  📈 Marketing             │  ← /marketing
│  🛡️ Compliance           │  ← /compliance
│                           │
│  ─── LOCATIONS ─────────  │
│  🌴 Omaha                 │  ← /hub/[id] (shown when locations exist)
│                           │
│  ─────────────────────── │
│  ⚙️ Manage Locations      │  ← /manage
└──────────────────────────┘
```

When 0 locations exist:
```
│  ─── LOCATIONS ─────────  │
│  No locations yet          │
│  + Add your first location │  ← links to /manage
│                           │
```

---

## BUILD ORDER

1. **Show user the wipe SQL** (Part 1). Wait for them to confirm they ran it.
2. Create types for leads (add to `src/lib/types.ts`)
3. Create `/api/manage/locations/route.ts` (Part 2C)
4. Create `/manage` page with Add Location modal (Part 2A, 2B)
5. Update Sidebar with Manage link + empty state (Part 5)
6. Create `/api/leads/route.ts` — list + create (Part 3A)
7. Create `/api/leads/[id]/route.ts` — detail + update + note (Part 3B)
8. Create lead components: LeadFilters, AddLeadModal, ActivityTimeline, StageDropdown (Part 3)
9. Create `/leads/[locationId]/page.tsx` — lead list (Part 3C)
10. Create `/leads/[locationId]/[leadId]/page.tsx` — lead detail (Part 3E)
11. Update Hub OverviewTab: activate Lead Pipeline link (Part 3F)
12. Create `/api/automations/route.ts` (Part 4B)
13. Create `/automations/[locationId]/page.tsx` (Part 4A)
14. Add Automations link to Hub OverviewTab (Part 4C)
15. Test: create a location via /manage → fill in settings on hub → add a lead → view detail → add note → change stage
16. Push to GitHub → Vercel auto-deploys

## AFTER THIS TASK

The automation **worker** (the thing that actually sends SMS/emails on a schedule) is NOT part of this task. Currently it runs as a separate Express process every 10 seconds. Options for later:
1. **Supabase Edge Function** on a cron (every 1 minute)
2. **Separate small Express/Node service** deployed to Vercel or Railway
3. **Vercel Cron** hitting a `/api/cron/process-automations` route every minute (requires Pro plan)

For now, automations can be viewed and toggled but the worker execution stays in the Express app if you want to run it locally.
