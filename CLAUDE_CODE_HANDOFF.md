# CLAUDE CODE HANDOFF — Jungle Driving School Dashboard

> **Read this entire document before writing any code.**
> This is the implementation plan for the franchise operating system frontend.
> The database is fully seeded with 30 days of data across 3 locations.

---

## 0. PREREQUISITES

Before starting, the user needs to provide:
- `NEXT_PUBLIC_SUPABASE_URL` — their Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — their Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — their Supabase service role key (for server-side API routes)

---

## 1. PROJECT SETUP

```bash
cd ~/Projects
npx create-next-app@latest jungle-dashboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack

cd jungle-dashboard

# Dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install recharts date-fns lucide-react
npm install clsx tailwind-merge

# Dev dependencies
npm install -D @types/node
```

---

## 2. FILE STRUCTURE

```
jungle-dashboard/
├── .env.local                          # Supabase keys (user provides)
├── docs/
│   └── PROJECT_BRIEF.md                # Copy from user's existing file
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with sidebar nav
│   │   ├── page.tsx                    # Redirect to /dashboard
│   │   ├── globals.css                 # Tailwind + custom styles
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Corporate overview (home)
│   │   ├── locations/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Location detail
│   │   ├── ranker/
│   │   │   └── page.tsx                # Franchise ranker/leaderboard
│   │   ├── marketing/
│   │   │   └── page.tsx                # Marketing dashboard
│   │   ├── compliance/
│   │   │   └── page.tsx                # Compliance overview
│   │   ├── actions/
│   │   │   └── page.tsx                # Action items (future)
│   │   └── api/
│   │       ├── dashboard/
│   │       │   └── route.ts            # Corporate overview data
│   │       ├── locations/
│   │       │   └── [id]/
│   │       │       └── route.ts        # Single location detail
│   │       ├── ranker/
│   │       │   └── route.ts            # All locations ranked
│   │       ├── marketing/
│   │       │   └── route.ts            # Ad spend + GBP data
│   │       ├── compliance/
│   │       │   └── route.ts            # Compliance items
│   │       ├── kpi-trends/
│   │       │   └── route.ts            # Time-series KPI data
│   │       └── cron/
│   │           └── kpi-rollup/
│   │               └── route.ts        # Daily KPI cron endpoint
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client
│   │   │   └── server.ts               # Server client (service role)
│   │   ├── types.ts                    # TypeScript interfaces
│   │   └── utils.ts                    # Helpers (cn, formatters)
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx             # Navigation sidebar
│       │   └── Header.tsx              # Page header with breadcrumbs
│       ├── ui/
│       │   ├── KpiCard.tsx             # Metric card with trend
│       │   ├── StatusBadge.tsx         # Color-coded status pill
│       │   ├── SparklineChart.tsx      # Tiny inline chart
│       │   └── DataTable.tsx           # Sortable table
│       └── dashboard/
│           ├── LocationSummaryTable.tsx # Location comparison table
│           ├── KpiTrendChart.tsx        # Recharts line/bar chart
│           ├── LeadFunnel.tsx           # Lead pipeline viz
│           └── ComplianceGauge.tsx      # Compliance score visual
```

---

## 3. ENVIRONMENT VARIABLES

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=generate-a-random-string-here
```

---

## 4. SUPABASE CLIENTS

### `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts`
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-side client with service role key — bypasses RLS
// ONLY use in API routes, never expose to client
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

## 5. TYPESCRIPT TYPES

### `src/lib/types.ts`

```typescript
// === Location ===
export interface Location {
  id: string
  organization_id: string
  name: string
  slug: string
  is_active: boolean
}

