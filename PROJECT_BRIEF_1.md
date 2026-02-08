# FRANCHISE OPERATING SYSTEM — PROJECT BRIEF

> **Single source of truth.** This document captures every decision, every table, every rule, every file, and every open item for the franchise operating system build. Drop this into `docs/PROJECT_BRIEF.md` in the repo. When starting a Claude Code session, tell it: "Read `docs/PROJECT_BRIEF.md` before doing anything."
>
> **Last updated:** 2026-02-07

---

## TABLE OF CONTENTS

1. [Business Context](#1-business-context)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema — Complete Reference](#4-database-schema--complete-reference)
5. [SQL Migrations — Deployed & Pending](#5-sql-migrations--deployed--pending)
6. [Action Engine — Business Rules](#6-action-engine--business-rules)
7. [KPI Cron System](#7-kpi-cron-system)
8. [Dashboard Frontend](#8-dashboard-frontend)
9. [Integration Pipelines (Make.com)](#9-integration-pipelines-makecom)
10. [TypeScript Files — Complete Inventory](#10-typescript-files--complete-inventory)
11. [Environment Variables](#11-environment-variables)
12. [Project Status — Master Checklist](#12-project-status--master-checklist)
13. [Known Schema Gotchas](#13-known-schema-gotchas)
14. [Phase Roadmap](#14-phase-roadmap)
15. [Cost Projections](#15-cost-projections)
16. [Workflow Instructions for Claude Code](#16-workflow-instructions-for-claude-code)

---

## 1. BUSINESS CONTEXT

**Company:** Jungle Driving School (driving school franchise)
**Role:** COO (building everything solo for now; hiring a "figure-it-out" ops/tech person later in 2026)
**Current locations:** 3 — Omaha (mid), Lincoln (weakest), Bellevue (strongest)
**Organization UUID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`
**Growth plan:** ~4 new locations per month → ~51 locations in 12 months
**CRM:** Driveato (will send nightly JSON data exports per location)
**Lead management / automations:** GoHighLevel (GHL)
**Call tracking:** CallTrackingMetrics
**Ads:** Google Ads (separate sub-accounts per location under MCC), Meta Ads (separate ad accounts per location, one Business Manager)
**Online presence:** Google Business Profile (separate per location), Facebook pages, Instagram

**The vision:** Not just dashboards. This is a **franchise operating system** — it ingests data from every source, synthesizes it, and tells franchisees exactly what to do. "You have 12 uncontacted leads older than 24 hours. Your Tuesday instructor schedule is only 40% booked but you have a waitlist on Thursday. Your Google Ads CPA went up 30% this week — here's what to adjust."

**Two audiences:**
- **Corporate (COO):** See all locations, benchmarks, identify who needs help vs who's crushing it
- **Franchisees:** See their own location only (RLS enforced), get actionable recommendations

**Parallel project:** A custom lead management automation platform is being built in a separate conversation/codebase. It shares the same Supabase database (organizations, locations, users, leads, activity_logs tables). The two systems use the same foundation but don't step on each other. They'll merge into one unified tool eventually.

### Location UUIDs (reference for all code/queries)

| Location | UUID | Profile |
|----------|------|---------|
| Omaha | `27d7b25d-d329-4cbd-8a43-d3bb3664bbab` | Mid performer — 4 instructors, 3 vehicles, 8 active students |
| Lincoln | `c5fdf98d-6d2b-4fea-a515-0c063ae48bec` | Problem location — highest CPL, lowest contact rate, expired compliance, worst reviews |
| Bellevue | `bec4068e-1799-4859-87db-344c40c9ec73` | Top performer — fastest lead response, best GBP rating, highest conversion |

---

## 2. TECH STACK

| Layer | Tool | Purpose |
|-------|------|---------|
| Database | Supabase (managed Postgres) | Central data store, auth, RLS, real-time |
| Backend | Next.js (API routes) | Server-side logic, cron endpoints |
| Frontend | Next.js + React + Tailwind | Dashboard UI |
| Hosting | Vercel | Deploy, cron scheduling |
| Integrations | Make.com (Integromat) | Data pipelines from Google Ads, Meta, CTM, GBP |
| Scheduling | Vercel Cron | Daily KPI calculation + action engine at 7 AM Central |

**Why Supabase:** Managed Postgres handles 50+ locations. Row-level security gives each franchisee their own view. Real-time subscriptions possible later. Not a data warehouse — plan to add analytical layer (BigQuery or read replica) in year two.

**Why Make.com over direct API:** Google Ads API requires developer token approval (weeks), Meta Marketing API is complex. Make.com handles OAuth, pagination, rate limits, and error handling. One scenario per location for clean data mapping.

---

## 3. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                              │
│  Driveato (JSON) │ GHL │ CTM │ Google Ads │ Meta │ GBP     │
└──────────┬────────┴──┬──┴──┬──┴─────┬──────┴──┬──┴──┬──────┘
           │           │     │        │         │     │
           ▼           ▼     ▼        ▼         ▼     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Make.com PIPELINES                           │
│  Normalize → Map to location_id → Write to Supabase          │
│  (Each source has its own scenario, runs on schedule)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Postgres)                        │
│                                                               │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐     │
│  │ Raw Data     │ │ Derived Data │ │ Action Items      │     │
│  │ Tables       │ │ (kpi_daily,  │ │ (recommendations) │     │
│  │ (leads, ads, │ │  benchmarks) │ │                   │     │
│  │  calls, etc) │ │              │ │                   │     │
│  └──────┬──────┘ └──────┬───────┘ └────────┬──────────┘     │
│         │               │                   │                 │
│  RLS: franchisees see only their location_id                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ KPI Cron       │ │ Action       │ │ Next.js Frontend  │
│ (daily rollup) │ │ Engine       │ │ (dashboards)      │
│ 6:30 AM CT     │ │ (daily eval) │ │                   │
│                │ │ 7:00 AM CT   │ │ Corporate overview│
└────────────────┘ └──────────────┘ │ Franchise ranker  │
                                     │ Location detail   │
                                     │ Action items page │
                                     │ Marketing dash    │
                                     │ Compliance dash   │
                                     └──────────────────┘
```

**Daily Pipeline Sequence:**
1. **Overnight:** Make.com scenarios pull data from Google Ads, Meta, CTM, GBP, etc. into raw tables
2. **6:30 AM CT (noon UTC):** KPI Cron runs → rolls up raw data into `kpi_daily` + updates `network_benchmarks`
3. **7:00 AM CT (1 PM UTC):** Action Engine runs → evaluates all 18 rules for each location → writes/updates `action_items`
4. **7:30 AM CT:** Franchisees open dashboard and see today's recommendations

---

## 4. DATABASE SCHEMA — COMPLETE REFERENCE

### Pre-existing tables (from lead management project)

These tables existed before the dashboard project. DO NOT modify them.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `organizations` | id, name | Top-level entity |
| `locations` | id, organization_id, name, is_active | Each franchise location |
| `users` | id, organization_id, role | Auth users |
| `leads` | id, location_id, first_name, last_name, email, phone, source (enum→needs ::TEXT cast), is_archived (boolean), converted_at (timestamp), stage_id (UUID), created_at | **NO `status` column.** Use `is_archived = FALSE AND converted_at IS NULL` for active leads |
| `activity_logs` | id, lead_id, activity_type, channel, direction, created_at | Tracks all lead contact activity |

### Migration 002: Dashboard Extension (12 tables) — DEPLOYED ✅

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `integration_syncs` | Track when each data source last synced | integration_type, location_id, last_sync_at, status, records_synced |
| `integration_credentials` | Store API keys/tokens per integration | integration_type, location_id, credentials (JSONB, encrypted at rest) |
| `ad_spend_daily` | Google Ads + Meta daily spend data | location_id, date, source, campaign_name, spend, impressions, clicks, conversions, cpa, roas |
| `call_tracking_records` | CallTrackingMetrics call data | location_id, **call_start** (timestamp), caller_number, tracking_number, duration_seconds, **call_type** (answered/missed/voicemail), direction, has_recording |
| `students` | Student enrollment records | location_id, first_name, last_name, email, **enrolled_at** (timestamp), status, program_type, package_name, total_paid, total_owed, balance_due, **total_lessons_purchased** (=drives), **lessons_completed**, **lessons_remaining**, referral_source |
| `instructors` | Instructor records | location_id, first_name, last_name, status, hire_date, instructor_cert_expiry, avg_student_rating |
| `vehicles` | Fleet management | location_id, make, model, year, vin, status, last_inspection_date, next_inspection_due, insurance_expiry, mileage |
| `compliance_items` | Compliance tracking (auto-status trigger) | location_id, entity_type, entity_id, entity_name, compliance_type, expiry_date, status (auto-computed), days_until_expiry, resolved_at |
| `kpi_daily` | Daily KPI snapshots per location | location_id, date, ~30 metrics (leads, calls, students, instructors, vehicles, compliance, revenue, reviews) |
| `network_benchmarks` | Cross-location benchmark stats | organization_id, period_start, period_end, period_type, **named columns**: avg_new_leads_per_location, p75_new_leads, avg_contact_rate, p75_contact_rate, avg_cost_per_lead, p25_cost_per_lead, avg_missed_call_rate, p25_missed_call_rate, avg_revenue, p75_revenue, avg_compliance_score, p25_compliance_score, avg_review_score, p75_review_score |
| `action_items` | Action engine recommendations | location_id, organization_id, rule_id, category, priority, status, title, description, recommended_action, data_context (JSONB), generated_by, expires_at |
| `ghl_pipeline_records` | GoHighLevel pipeline data bridge | location_id, ghl_contact_id, ghl_pipeline_id, ghl_stage_name, ghl_opportunity_value, ghl_last_activity |

**Includes:** 30+ indexes, 13 RLS policies, 9 triggers (including auto-compliance status trigger)

### Migration 003: GBP & Social Media (5 tables + 15 kpi_daily columns) — DEPLOYED ✅

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `gbp_locations` | GBP location profiles | location_id, place_id, gbp_name, address, overall_rating, total_reviews, primary_category. **Note: May not exist — GBP rating actually lives in `gbp_metrics_daily`** |
| `gbp_metrics_daily` | GBP discovery metrics | location_id, date, overall_rating, total_review_count, search_views, maps_views, total_views, website_clicks, phone_calls, direction_requests, booking_clicks, photo_views |
| `gbp_reviews` | Individual GBP reviews | location_id, gbp_review_id, reviewer_name, **star_rating**, review_text, **review_date**, reply_text, reply_date, **has_reply** (boolean), sentiment, tags |
| `social_media_accounts` | Facebook/Instagram accounts | location_id, platform, account_id, account_name, followers_count, is_active |
| `social_media_posts_daily` | Social media daily metrics | account_id, date, posts_count, reach, impressions, engagement, followers_gained |

**Also adds 15 columns to `kpi_daily`:**
gbp_overall_rating, gbp_new_reviews, gbp_unreplied_reviews, gbp_search_views, gbp_maps_views, gbp_website_clicks, gbp_phone_calls, gbp_direction_requests, meta_page_followers, meta_page_reach, meta_engagement_rate, ig_followers, ig_reach, ig_engagement_rate, social_posts_published

### Migration 004: Action Engine SQL Helpers (4 functions) — DEPLOYED ✅

| Function | Purpose | Notes |
|----------|---------|-------|
| `get_uncontacted_leads(p_location_id, p_since)` | Find leads with no activity_log contact entries | Uses `is_archived = FALSE AND converted_at IS NULL`, casts `source::TEXT` |
| `get_missed_call_summary(p_location_id)` | 7-day missed call stats + worst hour | Reads from `call_tracking_records` |
| `calculate_kpi_snapshot(p_location_id, p_date)` | Roll up all raw data into one kpi_daily row | **Superseded by 005 rewrite** — 005 version includes GBP columns |
| `calculate_network_benchmarks(p_organization_id, p_start, p_end)` | Compute avg/p25/p50/p75 across all locations | **Superseded by 005 rewrite** — 005 version uses DELETE+INSERT pattern |

### Migration 005: KPI Cron Functions (clean slate rewrite) — DEPLOYED ✅

**Status:** Fixed and verified working across all 3 locations (2026-02-07).

Dropped all old broken functions and rebuilt from scratch. Three core functions:

| Function | Purpose | Notes |
|----------|---------|-------|
| `calculate_kpi_snapshot(p_location_id, p_date)` | Pulls data from 9 source tables into one `kpi_daily` row | Covers leads, calls, students, instructors, vehicles, compliance, financials, ad spend, GBP. Uses DELETE+INSERT pattern. |
| `calculate_network_benchmarks(p_org_id, p_start, p_end)` | Aggregates `kpi_daily` into percentile benchmarks | Calculates avg/p25/p75 for 7 key metrics. Uses DELETE+INSERT pattern. Stores in `network_benchmarks` with `period_type='weekly'`. |
| `run_daily_kpi_rollup(p_target_date)` | Orchestrator — the single entry point for cron | Loops all active locations → snapshot each → benchmarks per org. Returns JSONB with locations_processed, errors, error_details, results. Error handling: one broken location won't kill the whole run. |

**Cron entry point:** `SELECT run_daily_kpi_rollup(CURRENT_DATE);`
**Schedule:** 6:30 AM CT daily via Vercel Cron or Make.com

**Previous issues fixed:**
- `call_tracking_records` uses `call_type` for answered/missed (not `status`)
- `call_tracking_records` uses `call_start` (timestamp) not `call_date`
- `leads` has no `status` column — uses `is_archived`, `converted_at`, `stage_id`
- `students` uses `enrolled_at` not `enrollment_date`
- `gbp_reviews` uses `review_date` not `published_at`, `has_reply` boolean not `reply_text IS NULL`
- `kpi_daily` has `organization_id` (required, not nullable)
- `network_benchmarks` uses named columns (avg_new_leads_per_location, p75_new_leads, etc.) not generic metric_name/value
- GBP rating comes from `gbp_metrics_daily` (no `gbp_locations` table)
- Postgres `ROUND()` requires explicit `::NUMERIC` cast with 2 arguments

### Migration 006: Classes + Drives — DEPLOYED ✅

| Change | Details |
|--------|---------|
| `locations` table | Added: `state_min_classroom_hours`, `state_min_drive_hours`, `state_min_drive_count` |
| `students` table | Added: `classroom_hours_required`, `classroom_hours_completed`, `classroom_hours_remaining`, `road_test_purchased` |
| `classes` table (NEW) | Scheduled classroom courses — name, class_type (teen/adult/refresher), total_hours, start/end dates, capacity, enrolled_count, status, instructor, room |
| `class_enrollments` table (NEW) | Student ↔ class link — hours_attended, hours_remaining, status (enrolled/completed/withdrawn/no_show). UNIQUE(class_id, student_id) |
| `drive_appointments` table (NEW) | Individual BTW drive sessions — student, instructor, vehicle, scheduled_date/time, status (scheduled/completed/cancelled/no_show), student_performance, skills_practiced |

**Key model decisions:**
- `total_lessons_purchased` / `lessons_completed` / `lessons_remaining` on students = **BTW drives** (not classroom)
- Each drive appointment is always **1 hour**
- State has a required minimum drive count; student may purchase more than the minimum
- Classroom hours are tracked separately from drives
- Classes are multi-day courses (20-30 total hours depending on state + teen/adult)

Includes: 8 indexes, 3 RLS policies, 3 update triggers

---

## 5. SQL MIGRATIONS — DEPLOYED & PENDING

| # | File | Status | Notes |
|---|------|--------|-------|
| 001 | (Lead management base schema) | ✅ Deployed | organizations, locations, users, leads, activity_logs |
| 002 | `002_dashboard_extension.sql` | ✅ Deployed | 12 tables, 30+ indexes, 13 RLS policies, 9 triggers |
| 003 | `003_gbp_social_media.sql` | ✅ Deployed | 5 tables + 15 kpi_daily columns |
| 004 | `004_action_engine_helpers_v2.sql` | ✅ Deployed | 4 SQL functions (corrected for actual schema) |
| 005 | `005_kpi_cron_functions_v2.sql` | ✅ Deployed & Verified | 3 functions: calculate_kpi_snapshot, calculate_network_benchmarks, run_daily_kpi_rollup. Clean slate rewrite — all schema issues resolved. |
| 006 | `006_classes_drives.sql` | ✅ Deployed | 3 new tables (classes, class_enrollments, drive_appointments) + new columns on locations and students |

**TODO — Future migrations:**
- 007: Driveato JSON ingestion tables/functions (pending data format from Driveato team)
- 008: Update `calculate_kpi_snapshot` to include classroom/drive metrics from new tables
- 009: Backfill kpi_daily for 30 days (Jan 8 – Feb 6) to populate dashboard trends

---

## 6. ACTION ENGINE — BUSINESS RULES

### How it works

The Action Engine runs daily at 7:00 AM Central. For each active location, it:
1. Fetches 30 days of KPI data, raw lead/call/compliance/ad data, and network benchmarks
2. Builds a `RuleContext` object with everything
3. Runs all 18 enabled rules against the context
4. Each rule returns `null` (doesn't fire) or an `ActionItemOutput` (fires)
5. New actions are inserted into `action_items`, existing ones are updated, resolved ones are expired

### The 18 Rules

**LEAD FOLLOW-UP (3 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| LEAD_001 | Uncontacted leads > 2 hours | Any lead created 2+ hours ago with no activity_log contact entry | Critical: ≥10 leads. High: ≥5 or any >24h old. Medium: default |
| LEAD_002 | Contact rate below 70% | 7-day average contact rate < 70% | Critical: <50%. High: default |
| LEAD_003 | Enrollment rate dropping | Week-over-week enrollment rate drops ≥10 percentage points | High: ≥20pt drop. Medium: default |

**MARKETING / AD SPEND (3 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| MKT_001 | CPL spike | 7-day CPL is ≥30% above 30-day baseline | High: ≥50% increase. Medium: default |
| MKT_002 | Zero conversions | 3+ consecutive days of ad spend with zero conversions | Critical: >$300 spent. High: default |
| MKT_003 | CPL above benchmark | CPL is ≥25% above network average | High: ≥2x network. Medium: default |

**CALLS (1 rule)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| CALL_001 | Missed call rate | 7-day missed call rate ≥25% (min 10 calls) | Critical: ≥40%. High: default |

**COMPLIANCE (3 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| COMP_001 | Expired items | Any compliance item with status = 'expired' | Always critical |
| COMP_002 | Expiring soon | Items expiring within 14 days | High: any within 7 days. Medium: default |
| COMP_003 | Score below average | Compliance score < network avg AND < 90% | High: <75%. Medium: default |

**REPUTATION (2 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| REP_001 | Unreplied reviews | Any GBP review without reply_text | High: ≥2 negative. Medium: 1 negative or >3 stale. Low: default |
| REP_002 | Rating dropping | GBP rating < 4.5★ | High: <4.0★. Medium: default |

**OPERATIONS (3 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| OPS_001 | Low instructor utilization | 7-day avg utilization < 60% | High: <40%. Medium: default |
| OPS_002 | High no-show rate | 7-day no-show rate ≥10% (min 20 lessons) | High: ≥20%. Medium: default |
| OPS_003 | Vehicle capacity | ≥25% of fleet in maintenance | Critical: only 1 vehicle available. High: default |

**FINANCIAL (2 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| FIN_001 | Outstanding revenue growing | Outstanding balances grew ≥15% week-over-week AND >$1000 | High: >$5000. Medium: default |
| FIN_002 | Revenue per student declining | Revenue per student dropped ≥15% vs prior 2 weeks | Always medium |

**PERFORMANCE (2 rules)**

| ID | Name | Fires when | Priority logic |
|----|------|-----------|----------------|
| PERF_001 | Bottom quartile | Location in bottom quartile on ≥2 key metrics | High: ≥3 metrics. Medium: default |
| WIN_001 | Top performer 🏆 | Location in top quartile on ≥2 metrics | Always low (positive reinforcement) |

### Action Item Categories
`lead_followup`, `scheduling`, `marketing`, `compliance`, `operations`, `financial`, `performance`, `reputation`

### Priority Levels
`critical` → `high` → `medium` → `low`

### Generated By Types
`system_rule`, `benchmark_comparison`, `compliance_check`, `trend_alert`

---

## 7. KPI CRON SYSTEM

**Schedule:** Daily at 6:30 AM Central (12:30 PM UTC) — runs BEFORE the action engine

**What it does:**
1. Loops through all active locations
2. Calls `calculate_kpi_snapshot(location_id, today)` for each
3. Calls `calculate_network_benchmarks(org_id, 7_days_ago, today)` once per org
4. Logs results

**API endpoint:** `POST /api/cron/kpi-rollup`
- Protected by `CRON_SECRET` header
- Supports `?location_id=UUID` for single-location runs

**Current status:** ✅ Fully working. Tested 2026-02-07 across all 3 locations with zero errors. GBP columns are populated. Network benchmarks calculate correctly.

**Verified output (2026-02-07):**

| Metric | Bellevue ⭐ | Omaha | Lincoln ⚠️ |
|--------|-----------|-------|---------|
| Active Students | 9 | 8 | 6 |
| Contact Rate | 66.7% | 33.3% | 25.0% |
| Compliance Score | 100% | 100% | 88.9% |
| GBP Rating | 4.8 | 4.3 | 3.8 |
| CPL | $25.31 | $41.07 | $54.14 |
| Unreplied Reviews | 1 | 2 | 3 |

---

## 8. DASHBOARD FRONTEND

### Pages designed (with mock data)

| Page | File | Description |
|------|------|-------------|
| Corporate Dashboard | `CorporateDashboard.jsx` | Overview cards (total students, revenue, avg compliance, avg rating), sparkline charts, location summary table with sort |
| Franchise Ranker | `FranchiseRanker.jsx` | Sortable leaderboard across all locations on key metrics. Click column headers to re-sort. Color-coded performance indicators |
| Location Detail | `LocationDashboard.jsx` | Deep-dive into single location: KPI cards, lead funnel, instructor table, compliance status, action items |
| Marketing Dashboard | `marketing-dashboard-preview.jsx` | Ad spend by channel, CPL trends, GBP discovery metrics, social follower growth, per-location comparison |

### Design system
- Tailwind CSS
- Dark sidebar navigation
- Cards with subtle shadows
- Color coding: green = good, yellow = warning, red = critical
- Sparkline charts for trends
- Responsive (but desktop-first — franchisees mostly use desktop)

### Not yet built
- Action Items page (the "here's what to do" UI)
- Compliance detail page
- Student/instructor management pages
- Settings/admin pages
- Auth/login flow
- RLS-aware data fetching (currently mock data)

---

## 9. INTEGRATION PIPELINES (Make.com)

### Designed but not yet fully wired

| Pipeline | Source | Target table(s) | Schedule | Status |
|----------|--------|-----------------|----------|--------|
| Google Ads daily | Google Ads → Run Campaign Report | `ad_spend_daily` | Daily 2 AM | Guide written, user started setup |
| Meta Ads daily | Meta Ads → Get Campaign Insights | `ad_spend_daily` | Daily 2 AM | Guide written |
| CallTrackingMetrics | CTM → List Calls | `call_tracking_records` | Daily 1 AM | Guide written |
| GBP Reviews | Google My Business → List Reviews | `gbp_reviews`, `gbp_locations` | Every 6 hours | Guide written |
| GBP Metrics | Google My Business → Get Location Metrics | `gbp_metrics_daily` | Daily 3 AM | Guide written |
| Facebook Page | Facebook Pages → Get Page Insights | `social_media_posts_daily` | Daily 4 AM | Guide written |
| Instagram | Instagram → Get Account Insights | `social_media_posts_daily` | Daily 4 AM | Guide written |
| Driveato (students, instructors, vehicles) | JSON files → Parse | `students`, `instructors`, `vehicles` | Daily (on file receipt) | Waiting on Driveato team for data format |

### Make.com architecture decisions
- **One scenario per location per source** (not one MCC/BM-level scenario) — cleaner mapping, easier debugging, scales linearly with new locations
- **Raw data first:** Make.com writes to raw tables (ad_spend_daily, call_tracking_records, etc.). KPI Cron rolls up into kpi_daily. Never have Make.com write directly to reporting tables.
- **Supabase connection:** Each scenario uses a Supabase module with service role key
- **Error handling:** Each scenario should have an error handler that writes to `integration_syncs` with status = 'error'

### User's Make.com experience level
Beginner. Needed guidance on: creating scenarios, creating connections from inside scenario builder, scheduling scenarios, using the Iterator module (Flow Control), selecting report types for Google Ads. Keep instructions step-by-step with screenshots references.

---

## 10. TYPESCRIPT FILES — COMPLETE INVENTORY

### Action Engine files (ready for integration)

| File | Path (deploy to) | Description |
|------|-------------------|-------------|
| `rules.ts` | `src/lib/action-engine/rules.ts` | 18 business rules + type definitions |
| `engine.ts` | `src/lib/action-engine/engine.ts` | Main orchestrator: fetch data → run rules → write results |
| `api-route.ts` | `src/app/api/engine/evaluate/route.ts` | POST endpoint for Vercel Cron + manual triggers |

### Verified Supabase queries in engine.ts
All direct database queries have been verified against the live schema:
- ✅ `locations`: id, organization_id, name, is_active
- ✅ `students`: first_name, last_name, balance_due, lessons_remaining, status, updated_at, location_id
- ✅ `instructors`: first_name, last_name, avg_student_rating, instructor_cert_expiry, status, location_id
- ✅ `action_items`: All columns match (rule_id, status, category, priority, title, description, recommended_action, data_context, generated_by, expires_at, updated_at)
- ✅ `kpi_daily`: All columns match
- ✅ `compliance_items`: entity_type, entity_name, compliance_type, expiry_date, days_until_expiry, status, resolved_at
- ✅ `ad_spend_daily`: date, source, campaign_name, spend, clicks, conversions, cpa
- ⚠️ `gbp_reviews`: References `published_at` but actual column is `review_date`. **Needs fix before deploying.**
- ✅ RPC calls: `get_uncontacted_leads`, `get_missed_call_summary` — both gracefully degrade if not found

### Frontend files (mock data, need API wiring)

| File | Deploy to | Status |
|------|-----------|--------|
| `mockDashboardData.js` | `src/data/mockDashboardData.js` | Mock data — replace with Supabase calls |
| `CorporateDashboard.jsx` | `src/pages/CorporateDashboard.jsx` | UI built, needs real data |
| `FranchiseRanker.jsx` | `src/pages/FranchiseRanker.jsx` | UI built, needs real data |
| `LocationDashboard.jsx` | `src/pages/LocationDashboard.jsx` | UI built, needs real data |
| `marketing-dashboard-preview.jsx` | `src/pages/MarketingDashboard.jsx` | UI built, needs real data |

---

## 11. ENVIRONMENT VARIABLES

| Variable | Purpose | Where |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Existing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (for client-side) | Existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for server-side, bypasses RLS) | Existing |
| `ACTION_ENGINE_API_KEY` | Protects the action engine endpoint | NEW — needs creation |
| `CRON_SECRET` | Protects all cron endpoints (Vercel built-in) | NEW — needs creation |

### Vercel Cron configuration (add to `vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/kpi-rollup",
      "schedule": "30 12 * * *"
    },
    {
      "path": "/api/engine/evaluate",
      "schedule": "0 13 * * *"
    }
  ]
}
```

---

## 12. PROJECT STATUS — MASTER CHECKLIST

### ✅ COMPLETED

**Database**
- [x] Base schema (organizations, locations, users, leads, activity_logs)
- [x] 002: Dashboard extension — 12 tables deployed
- [x] 003: GBP & social media — 5 tables + 15 kpi_daily columns deployed
- [x] 004: Action engine SQL helpers — 4 functions deployed (v2, schema-corrected)
- [x] 005: KPI cron functions — 3 functions deployed (clean slate rewrite, verified working)
- [x] 006: Classes + drives — 3 new tables + column additions deployed
- [x] Schema diagnostics — complete audit of all table structures vs code assumptions
- [x] KPI rollup verified end-to-end across all 3 locations (zero errors)
- [x] Network benchmarks calculating correctly

**Seed Data (30 days, 3 locations)**
- [x] 3 locations created (Omaha, Lincoln, Bellevue)
- [x] 10 instructors (4 Omaha, 3 Lincoln, 3 Bellevue — 1 inactive)
- [x] 7 vehicles (3 Omaha, 2 Lincoln, 2 Bellevue — 1 in maintenance)
- [x] 29 students across all stages (active, completed, withdrawn)
- [x] 25 leads with realistic source distribution + 22 activity logs
- [x] 55+ call tracking records (Bellevue 89% answer rate, Lincoln 47% — problem location)
- [x] 180 ad spend records (Google + Meta, 30 days, all locations)
- [x] 24 GBP reviews (Bellevue 4.8★ best, Lincoln 3.8★ worst)
- [x] 90 GBP daily metrics records
- [x] 33 compliance items (1 expired — Kevin Brown, Lincoln)
- [x] 12 classes with 30 class enrollments
- [x] 150+ drive appointments across all students
- [x] Student classroom hours + drive counts verified correct

**Action Engine**
- [x] 18 business rules designed and coded (rules.ts)
- [x] Engine orchestrator coded (engine.ts)
- [x] API route coded (api-route.ts)
- [x] All Supabase queries verified against live schema
- [x] Deployment package created (action-engine-deploy.zip)
- [x] DEPLOY.md written with step-by-step instructions

**Frontend**
- [x] Corporate Dashboard page designed (mock data)
- [x] Franchise Ranker page designed (mock data)
- [x] Location Detail page designed (mock data)
- [x] Marketing Dashboard page designed (mock data)
- [x] Interactive preview artifacts created for all pages

**Integrations**
- [x] Make.com setup guide written (MAKE_COM_SETUP_GUIDE.md)
- [x] Google Ads pipeline architecture designed
- [x] Meta Ads pipeline architecture designed
- [x] CTM pipeline architecture designed
- [x] GBP pipeline architecture designed
- [x] Social media pipeline architecture designed

**Documentation**
- [x] 002_SCHEMA_GUIDE.md — plain English table reference
- [x] ACTION_ENGINE_README.md — rule documentation
- [x] MAKE_COM_SETUP_GUIDE.md — step-by-step Make.com instructions
- [x] DEPLOY.md — action engine deployment instructions
- [x] PROJECT_BRIEF.md — this document

### ⚠️ NEEDS FIX

- [ ] **Action engine TypeScript `gbp_reviews` reference:** `engine.ts` references `published_at` on gbp_reviews but actual column is `review_date`. Update before deploying.
- [ ] **Backfill KPI daily for 30 days:** Only 2026-02-07 has data. Need to run rollup for Jan 8 – Feb 6 so dashboards have trend data.

### 🔜 TODO — NEXT STEPS

**Immediate (do these first):**
- [ ] Backfill kpi_daily for 30 days (run rollup for Jan 8 – Feb 6)
- [ ] Integrate action engine TypeScript files into Next.js codebase → **CLAUDE CODE**
- [ ] Wire frontend dashboard pages to real Supabase data → **CLAUDE CODE**
- [ ] Set up at least 1 Make.com pipeline end-to-end (Google Ads for one location)
- [ ] Fix `engine.ts` gbp_reviews column reference (`published_at` → `review_date`)

**Near-term:**
- [ ] Build Action Items UI page (the franchisee "here's what to do" view)
- [ ] Build Compliance detail page
- [ ] Build Student/Class/Drive management pages (leveraging new 006 tables)
- [ ] Implement auth/login flow with RLS
- [ ] Set up Vercel Cron jobs
- [ ] Connect remaining Make.com pipelines (Meta, CTM, GBP, social)
- [ ] Update `calculate_kpi_snapshot` to include classroom/drive metrics from 006 tables

**Medium-term:**
- [ ] Driveato JSON ingestion (waiting on their data format)
- [ ] GHL pipeline data bridge
- [ ] Email/Slack notifications for critical action items
- [ ] Franchisee onboarding flow (new location setup wizard)

**Long-term:**
- [ ] Forecasting and seasonality modeling
- [ ] Merge with lead management platform into single unified tool
- [ ] Analytical layer (BigQuery or read replica)
- [ ] Mobile-optimized franchisee view
- [ ] AI-powered rule suggestions (auto-detect new patterns)

---

## 13. KNOWN SCHEMA GOTCHAS

These bit us during development. Any code touching these tables MUST follow these rules:

| Table | Gotcha | Correct approach |
|-------|--------|-----------------|
| `leads` | **No `status` column.** Uses `is_archived` (boolean) + `converted_at` (timestamp) + `stage_id` (UUID) instead. | Use `WHERE is_archived = FALSE AND converted_at IS NULL` for active/open leads |
| `leads` | **`source` is a Postgres enum type** (`lead_source`), not a text column. Values: `meta_ads, google_ads, web_form, manual_entry, import, referral, phone_call, walk_in, other` | Cast with `l.source::TEXT` in any SQL that needs string operations |
| `leads` | **Has `location_id` but NO `organization_id`** | Join through locations table if you need org_id |
| `call_tracking_records` | **Uses `call_type` for answered/missed** AND also has a `status` column. **Uses `call_start` (timestamp) not `call_date`** | Filter with `call_type = 'answered'` or `call_type = 'missed'`. Date filter: `call_start::DATE = target_date` |
| `students` | **Uses `enrolled_at` (timestamp) not `enrollment_date`** | Filter: `enrolled_at::DATE` |
| `students` | **`total_lessons_purchased` / `lessons_completed` / `lessons_remaining` = BTW drives**, not classroom hours | Classroom tracked separately: `classroom_hours_required/completed/remaining` |
| `gbp_reviews` | **Uses `review_date` not `published_at`**. **Uses `has_reply` (boolean)** not checking `reply_text IS NULL` | Filter unreplied: `WHERE has_reply = FALSE` |
| `kpi_daily` | **Has `organization_id` (required, not nullable).** Column names: `total_calls_inbound` (not calls_inbound), `total_ad_spend` (not ad_spend_total) | Always include organization_id on insert |
| `network_benchmarks` | **Uses named columns** (avg_new_leads_per_location, p75_new_leads, etc.) **not generic metric_name/value pattern** | Each metric is its own column, not rows |
| `gbp_metrics_daily` | **GBP rating lives here**, not in a separate gbp_locations table | Query `overall_rating` from `gbp_metrics_daily` |
| `compliance_items` | **`status` is auto-computed by trigger** based on `expiry_date`. **`days_until_expiry` is auto-computed** | Don't manually set — trigger handles it |
| `drive_appointments` | **Always 1 hour duration** — no duration column | Duration is implicit |
| Postgres general | **`ROUND()` with 2 args requires `::NUMERIC` cast** | `ROUND(value::NUMERIC, 2)` not `ROUND(value, 2)` |
| Functions | **`CREATE OR REPLACE FUNCTION` fails if return type changes** | Must `DROP FUNCTION` first, then `CREATE` |
| Upserts | **`ON CONFLICT` requires matching unique constraint** | Use `DELETE + INSERT` pattern if uncertain about constraints |

---

## 14. PHASE ROADMAP

### Phase 1: Foundation (Days 1-30) — ✅ COMPLETE
- ✅ Supabase schema design (6 migrations deployed)
- ✅ Dashboard extension tables (002)
- ✅ GBP & social media tables (003)
- ✅ Action engine SQL helpers (004)
- ✅ KPI cron pipeline — working end-to-end (005)
- ✅ Classes & drives tables (006)
- ✅ Seed data for all 3 locations (30 days)
- ✅ KPI rollup verified across all locations
- ⚠️ Integration pipeline setup (guides written, waiting on credentials)
- 🔜 Corporate dashboard with real data
- 🔜 Backfill KPI daily for 30 days

### Phase 2: Franchisee-Facing (Days 30-60)
- Franchisee dashboard with RLS
- All Make.com pipelines live
- Benchmarking and leaderboard with real data
- Driveato data integration
- Action items UI for franchisees
- Auth and permissions

### Phase 3: Intelligence Layer (Days 60-90)
- Action engine live in production with daily cron
- Email/Slack notifications for critical items
- Compliance monitoring automated
- Historical trend analysis
- Franchisee onboarding flow for new locations

### Phase 4: Scale & Optimize (Ongoing)
- Forecasting and seasonality
- AI-powered recommendations
- Merge with lead management platform
- Mobile optimization
- Analytical data layer
- Custom reporting builder

---

## 15. COST PROJECTIONS

**Current (3 locations):**

| Tool | Plan | Monthly |
|------|------|---------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Make.com | Core (10k ops) | $9 |
| **Total** | | **$54/mo** |

**At scale (50+ locations):**

| Tool | Plan | Monthly |
|------|------|---------|
| Supabase | Pro (may need Team) | $25-$599 |
| Vercel | Pro | $20 |
| Make.com | Teams (300k+ ops) | $29-$99 |
| Monitoring (Sentry etc.) | Basic | $26 |
| **Total** | | **$100-$744/mo** |

The big variable is Supabase — if query volume or storage grows significantly with 50 locations worth of daily data, may need Team plan. Monitor during Phase 2.

---

## 16. WORKFLOW INSTRUCTIONS FOR CLAUDE CODE

When starting a Claude Code session, use this opening prompt:

```
Read docs/PROJECT_BRIEF.md before doing anything. It contains the complete context for this project — schema, rules, file inventory, what's deployed, what's broken, and what's next. After reading, tell me what you think the highest-priority task is based on the status checklist, and I'll confirm or redirect.
```

**Rules for Claude Code:**
1. **Always read PROJECT_BRIEF.md first** — it's the source of truth
2. **Never assume schema columns** — check the gotchas section. The `leads` table is especially tricky.
3. **Update this document** when you complete work — mark checkboxes, add new files to inventory, update status
4. **Keep migrations numbered** — next one is 007
5. **Test against real schema** — if you're writing SQL, validate column names exist
6. **Graceful degradation** — if an RPC or table might not exist yet, handle the error and continue
7. **One thing at a time** — don't try to build everything in one session. Do one task, verify it works, update the brief.

---

*This document is the bridge between planning (Claude Chat) and implementation (Claude Code). Keep it current.*