// === KPI Daily Snapshot ===
export interface KpiDaily {
  id: string
  location_id: string
  date: string
  // Leads
  new_leads: number
  leads_contacted: number
  leads_enrolled: number
  contact_rate: number
  // Calls
  total_calls_inbound: number
  total_calls_outbound: number
  calls_answered: number
  calls_missed: number
  missed_call_rate: number
  // Students
  active_students: number
  new_enrollments: number
  completions: number
  withdrawals: number
  // Operations
  active_instructors: number
  active_vehicles: number
  vehicles_in_maintenance: number
  // Financial
  revenue_collected: number
  revenue_outstanding: number
  // Compliance
  compliance_score: number
  compliance_items_current: number
  compliance_items_expiring: number
  compliance_items_expired: number
  // Ads
  total_ad_spend: number
  total_impressions: number
  total_clicks: number
  cost_per_lead: number
  // GBP
  gbp_overall_rating: number
  gbp_total_reviews: number
  gbp_unreplied_reviews: number
  gbp_search_views: number
  gbp_maps_views: number
  gbp_website_clicks: number
  gbp_phone_calls: number
  // Reviews
  avg_review_score: number
}

// === Corporate Dashboard ===
export interface CorporateDashboardData {
  locations: LocationSummary[]
  totals: NetworkTotals
  trends: KpiTrend[]
}

export interface LocationSummary {
  id: string
  name: string
  active_students: number
  new_leads_7d: number
  contact_rate: number
  missed_call_rate: number
  compliance_score: number
  gbp_rating: number
  gbp_unreplied_reviews: number
  revenue_collected_7d: number
  ad_spend_7d: number
  cost_per_lead: number
}

export interface NetworkTotals {
  total_active_students: number
  total_new_leads_7d: number
  avg_contact_rate: number
  avg_compliance_score: number
  avg_gbp_rating: number
  total_revenue_7d: number
  total_ad_spend_7d: number
  total_unreplied_reviews: number
}

export interface KpiTrend {
  date: string
  location_name: string
  new_leads: number
  active_students: number
  revenue_collected: number
  compliance_score: number
}

// === Ranker ===
export interface RankerRow {
  id: string
  name: string
  active_students: number
  new_leads_7d: number
  leads_enrolled_7d: number
  contact_rate: number
  missed_call_rate: number
  compliance_score: number
  gbp_rating: number
  unreplied_reviews: number
  cost_per_lead_7d: number
  revenue_7d: number
  ad_spend_7d: number
}

// === Location Detail ===
export interface LocationDetail {
  location: Location
  today: KpiDaily
  trends: KpiDaily[]
  students: StudentSummary[]
  instructors: InstructorSummary[]
  vehicles: VehicleSummary[]
  compliance_items: ComplianceItem[]
  recent_reviews: GbpReview[]
}

export interface StudentSummary {
  id: string
  first_name: string
  last_name: string
  status: string
  program_type: string
  lessons_completed: number
  lessons_remaining: number
  classroom_hours_completed: number
  classroom_hours_remaining: number
  balance_due: number
  enrolled_at: string
}

export interface InstructorSummary {
  id: string
  first_name: string
  last_name: string
  status: string
  avg_student_rating: number
  hire_date: string
}

export interface VehicleSummary {
  id: string
  make: string
  model: string
  year: number
  status: string
  mileage: number
}

export interface ComplianceItem {
  id: string
  entity_type: string
  entity_name: string
  compliance_type: string
  expiry_date: string
  status: string
  days_until_expiry: number
}

export interface GbpReview {
  id: string
  reviewer_name: string
  star_rating: number
  review_text: string
  review_date: string
  has_reply: boolean
  reply_text: string | null
  sentiment: string
}

// === Marketing ===
export interface MarketingData {
  ad_spend_by_location: AdSpendSummary[]
  ad_spend_trends: AdSpendTrend[]
  gbp_metrics: GbpMetricsSummary[]
}

export interface AdSpendSummary {
  location_id: string
  location_name: string
  source: string
  total_spend: number
  total_impressions: number
  total_clicks: number
  total_conversions: number
  avg_cpl: number
}

export interface AdSpendTrend {
  date: string
  location_name: string
  source: string
  spend: number
  clicks: number
  conversions: number
}

export interface GbpMetricsSummary {
  location_id: string
  location_name: string
  overall_rating: number
  total_reviews: number
  unreplied_count: number
  avg_search_views_7d: number
  avg_maps_views_7d: number
  avg_website_clicks_7d: number
}
```

---

## 6. UTILITY HELPERS

### `src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function getScoreColor(score: number, thresholds: { green: number; yellow: number }): string {
  if (score >= thresholds.green) return 'text-emerald-600'
  if (score >= thresholds.yellow) return 'text-amber-500'
  return 'text-red-500'
}

export function getBgScoreColor(score: number, thresholds: { green: number; yellow: number }): string {
  if (score >= thresholds.green) return 'bg-emerald-50 border-emerald-200'
  if (score >= thresholds.yellow) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}
```

---

## 7. API ROUTES — EXACT QUERIES

These are the API routes that serve data to the frontend. All use the service role client (bypasses RLS for now — auth added later).

**CRITICAL SCHEMA NOTES (read before writing any query):**
- `leads`: NO `status` column. Use `is_archived = FALSE AND converted_at IS NULL` for active leads
- `leads.source` is an enum — cast with `::TEXT` if needed
- `call_tracking_records`: uses `call_start` (timestamp) not `call_date`, `call_type` for answered/missed
- `students`: uses `enrolled_at` not `enrollment_date`
- `gbp_reviews`: uses `review_date` not `published_at`, `has_reply` (boolean)
- `kpi_daily`: uses `total_calls_inbound` (not `calls_inbound`), `total_ad_spend` (not `ad_spend_total`)

### 7a. `src/app/api/dashboard/route.ts` — Corporate Overview

Returns: network totals, per-location summaries, 30-day trends.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  // Get all active locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, slug')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)
    .order('name')

  if (!locations) return NextResponse.json({ error: 'No locations found' }, { status: 404 })

  // Get today's KPI snapshot for each location
  const { data: todayKpis } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('date', new Date().toISOString().split('T')[0])
    .in('location_id', locations.map(l => l.id))

  // Get 7-day aggregates per location
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const { data: weekKpis } = await supabase
    .from('kpi_daily')
    .select('location_id, new_leads, leads_enrolled, revenue_collected, total_ad_spend, cost_per_lead')
    .gte('date', sevenDaysAgoStr)
    .in('location_id', locations.map(l => l.id))

  // Get 30-day trends for charts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: trends } = await supabase
    .from('kpi_daily')
    .select('date, location_id, new_leads, active_students, revenue_collected, compliance_score, total_ad_spend, cost_per_lead, gbp_overall_rating, missed_call_rate')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locations.map(l => l.id))
    .order('date')

  // Build per-location summaries
  const locationSummaries = locations.map(loc => {
    const today = todayKpis?.find(k => k.location_id === loc.id)
    const weekData = weekKpis?.filter(k => k.location_id === loc.id) || []
    const sum = (arr: any[], field: string) => arr.reduce((s, r) => s + Number(r[field] || 0), 0)

    return {
      id: loc.id,
      name: loc.name,
      slug: loc.slug,
      active_students: today?.active_students || 0,
      new_leads_7d: sum(weekData, 'new_leads'),
      contact_rate: Number(today?.contact_rate || 0),
      missed_call_rate: Number(today?.missed_call_rate || 0),
      compliance_score: Number(today?.compliance_score || 0),
      gbp_rating: Number(today?.gbp_overall_rating || 0),
      gbp_unreplied_reviews: today?.gbp_unreplied_reviews || 0,
      revenue_collected_7d: sum(weekData, 'revenue_collected'),
      ad_spend_7d: sum(weekData, 'total_ad_spend'),
      cost_per_lead: Number(today?.cost_per_lead || 0),
    }
  })

  // Build network totals
  const totals = {
    total_active_students: locationSummaries.reduce((s, l) => s + l.active_students, 0),
    total_new_leads_7d: locationSummaries.reduce((s, l) => s + l.new_leads_7d, 0),
    avg_contact_rate: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.contact_rate, 0) / locationSummaries.length : 0,
    avg_compliance_score: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.compliance_score, 0) / locationSummaries.length : 0,
    avg_gbp_rating: locationSummaries.length ? locationSummaries.reduce((s, l) => s + l.gbp_rating, 0) / locationSummaries.length : 0,
    total_revenue_7d: locationSummaries.reduce((s, l) => s + l.revenue_collected_7d, 0),
    total_ad_spend_7d: locationSummaries.reduce((s, l) => s + l.ad_spend_7d, 0),
    total_unreplied_reviews: locationSummaries.reduce((s, l) => s + l.gbp_unreplied_reviews, 0),
  }

  // Enrich trends with location names
  const enrichedTrends = (trends || []).map(t => ({
    ...t,
    location_name: locations.find(l => l.id === t.location_id)?.name || 'Unknown'
  }))

  return NextResponse.json({ locations: locationSummaries, totals, trends: enrichedTrends })
}
```

### 7b. `src/app/api/ranker/route.ts` — Franchise Leaderboard

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations) return NextResponse.json({ error: 'No locations' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  // Today's snapshot
  const { data: todayKpis } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('date', today)
    .in('location_id', locations.map(l => l.id))

  // 7-day data for aggregates
  const { data: weekKpis } = await supabase
    .from('kpi_daily')
    .select('location_id, new_leads, leads_enrolled, revenue_collected, total_ad_spend, cost_per_lead')
    .gte('date', sevenDaysAgoStr)
    .in('location_id', locations.map(l => l.id))

  const rows = locations.map(loc => {
    const today_kpi = todayKpis?.find(k => k.location_id === loc.id)
    const week = weekKpis?.filter(k => k.location_id === loc.id) || []
    const sum = (arr: any[], f: string) => arr.reduce((s, r) => s + Number(r[f] || 0), 0)
    const avg = (arr: any[], f: string) => arr.length ? sum(arr, f) / arr.length : 0

    return {
      id: loc.id,
      name: loc.name,
      active_students: today_kpi?.active_students || 0,
      new_leads_7d: sum(week, 'new_leads'),
      leads_enrolled_7d: sum(week, 'leads_enrolled'),
      contact_rate: Number(today_kpi?.contact_rate || 0),
      missed_call_rate: Number(today_kpi?.missed_call_rate || 0),
      compliance_score: Number(today_kpi?.compliance_score || 0),
      gbp_rating: Number(today_kpi?.gbp_overall_rating || 0),
      unreplied_reviews: today_kpi?.gbp_unreplied_reviews || 0,
      cost_per_lead_7d: avg(week, 'cost_per_lead'),
      revenue_7d: sum(week, 'revenue_collected'),
      ad_spend_7d: sum(week, 'total_ad_spend'),
    }
  })

  return NextResponse.json({ rows })
}
```

### 7c. `src/app/api/locations/[id]/route.ts` — Location Detail

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const locationId = params.id

  // Location info
  const { data: location } = await supabase
    .from('locations')
    .select('id, name, slug, organization_id, is_active')
    .eq('id', locationId)
    .single()

  if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Today's KPI
  const { data: todayKpi } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .eq('date', today)
    .single()

  // 30-day trends
  const { data: trends } = await supabase
    .from('kpi_daily')
    .select('*')
    .eq('location_id', locationId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date')

  // Students
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, status, program_type, total_lessons_purchased, lessons_completed, lessons_remaining, classroom_hours_completed, classroom_hours_remaining, balance_due, enrolled_at')
    .eq('location_id', locationId)
    .in('status', ['active', 'completed'])
    .order('status')
    .order('last_name')

  // Instructors
  const { data: instructors } = await supabase
    .from('instructors')
    .select('id, first_name, last_name, status, avg_student_rating, hire_date')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('last_name')

  // Vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, make, model, year, status, mileage')
    .eq('location_id', locationId)
    .order('year', { ascending: false })

  // Compliance items
  const { data: compliance } = await supabase
    .from('compliance_items')
    .select('id, entity_type, entity_name, compliance_type, expiry_date, status, days_until_expiry')
    .eq('location_id', locationId)
    .order('days_until_expiry')

  // Recent GBP reviews (last 30 days)
  const { data: reviews } = await supabase
    .from('gbp_reviews')
    .select('id, reviewer_name, star_rating, review_text, review_date, has_reply, reply_text, sentiment')
    .eq('location_id', locationId)
    .order('review_date', { ascending: false })
    .limit(20)

  return NextResponse.json({
    location,
    today: todayKpi,
    trends: trends || [],
    students: students || [],
    instructors: instructors || [],
    vehicles: vehicles || [],
    compliance_items: compliance || [],
    recent_reviews: reviews || [],
  })
}
```

### 7d. `src/app/api/marketing/route.ts` — Marketing Dashboard

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()
  
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations) return NextResponse.json({ error: 'No locations' }, { status: 404 })
  const locationIds = locations.map(l => l.id)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  // Ad spend daily (30 days, all locations)
  const { data: adSpend } = await supabase
    .from('ad_spend_daily')
    .select('location_id, date, source, spend, impressions, clicks, conversions, cpa')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locationIds)
    .order('date')

  // GBP metrics daily (30 days)
  const { data: gbpMetrics } = await supabase
    .from('gbp_metrics_daily')
    .select('location_id, date, overall_rating, total_review_count, search_views, maps_views, website_clicks, phone_calls, direction_requests')
    .gte('date', thirtyDaysAgoStr)
    .in('location_id', locationIds)
    .order('date')

  // Unreplied reviews count per location
  const { data: unrepliedReviews } = await supabase
    .from('gbp_reviews')
    .select('location_id')
    .eq('has_reply', false)
    .in('location_id', locationIds)

  // Build per-location ad spend summaries
  const adSpendByLocation = locationIds.flatMap(locId => {
    const locName = locations.find(l => l.id === locId)?.name || ''
    const locData = adSpend?.filter(a => a.location_id === locId) || []
    const sources = [...new Set(locData.map(a => a.source))]
    
    return sources.map(source => {
      const sourceData = locData.filter(a => a.source === source)
      return {
        location_id: locId,
        location_name: locName,
        source,
        total_spend: sourceData.reduce((s, r) => s + Number(r.spend), 0),
        total_impressions: sourceData.reduce((s, r) => s + Number(r.impressions), 0),
        total_clicks: sourceData.reduce((s, r) => s + Number(r.clicks), 0),
        total_conversions: sourceData.reduce((s, r) => s + Number(r.conversions), 0),
        avg_cpl: sourceData.length ? sourceData.reduce((s, r) => s + Number(r.cpa || 0), 0) / sourceData.length : 0,
      }
    })
  })

  // Build ad spend trends (daily, enriched with location name)
  const adSpendTrends = (adSpend || []).map(a => ({
    ...a,
    location_name: locations.find(l => l.id === a.location_id)?.name || ''
  }))

  // Build GBP summaries per location
  const gbpSummaries = locationIds.map(locId => {
    const locName = locations.find(l => l.id === locId)?.name || ''
    const locGbp = gbpMetrics?.filter(g => g.location_id === locId) || []
    const latest = locGbp[locGbp.length - 1]
    const last7 = locGbp.slice(-7)
    const avg = (arr: any[], f: string) => arr.length ? arr.reduce((s, r) => s + Number(r[f] || 0), 0) / arr.length : 0

    return {
      location_id: locId,
      location_name: locName,
      overall_rating: Number(latest?.overall_rating || 0),
      total_reviews: latest?.total_review_count || 0,
      unreplied_count: unrepliedReviews?.filter(r => r.location_id === locId).length || 0,
      avg_search_views_7d: avg(last7, 'search_views'),
      avg_maps_views_7d: avg(last7, 'maps_views'),
      avg_website_clicks_7d: avg(last7, 'website_clicks'),
    }
  })

  return NextResponse.json({
    ad_spend_by_location: adSpendByLocation,
    ad_spend_trends: adSpendTrends,
    gbp_metrics: gbpSummaries,
  })
}
```

### 7e. `src/app/api/compliance/route.ts` — Compliance Overview

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET() {
  const supabase = createServiceClient()

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations) return NextResponse.json({ error: 'No locations' }, { status: 404 })

  // All compliance items across all locations
  const { data: items } = await supabase
    .from('compliance_items')
    .select('id, location_id, entity_type, entity_name, compliance_type, expiry_date, status, days_until_expiry')
    .in('location_id', locations.map(l => l.id))
    .order('days_until_expiry')

  // Enrich with location names + build per-location summaries
  const enrichedItems = (items || []).map(item => ({
    ...item,
    location_name: locations.find(l => l.id === item.location_id)?.name || ''
  }))

  const summaries = locations.map(loc => {
    const locItems = enrichedItems.filter(i => i.location_id === loc.id)
    return {
      location_id: loc.id,
      location_name: loc.name,
      total: locItems.length,
      current: locItems.filter(i => i.status === 'current').length,
      expiring_soon: locItems.filter(i => i.status === 'expiring_soon').length,
      expired: locItems.filter(i => i.status === 'expired').length,
      score: locItems.length ? Math.round((locItems.filter(i => i.status === 'current').length / locItems.length) * 1000) / 10 : 100,
    }
  })

  return NextResponse.json({ items: enrichedItems, summaries })
}
```

### 7f. `src/app/api/cron/kpi-rollup/route.ts` — Daily Cron

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('run_daily_kpi_rollup', { p_target_date: today })

  if (error) {
    console.error('KPI rollup failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, result: data })
}

// Also allow GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request)
}
```

---

## 8. PAGE COMPONENTS — DESIGN GUIDANCE

### Design System

| Element | Style |
|---------|-------|
| Background | `bg-gray-50` (main), `bg-white` (cards) |
| Cards | `bg-white rounded-xl shadow-sm border border-gray-200 p-6` |
| Headers | `text-2xl font-bold text-gray-900` |
| Subtext | `text-sm text-gray-500` |
| Good | `text-emerald-600`, `bg-emerald-50` |
| Warning | `text-amber-500`, `bg-amber-50` |
| Bad | `text-red-500`, `bg-red-50` |
| Sidebar | `bg-gray-900 text-white w-64` |
| Active nav | `bg-gray-800 text-white` |
| Table headers | `text-xs font-medium text-gray-500 uppercase tracking-wider` |

### Sidebar Navigation

| Label | Path | Icon (lucide-react) |
|-------|------|---------------------|
| Dashboard | /dashboard | `LayoutDashboard` |
| Rankings | /ranker | `Trophy` |
| Marketing | /marketing | `Megaphone` |
| Compliance | /compliance | `ShieldCheck` |
| Action Items | /actions | `Zap` |

Location links appear under a "Locations" section heading in the sidebar, fetched from the API.

### Page: Corporate Dashboard (`/dashboard`)

**Top row:** 4 KPI cards showing network totals
- Total Active Students (icon: Users)
- New Leads (7d) (icon: UserPlus)
- Avg Compliance Score (icon: ShieldCheck)
- Total Revenue (7d) (icon: DollarSign)

Each card shows the number large, with color coding based on thresholds.

**Middle row:** 2 Recharts charts side by side
- Line chart: Active students over 30 days (one line per location)
- Bar chart: Revenue collected over 30 days (stacked by location)

**Bottom:** Location summary table (sortable)
- Columns: Location, Students, Leads (7d), Contact Rate, Missed Calls, Compliance, GBP Rating, Unreplied Reviews, Revenue (7d), CPL
- Row click → navigates to `/locations/[id]`
- Color-code cells: green/yellow/red based on thresholds

### Page: Location Detail (`/locations/[id]`)

**Top:** Location name + 6 KPI cards (students, contact rate, compliance, GBP rating, revenue, missed call rate)

**Charts section:** 2 trend charts
- Line: compliance_score + missed_call_rate over 30 days
- Bar: new_leads + revenue over 30 days

**Tables section:** Tabs or accordion for:
- Students (name, status, program, drives completed/remaining, classroom hours, balance)
- Instructors (name, status, rating, hire date)
- Vehicles (make/model/year, status, mileage)
- Compliance Items (entity, type, expiry, status — color-coded)
- Recent Reviews (reviewer, rating, text, replied status)

### Page: Franchise Ranker (`/ranker`)

Full-width sortable table. Click any column header to sort.
Columns: Rank, Location, Students, Leads (7d), Contact Rate, Missed Call %, Compliance, GBP Rating, Unreplied Reviews, CPL, Revenue (7d), Ad Spend (7d)

Highlight: green background for best in each column, red for worst.

### Page: Marketing (`/marketing`)

**Top row:** Per-location GBP cards (rating, total reviews, unreplied count, avg search views)

**Middle:** Recharts area chart — daily ad spend by location (30 days)

**Bottom:** Ad spend table grouped by location × source
Columns: Location, Source, Spend, Impressions, Clicks, Conversions, Avg CPL

### Page: Compliance (`/compliance`)

**Top:** Per-location compliance score cards (score %, current/expiring/expired counts)

**Bottom:** Full compliance items table
Columns: Location, Entity, Type, Expiry Date, Days Until Expiry, Status
Status badges: green "Current", yellow "Expiring Soon", red "Expired"
Sort: expired first, then expiring, then current.

---

## 9. DATA FETCHING PATTERN

All pages use the same client-side fetch pattern:

```typescript
'use client'
import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const [data, setData] = useState<CorporateDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data) return <ErrorState />

  return (/* ... */)
}
```

Alternatively, Claude Code can use Server Components with `async` pages and fetch data directly on the server using the service client. Either approach works — pick one and be consistent.

---

## 10. VERCEL DEPLOYMENT

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/kpi-rollup",
      "schedule": "30 12 * * *"
    }
  ]
}
```

After building:
```bash
cd ~/Projects/jungle-dashboard
git init
git add .
git commit -m "Initial dashboard build"
# User creates repo on GitHub, pushes, connects to Vercel
```

---

## 11. BUILD ORDER (for Claude Code)

Do these in order. Verify each step works before moving on.

1. **Scaffold project** (Section 1 setup commands)
2. **Create `.env.local`** (ask user for keys)
3. **Create lib files** (`supabase/client.ts`, `supabase/server.ts`, `types.ts`, `utils.ts`)
4. **Create API routes** (all 6 routes from Section 7)
5. **Create layout + sidebar** (`layout.tsx`, `Sidebar.tsx`)
6. **Create reusable components** (`KpiCard.tsx`, `StatusBadge.tsx`, `DataTable.tsx`)
7. **Build Corporate Dashboard page** (`/dashboard`)
8. **Build Ranker page** (`/ranker`)
9. **Build Location Detail page** (`/locations/[id]`)
10. **Build Marketing page** (`/marketing`)
11. **Build Compliance page** (`/compliance`)
12. **Test locally** (`npm run dev`)
13. **Deploy to Vercel**

---

## 12. CRITICAL REMINDERS

- **Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d` (hardcoded for now, parameterize later with auth)
- **Location IDs:** Omaha `27d7b25d-...`, Lincoln `c5fdf98d-...`, Bellevue `bec4068e-...`
- **The database has 31 days of seed data** (Jan 8 – Feb 7, 2026) — dashboards should show real numbers
- **No auth yet.** Skip login flow. All API routes use service role key. Add auth in Phase 2.
- **Read `docs/PROJECT_BRIEF.md`** for full schema reference and gotchas
- **Schema gotchas are in Section 13 of PROJECT_BRIEF.md** — read them before writing ANY Supabase query
