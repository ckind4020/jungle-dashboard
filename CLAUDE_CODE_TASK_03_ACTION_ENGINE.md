# CLAUDE CODE TASK — Action Engine + Action Items Page

> Read this entire document before making changes.
> This integrates the 18-rule action engine into the Next.js project and builds the Action Items page.

---

## OVERVIEW

The Action Engine evaluates 18 business rules against each location's data and writes recommendations to the `action_items` table. The Action Items page displays these to franchisees as "here's what to do today."

**Flow:**
1. Cron or manual trigger → calls `/api/engine/evaluate`
2. Engine fetches data for each location
3. Runs all 18 rules → each returns null (no issue) or an action item
4. Upserts results into `action_items` table (keyed by location_id + rule_id)
5. Action Items page reads from `action_items` and displays them

---

## SCHEMA REFERENCE

### `action_items` table (already exists in Supabase)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Auto-generated |
| organization_id | UUID | Required |
| location_id | UUID | Required |
| rule_id | TEXT | e.g. 'LEAD_001', 'COMP_001' |
| category | TEXT | lead_followup, marketing, compliance, operations, financial, performance, reputation |
| priority | TEXT | critical, high, medium, low |
| status | TEXT | open, in_progress, resolved, expired, dismissed |
| title | TEXT | Short headline |
| description | TEXT | Detailed explanation |
| recommended_action | TEXT | What to do about it |
| data_context | JSONB | Supporting data (counts, percentages, names, etc.) |
| generated_by | TEXT | system_rule, benchmark_comparison, compliance_check, trend_alert |
| expires_at | TIMESTAMPTZ | When this becomes stale (default: 7 days from creation) |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

**CRITICAL SCHEMA GOTCHAS (from PROJECT_BRIEF Section 13):**
- `leads`: NO `status` column. Use `is_archived = FALSE AND converted_at IS NULL` for open leads
- `leads.source`: Postgres enum — cast with `::TEXT`
- `call_tracking_records`: uses `call_start` (timestamp), `call_type` for answered/missed
- `students`: uses `enrolled_at` not `enrollment_date`
- `gbp_reviews`: uses `review_date` not `published_at`, `has_reply` (boolean) not reply_text IS NULL
- `kpi_daily`: uses `total_calls_inbound`, `total_ad_spend`, has `organization_id` (required)
- `network_benchmarks`: uses named columns (avg_new_leads_per_location, p75_new_leads, etc.)

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## FILE STRUCTURE

Create these files:

```
src/
├── lib/
│   └── action-engine/
│       ├── types.ts          # Type definitions for engine
│       ├── rules.ts          # All 18 rule functions
│       └── engine.ts         # Orchestrator: fetch data → run rules → write results
├── app/
│   ├── api/
│   │   ├── engine/
│   │   │   └── evaluate/
│   │   │       └── route.ts  # POST: trigger engine run
│   │   └── actions/
│   │       └── route.ts      # GET: fetch action items for display
│   └── actions/
│       └── page.tsx          # Action Items page UI
```

---

## PART 1: `src/lib/action-engine/types.ts`

```typescript
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type Category = 'lead_followup' | 'scheduling' | 'marketing' | 'compliance' | 'operations' | 'financial' | 'performance' | 'reputation'
export type GeneratedBy = 'system_rule' | 'benchmark_comparison' | 'compliance_check' | 'trend_alert'
export type ActionStatus = 'open' | 'in_progress' | 'resolved' | 'expired' | 'dismissed'

export interface ActionItemOutput {
  rule_id: string
  category: Category
  priority: Priority
  title: string
  description: string
  recommended_action: string
  data_context: Record<string, any>
  generated_by: GeneratedBy
}

export interface RuleContext {
  location_id: string
  location_name: string
  organization_id: string

  // KPI snapshots (most recent + 30 days)
  today_kpi: any | null
  kpi_history: any[]  // 30 days of kpi_daily rows

  // Raw data
  uncontacted_leads: any[]
  recent_leads: any[]      // leads created in last 7 days
  call_summary: any | null // from get_missed_call_summary RPC
  compliance_items: any[]
  ad_spend_recent: any[]   // last 7 days
  ad_spend_baseline: any[] // last 30 days
  unreplied_reviews: any[]
  recent_drives: any[]     // drive_appointments last 7 days

  // Benchmarks
  network_benchmarks: any | null

  // Students
  active_students: any[]
}

export type Rule = (ctx: RuleContext) => ActionItemOutput | null
```

---

## PART 2: `src/lib/action-engine/rules.ts`

```typescript
import { Rule, ActionItemOutput, RuleContext } from './types'

// ============================================================
// LEAD FOLLOW-UP RULES
// ============================================================

const LEAD_001: Rule = (ctx) => {
  const leads = ctx.uncontacted_leads || []
  if (leads.length === 0) return null

  const oldLeads = leads.filter((l: any) => {
    const hoursAgo = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60)
    return hoursAgo > 24
  })

  let priority: 'critical' | 'high' | 'medium' = 'medium'
  if (leads.length >= 10) priority = 'critical'
  else if (leads.length >= 5 || oldLeads.length > 0) priority = 'high'

  return {
    rule_id: 'LEAD_001',
    category: 'lead_followup',
    priority,
    title: `${leads.length} uncontacted lead${leads.length > 1 ? 's' : ''}`,
    description: `${leads.length} lead${leads.length > 1 ? 's have' : ' has'} not been contacted yet. ${oldLeads.length > 0 ? `${oldLeads.length} are over 24 hours old.` : 'Contact them within 2 hours of inquiry for best conversion.'}`,
    recommended_action: `Open your lead queue and contact these leads immediately: ${leads.slice(0, 5).map((l: any) => `${l.first_name} ${l.last_name}`).join(', ')}${leads.length > 5 ? ` and ${leads.length - 5} more` : ''}.`,
    data_context: { count: leads.length, over_24h: oldLeads.length, lead_names: leads.slice(0, 10).map((l: any) => ({ name: `${l.first_name} ${l.last_name}`, source: l.source, created: l.created_at })) },
    generated_by: 'system_rule',
  }
}

const LEAD_002: Rule = (ctx) => {
  const contactRate = Number(ctx.today_kpi?.contact_rate || 0)
  if (contactRate >= 70 || !ctx.today_kpi) return null

  let priority: 'critical' | 'high' = 'high'
  if (contactRate < 50) priority = 'critical'

  return {
    rule_id: 'LEAD_002',
    category: 'lead_followup',
    priority,
    title: `Contact rate at ${contactRate.toFixed(1)}%`,
    description: `Your 7-day contact rate is ${contactRate.toFixed(1)}%, below the 70% target. This means leads are going cold before your team reaches them.`,
    recommended_action: 'Review your lead response process. Set up auto-text replies for new inquiries. Ensure someone is assigned to check leads every 2 hours during business hours.',
    data_context: { contact_rate: contactRate, target: 70 },
    generated_by: 'system_rule',
  }
}

const LEAD_003: Rule = (ctx) => {
  const history = ctx.kpi_history || []
  if (history.length < 14) return null

  const last7 = history.slice(-7)
  const prev7 = history.slice(-14, -7)
  const thisWeekEnrolled = last7.reduce((s: number, k: any) => s + (k.leads_enrolled || 0), 0)
  const thisWeekLeads = last7.reduce((s: number, k: any) => s + (k.new_leads || 0), 0)
  const prevWeekEnrolled = prev7.reduce((s: number, k: any) => s + (k.leads_enrolled || 0), 0)
  const prevWeekLeads = prev7.reduce((s: number, k: any) => s + (k.new_leads || 0), 0)

  const thisRate = thisWeekLeads > 0 ? (thisWeekEnrolled / thisWeekLeads) * 100 : 0
  const prevRate = prevWeekLeads > 0 ? (prevWeekEnrolled / prevWeekLeads) * 100 : 0
  const drop = prevRate - thisRate

  if (drop < 10) return null

  return {
    rule_id: 'LEAD_003',
    category: 'lead_followup',
    priority: drop >= 20 ? 'high' : 'medium',
    title: `Enrollment rate dropped ${drop.toFixed(0)} points`,
    description: `Enrollment rate fell from ${prevRate.toFixed(1)}% to ${thisRate.toFixed(1)}% week-over-week. Fewer leads are converting to students.`,
    recommended_action: 'Check if lead quality changed (new ad campaign?), if pricing is competitive, and if your follow-up process has slipped.',
    data_context: { this_week_rate: thisRate, prev_week_rate: prevRate, drop_points: drop },
    generated_by: 'trend_alert',
  }
}

// ============================================================
// MARKETING RULES
// ============================================================

const MKT_001: Rule = (ctx) => {
  const recent = ctx.ad_spend_recent || []
  const baseline = ctx.ad_spend_baseline || []
  if (recent.length === 0 || baseline.length === 0) return null

  const recentCPL = recent.reduce((s: number, a: any) => s + Number(a.cpa || 0), 0) / recent.length
  const baselineCPL = baseline.reduce((s: number, a: any) => s + Number(a.cpa || 0), 0) / baseline.length
  if (baselineCPL === 0) return null

  const increase = ((recentCPL - baselineCPL) / baselineCPL) * 100
  if (increase < 30) return null

  return {
    rule_id: 'MKT_001',
    category: 'marketing',
    priority: increase >= 50 ? 'high' : 'medium',
    title: `CPL spiked ${increase.toFixed(0)}% above baseline`,
    description: `7-day average cost per lead ($${recentCPL.toFixed(2)}) is ${increase.toFixed(0)}% above your 30-day baseline ($${baselineCPL.toFixed(2)}).`,
    recommended_action: 'Check for keyword bid changes, audience drift, or landing page issues. Pause underperforming campaigns and reallocate budget.',
    data_context: { recent_cpl: recentCPL, baseline_cpl: baselineCPL, increase_pct: increase },
    generated_by: 'trend_alert',
  }
}

const MKT_002: Rule = (ctx) => {
  const recent = ctx.ad_spend_recent || []
  // Look for 3+ consecutive days with spend > 0 but conversions = 0
  const sorted = [...recent].sort((a: any, b: any) => a.date.localeCompare(b.date))
  let consecutive = 0
  let maxConsecutive = 0
  let totalSpentZeroConv = 0

  for (const day of sorted) {
    if (Number(day.spend) > 0 && Number(day.conversions) === 0) {
      consecutive++
      totalSpentZeroConv += Number(day.spend)
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }

  if (maxConsecutive < 3) return null

  return {
    rule_id: 'MKT_002',
    category: 'marketing',
    priority: totalSpentZeroConv > 300 ? 'critical' : 'high',
    title: `${maxConsecutive} days of ad spend with zero conversions`,
    description: `You've spent $${totalSpentZeroConv.toFixed(2)} over ${maxConsecutive} consecutive days without a single conversion. Money is being wasted.`,
    recommended_action: 'Pause all campaigns immediately. Review ad copy, landing pages, and conversion tracking setup before resuming.',
    data_context: { consecutive_days: maxConsecutive, total_wasted: totalSpentZeroConv },
    generated_by: 'system_rule',
  }
}

const MKT_003: Rule = (ctx) => {
  const benchmarks = ctx.network_benchmarks
  if (!benchmarks) return null

  const myCPL = Number(ctx.today_kpi?.cost_per_lead || 0)
  const networkAvgCPL = Number(benchmarks.avg_cost_per_lead || 0)
  if (networkAvgCPL === 0 || myCPL === 0) return null

  const abovePct = ((myCPL - networkAvgCPL) / networkAvgCPL) * 100
  if (abovePct < 25) return null

  return {
    rule_id: 'MKT_003',
    category: 'marketing',
    priority: myCPL >= networkAvgCPL * 2 ? 'high' : 'medium',
    title: `CPL ${abovePct.toFixed(0)}% above network average`,
    description: `Your cost per lead ($${myCPL.toFixed(2)}) is ${abovePct.toFixed(0)}% above the network average ($${networkAvgCPL.toFixed(2)}). Other locations are acquiring leads cheaper.`,
    recommended_action: 'Compare your campaign setup with top-performing locations. Check targeting, ad copy, and bidding strategy.',
    data_context: { my_cpl: myCPL, network_avg: networkAvgCPL, above_pct: abovePct },
    generated_by: 'benchmark_comparison',
  }
}

// ============================================================
// CALLS RULE
// ============================================================

const CALL_001: Rule = (ctx) => {
  const missedRate = Number(ctx.today_kpi?.missed_call_rate || 0)
  const totalInbound = Number(ctx.today_kpi?.total_calls_inbound || 0)
  const totalOutbound = Number(ctx.today_kpi?.total_calls_outbound || 0)
  const totalCalls = totalInbound + totalOutbound

  // Need minimum 10 calls in the period to avoid noise
  // Use 7-day sum from history if available
  const last7 = (ctx.kpi_history || []).slice(-7)
  const weekCalls = last7.reduce((s: number, k: any) => s + (k.total_calls_inbound || 0) + (k.total_calls_outbound || 0), 0)
  const weekMissed = last7.reduce((s: number, k: any) => s + (k.calls_missed || 0), 0)
  const weekMissedRate = weekCalls > 0 ? (weekMissed / weekCalls) * 100 : 0

  if (weekCalls < 10 || weekMissedRate < 25) return null

  return {
    rule_id: 'CALL_001',
    category: 'operations',
    priority: weekMissedRate >= 40 ? 'critical' : 'high',
    title: `${weekMissedRate.toFixed(0)}% missed call rate`,
    description: `${weekMissed} of ${weekCalls} calls went unanswered in the last 7 days (${weekMissedRate.toFixed(1)}%). Each missed call is a potential lost enrollment.`,
    recommended_action: 'Set up a call overflow service or auto-text for missed calls. Review staffing during peak call hours. Consider a virtual receptionist.',
    data_context: { missed_rate: weekMissedRate, missed_count: weekMissed, total_calls: weekCalls },
    generated_by: 'system_rule',
  }
}

// ============================================================
// COMPLIANCE RULES
// ============================================================

const COMP_001: Rule = (ctx) => {
  const expired = ctx.compliance_items.filter((i: any) => i.status === 'expired')
  if (expired.length === 0) return null

  return {
    rule_id: 'COMP_001',
    category: 'compliance',
    priority: 'critical',
    title: `${expired.length} expired compliance item${expired.length > 1 ? 's' : ''}`,
    description: `The following are past due: ${expired.map((i: any) => `${i.entity_name} — ${i.compliance_type}`).join('; ')}. Operating with expired credentials puts your location at risk.`,
    recommended_action: `Immediately address: ${expired.map((i: any) => `Renew ${i.compliance_type} for ${i.entity_name}`).join('. ')}.`,
    data_context: { items: expired.map((i: any) => ({ entity: i.entity_name, type: i.compliance_type, expired_date: i.expiry_date })) },
    generated_by: 'compliance_check',
  }
}

const COMP_002: Rule = (ctx) => {
  const expiring = ctx.compliance_items.filter((i: any) => i.status === 'expiring_soon' && i.days_until_expiry <= 14)
  if (expiring.length === 0) return null

  const within7 = expiring.filter((i: any) => i.days_until_expiry <= 7)

  return {
    rule_id: 'COMP_002',
    category: 'compliance',
    priority: within7.length > 0 ? 'high' : 'medium',
    title: `${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring within 14 days`,
    description: `${within7.length > 0 ? `${within7.length} expire within 7 days! ` : ''}Items: ${expiring.map((i: any) => `${i.entity_name} ${i.compliance_type} (${i.days_until_expiry}d)`).join(', ')}.`,
    recommended_action: 'Start renewal process now. Instructor certifications can take 2-3 weeks to process.',
    data_context: { items: expiring.map((i: any) => ({ entity: i.entity_name, type: i.compliance_type, days_left: i.days_until_expiry })), within_7_days: within7.length },
    generated_by: 'compliance_check',
  }
}

const COMP_003: Rule = (ctx) => {
  const score = Number(ctx.today_kpi?.compliance_score || 100)
  const networkAvg = Number(ctx.network_benchmarks?.avg_compliance_score || 100)

  if (score >= networkAvg || score >= 90) return null

  return {
    rule_id: 'COMP_003',
    category: 'compliance',
    priority: score < 75 ? 'high' : 'medium',
    title: `Compliance score ${score.toFixed(1)}% — below network average`,
    description: `Your compliance score (${score.toFixed(1)}%) is below the network average (${networkAvg.toFixed(1)}%). This indicates overdue renewals or missing documentation.`,
    recommended_action: 'Review all compliance items on the Compliance page and address any expired or expiring items.',
    data_context: { score, network_avg: networkAvg },
    generated_by: 'benchmark_comparison',
  }
}

// ============================================================
// REPUTATION RULES
// ============================================================

const REP_001: Rule = (ctx) => {
  const unreplied = ctx.unreplied_reviews || []
  if (unreplied.length === 0) return null

  const negative = unreplied.filter((r: any) => r.star_rating <= 2)
  const stale = unreplied.filter((r: any) => {
    const daysSince = (Date.now() - new Date(r.review_date).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 3
  })

  let priority: 'high' | 'medium' | 'low' = 'low'
  if (negative.length >= 2) priority = 'high'
  else if (negative.length === 1 || stale.length > 3) priority = 'medium'

  return {
    rule_id: 'REP_001',
    category: 'reputation',
    priority,
    title: `${unreplied.length} unreplied Google review${unreplied.length > 1 ? 's' : ''}`,
    description: `${negative.length > 0 ? `${negative.length} are negative reviews that need immediate attention. ` : ''}Responding to reviews improves your Google ranking and shows potential customers you care.`,
    recommended_action: `Reply to these reviews today: ${unreplied.slice(0, 5).map((r: any) => `${r.reviewer_name} (${r.star_rating}★)`).join(', ')}${unreplied.length > 5 ? ` and ${unreplied.length - 5} more` : ''}.`,
    data_context: { total_unreplied: unreplied.length, negative_count: negative.length, reviews: unreplied.slice(0, 10).map((r: any) => ({ reviewer: r.reviewer_name, rating: r.star_rating, date: r.review_date })) },
    generated_by: 'system_rule',
  }
}

const REP_002: Rule = (ctx) => {
  const rating = Number(ctx.today_kpi?.gbp_overall_rating || 5)
  if (rating >= 4.5) return null

  return {
    rule_id: 'REP_002',
    category: 'reputation',
    priority: rating < 4.0 ? 'high' : 'medium',
    title: `Google rating at ${rating.toFixed(1)}★`,
    description: `Your Google Business Profile rating is ${rating.toFixed(1)}★, below the 4.5★ target. This affects your search ranking and first impressions.`,
    recommended_action: 'Ask happy students to leave reviews. Follow up after successful road tests. Address negative review themes in your operations.',
    data_context: { rating, target: 4.5 },
    generated_by: 'system_rule',
  }
}

// ============================================================
// OPERATIONS RULES
// ============================================================

const OPS_001: Rule = (ctx) => {
  const drives = ctx.recent_drives || []
  const completed = drives.filter((d: any) => d.status === 'completed')
  const instructors = Number(ctx.today_kpi?.active_instructors || 1)
  // 6 slots per day × 5 weekdays × active instructors
  const maxCapacity = instructors * 6 * 5
  const utilization = maxCapacity > 0 ? (completed.length / maxCapacity) * 100 : 100

  if (utilization >= 60) return null

  return {
    rule_id: 'OPS_001',
    category: 'operations',
    priority: utilization < 40 ? 'high' : 'medium',
    title: `Instructor utilization at ${utilization.toFixed(0)}%`,
    description: `Only ${completed.length} of ${maxCapacity} available drive slots were used last week (${utilization.toFixed(0)}%). You're paying for instructor time that isn't being booked.`,
    recommended_action: 'Push students with outstanding drives to book appointments. Consider consolidating instructor schedules to reduce idle days.',
    data_context: { utilization, completed_drives: completed.length, max_capacity: maxCapacity, active_instructors: instructors },
    generated_by: 'system_rule',
  }
}

const OPS_002: Rule = (ctx) => {
  const drives = ctx.recent_drives || []
  const total = drives.filter((d: any) => ['completed', 'no_show'].includes(d.status))
  const noShows = drives.filter((d: any) => d.status === 'no_show')

  if (total.length < 20) return null
  const rate = (noShows.length / total.length) * 100
  if (rate < 10) return null

  return {
    rule_id: 'OPS_002',
    category: 'operations',
    priority: rate >= 20 ? 'high' : 'medium',
    title: `${rate.toFixed(0)}% no-show rate on drives`,
    description: `${noShows.length} of ${total.length} drive appointments were no-shows last week. Each no-show wastes an instructor hour and delays other students.`,
    recommended_action: 'Implement appointment reminders (text 24h + 1h before). Consider a no-show fee policy. Contact no-show students to reschedule.',
    data_context: { no_show_rate: rate, no_shows: noShows.length, total: total.length },
    generated_by: 'system_rule',
  }
}

const OPS_003: Rule = (ctx) => {
  const activeVehicles = Number(ctx.today_kpi?.active_vehicles || 0)
  const inMaintenance = Number(ctx.today_kpi?.vehicles_in_maintenance || 0)
  const total = activeVehicles + inMaintenance
  if (total === 0) return null

  const maintenancePct = (inMaintenance / total) * 100
  if (maintenancePct < 25) return null

  return {
    rule_id: 'OPS_003',
    category: 'operations',
    priority: activeVehicles <= 1 ? 'critical' : 'high',
    title: `${inMaintenance} of ${total} vehicles in maintenance`,
    description: `${maintenancePct.toFixed(0)}% of your fleet is unavailable. ${activeVehicles <= 1 ? 'You only have 1 vehicle available — this severely limits your capacity.' : 'This limits how many drives you can schedule.'}`,
    recommended_action: 'Expedite vehicle repairs. Consider renting a temporary vehicle if maintenance will take more than 2 days.',
    data_context: { active: activeVehicles, in_maintenance: inMaintenance, pct: maintenancePct },
    generated_by: 'system_rule',
  }
}

// ============================================================
// FINANCIAL RULES
// ============================================================

const FIN_001: Rule = (ctx) => {
  const history = ctx.kpi_history || []
  if (history.length < 14) return null

  const last7 = history.slice(-7)
  const prev7 = history.slice(-14, -7)
  const thisWeekOutstanding = last7[last7.length - 1]?.revenue_outstanding || 0
  const prevWeekOutstanding = prev7[prev7.length - 1]?.revenue_outstanding || 0

  if (prevWeekOutstanding === 0 || thisWeekOutstanding <= 1000) return null
  const growthPct = ((thisWeekOutstanding - prevWeekOutstanding) / prevWeekOutstanding) * 100
  if (growthPct < 15) return null

  return {
    rule_id: 'FIN_001',
    category: 'financial',
    priority: thisWeekOutstanding > 5000 ? 'high' : 'medium',
    title: `Outstanding revenue grew ${growthPct.toFixed(0)}% to $${thisWeekOutstanding.toFixed(0)}`,
    description: `Unpaid balances increased from $${prevWeekOutstanding.toFixed(0)} to $${thisWeekOutstanding.toFixed(0)} week-over-week. Cash flow risk is increasing.`,
    recommended_action: 'Send payment reminders to students with outstanding balances. Review your billing process and consider requiring payment before scheduling drives.',
    data_context: { current: thisWeekOutstanding, previous: prevWeekOutstanding, growth_pct: growthPct },
    generated_by: 'trend_alert',
  }
}

const FIN_002: Rule = (ctx) => {
  const history = ctx.kpi_history || []
  if (history.length < 14) return null

  const last7 = history.slice(-7)
  const prev7 = history.slice(-14, -7)
  const thisRevPerStudent = last7.reduce((s: number, k: any) => s + Number(k.revenue_collected || 0), 0) / Math.max(Number(last7[last7.length - 1]?.active_students || 1), 1)
  const prevRevPerStudent = prev7.reduce((s: number, k: any) => s + Number(k.revenue_collected || 0), 0) / Math.max(Number(prev7[prev7.length - 1]?.active_students || 1), 1)

  if (prevRevPerStudent === 0) return null
  const dropPct = ((prevRevPerStudent - thisRevPerStudent) / prevRevPerStudent) * 100
  if (dropPct < 15) return null

  return {
    rule_id: 'FIN_002',
    category: 'financial',
    priority: 'medium',
    title: `Revenue per student dropped ${dropPct.toFixed(0)}%`,
    description: `Weekly revenue per student fell from $${prevRevPerStudent.toFixed(0)} to $${thisRevPerStudent.toFixed(0)}. Students may be completing fewer paid activities.`,
    recommended_action: 'Check if students are pausing lessons, if new students are on lower-priced packages, or if payment collection has slowed.',
    data_context: { current_rev_per_student: thisRevPerStudent, prev_rev_per_student: prevRevPerStudent, drop_pct: dropPct },
    generated_by: 'trend_alert',
  }
}

// ============================================================
// PERFORMANCE RULES
// ============================================================

const PERF_001: Rule = (ctx) => {
  const b = ctx.network_benchmarks
  const k = ctx.today_kpi
  if (!b || !k) return null

  const bottomMetrics: string[] = []
  if (Number(k.contact_rate) < Number(b.avg_contact_rate) * 0.75) bottomMetrics.push('Contact Rate')
  if (Number(k.cost_per_lead) > Number(b.avg_cost_per_lead) * 1.25 && Number(b.avg_cost_per_lead) > 0) bottomMetrics.push('Cost Per Lead')
  if (Number(k.missed_call_rate) > Number(b.avg_missed_call_rate) * 1.25 && Number(b.avg_missed_call_rate) > 0) bottomMetrics.push('Missed Call Rate')
  if (Number(k.compliance_score) < Number(b.avg_compliance_score) * 0.9) bottomMetrics.push('Compliance')
  if (Number(k.gbp_overall_rating) < Number(b.avg_review_score) * 0.9 && Number(b.avg_review_score) > 0) bottomMetrics.push('GBP Rating')

  if (bottomMetrics.length < 2) return null

  return {
    rule_id: 'PERF_001',
    category: 'performance',
    priority: bottomMetrics.length >= 3 ? 'high' : 'medium',
    title: `Underperforming on ${bottomMetrics.length} metrics`,
    description: `${ctx.location_name} is in the bottom quartile for: ${bottomMetrics.join(', ')}. This location needs focused attention.`,
    recommended_action: `Schedule a review meeting for ${ctx.location_name}. Prioritize the worst metric first and create an improvement plan.`,
    data_context: { bottom_metrics: bottomMetrics, count: bottomMetrics.length },
    generated_by: 'benchmark_comparison',
  }
}

const WIN_001: Rule = (ctx) => {
  const b = ctx.network_benchmarks
  const k = ctx.today_kpi
  if (!b || !k) return null

  const topMetrics: string[] = []
  if (Number(k.contact_rate) > Number(b.avg_contact_rate) * 1.15) topMetrics.push('Contact Rate')
  if (Number(k.cost_per_lead) < Number(b.avg_cost_per_lead) * 0.75 && Number(k.cost_per_lead) > 0) topMetrics.push('Cost Per Lead')
  if (Number(k.compliance_score) > Number(b.avg_compliance_score) * 1.05) topMetrics.push('Compliance')
  if (Number(k.gbp_overall_rating) > Number(b.avg_review_score) * 1.05 && Number(b.avg_review_score) > 0) topMetrics.push('GBP Rating')
  if (Number(k.missed_call_rate) < Number(b.avg_missed_call_rate) * 0.5) topMetrics.push('Call Answer Rate')

  if (topMetrics.length < 2) return null

  return {
    rule_id: 'WIN_001',
    category: 'performance',
    priority: 'low',
    title: `🏆 Top performer on ${topMetrics.length} metrics!`,
    description: `Great work! ${ctx.location_name} is leading the network in: ${topMetrics.join(', ')}. Keep doing what you're doing.`,
    recommended_action: 'Share your best practices with other locations. Document what's working so it can be replicated.',
    data_context: { top_metrics: topMetrics, count: topMetrics.length },
    generated_by: 'benchmark_comparison',
  }
}

// ============================================================
// EXPORT ALL RULES
// ============================================================

export const ALL_RULES: Rule[] = [
  LEAD_001, LEAD_002, LEAD_003,
  MKT_001, MKT_002, MKT_003,
  CALL_001,
  COMP_001, COMP_002, COMP_003,
  REP_001, REP_002,
  OPS_001, OPS_002, OPS_003,
  FIN_001, FIN_002,
  PERF_001, WIN_001,
]
```

---

## PART 3: `src/lib/action-engine/engine.ts`

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { ALL_RULES } from './rules'
import { RuleContext, ActionItemOutput } from './types'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function runActionEngine(): Promise<{
  locations_processed: number
  actions_generated: number
  errors: string[]
}> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let totalActions = 0

  // Get all active locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)

  if (!locations || locations.length === 0) {
    return { locations_processed: 0, actions_generated: 0, errors: ['No active locations found'] }
  }

  // Get network benchmarks
  const { data: benchmarks } = await supabase
    .from('network_benchmarks')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('period_end', { ascending: false })
    .limit(1)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  for (const location of locations) {
    try {
      // --- Fetch all context for this location ---

      // KPI history (30 days)
      const { data: kpiHistory } = await supabase
        .from('kpi_daily')
        .select('*')
        .eq('location_id', location.id)
        .gte('date', thirtyDaysAgoStr)
        .order('date')

      const todayKpi = kpiHistory?.find(k => k.date === today) || kpiHistory?.[kpiHistory.length - 1] || null

      // Uncontacted leads (via RPC)
      let uncontactedLeads: any[] = []
      try {
        const { data } = await supabase.rpc('get_uncontacted_leads', {
          p_location_id: location.id,
          p_since: sevenDaysAgoStr,
        })
        uncontactedLeads = data || []
      } catch { /* RPC may not exist */ }

      // Recent leads (7 days)
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, source, created_at, is_archived, converted_at')
        .eq('location_id', location.id)
        .eq('is_archived', false)
        .gte('created_at', sevenDaysAgoStr)

      // Compliance items
      const { data: complianceItems } = await supabase
        .from('compliance_items')
        .select('id, entity_type, entity_name, compliance_type, expiry_date, status, days_until_expiry')
        .eq('location_id', location.id)

      // Ad spend (7 day + 30 day)
      const { data: adSpendRecent } = await supabase
        .from('ad_spend_daily')
        .select('date, source, spend, impressions, clicks, conversions, cpa')
        .eq('location_id', location.id)
        .gte('date', sevenDaysAgoStr)

      const { data: adSpendBaseline } = await supabase
        .from('ad_spend_daily')
        .select('date, source, spend, impressions, clicks, conversions, cpa')
        .eq('location_id', location.id)
        .gte('date', thirtyDaysAgoStr)

      // Unreplied reviews
      const { data: unrepliedReviews } = await supabase
        .from('gbp_reviews')
        .select('id, reviewer_name, star_rating, review_text, review_date, has_reply, sentiment')
        .eq('location_id', location.id)
        .eq('has_reply', false)

      // Recent drives (7 days)
      const { data: recentDrives } = await supabase
        .from('drive_appointments')
        .select('id, student_id, instructor_id, scheduled_date, status')
        .eq('location_id', location.id)
        .gte('scheduled_date', sevenDaysAgoStr)

      // Active students
      const { data: activeStudents } = await supabase
        .from('students')
        .select('id, first_name, last_name, lessons_remaining, balance_due')
        .eq('location_id', location.id)
        .eq('status', 'active')

      // --- Build context ---
      const ctx: RuleContext = {
        location_id: location.id,
        location_name: location.name,
        organization_id: ORG_ID,
        today_kpi: todayKpi,
        kpi_history: kpiHistory || [],
        uncontacted_leads: uncontactedLeads,
        recent_leads: recentLeads || [],
        call_summary: null, // could add RPC call here
        compliance_items: complianceItems || [],
        ad_spend_recent: adSpendRecent || [],
        ad_spend_baseline: adSpendBaseline || [],
        unreplied_reviews: unrepliedReviews || [],
        recent_drives: recentDrives || [],
        network_benchmarks: benchmarks,
        active_students: activeStudents || [],
      }

      // --- Run all rules ---
      const results: ActionItemOutput[] = []
      for (const rule of ALL_RULES) {
        try {
          const result = rule(ctx)
          if (result) results.push(result)
        } catch (e: any) {
          errors.push(`Rule ${rule.name} failed for ${location.name}: ${e.message}`)
        }
      }

      // --- Upsert results into action_items ---
      // First, expire any old actions for rules that no longer fire
      const firedRuleIds = results.map(r => r.rule_id)
      
      // Mark open items as resolved if rule no longer fires
      await supabase
        .from('action_items')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('location_id', location.id)
        .eq('status', 'open')
        .not('rule_id', 'in', `(${firedRuleIds.map(id => `"${id}"`).join(',')})`)

      // Upsert fired rules
      for (const item of results) {
        // Check if action already exists
        const { data: existing } = await supabase
          .from('action_items')
          .select('id, status, priority')
          .eq('location_id', location.id)
          .eq('rule_id', item.rule_id)
          .in('status', ['open', 'in_progress'])
          .limit(1)
          .single()

        if (existing) {
          // Update existing (refresh data, maybe escalate priority)
          await supabase
            .from('action_items')
            .update({
              priority: item.priority,
              title: item.title,
              description: item.description,
              recommended_action: item.recommended_action,
              data_context: item.data_context,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          // Insert new
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 7)

          await supabase.from('action_items').insert({
            organization_id: ORG_ID,
            location_id: location.id,
            rule_id: item.rule_id,
            category: item.category,
            priority: item.priority,
            status: 'open',
            title: item.title,
            description: item.description,
            recommended_action: item.recommended_action,
            data_context: item.data_context,
            generated_by: item.generated_by,
            expires_at: expiresAt.toISOString(),
          })
        }
      }

      totalActions += results.length

    } catch (e: any) {
      errors.push(`Engine failed for ${location.name}: ${e.message}`)
    }
  }

  return {
    locations_processed: locations.length,
    actions_generated: totalActions,
    errors,
  }
}
```

---

## PART 4: API ROUTES

### `src/app/api/engine/evaluate/route.ts` — Trigger Engine

```typescript
import { NextResponse } from 'next/server'
import { runActionEngine } from '@/lib/action-engine/engine'

export async function POST(request: Request) {
  // Allow cron secret OR no auth for manual testing (tighten later)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, require auth. For now, allow open access for testing.
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runActionEngine()
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Allow GET for easy browser testing
export async function GET(request: Request) {
  return POST(request)
}
```

### `src/app/api/actions/route.ts` — Fetch Action Items

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')
  const status = searchParams.get('status') || 'open,in_progress'

  let query = supabase
    .from('action_items')
    .select('*')
    .eq('organization_id', ORG_ID)
    .in('status', status.split(','))
    .order('priority', { ascending: true }) // critical first
    .order('created_at', { ascending: false })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: items, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get location names
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('organization_id', ORG_ID)

  const enriched = (items || []).map(item => ({
    ...item,
    location_name: locations?.find(l => l.id === item.location_id)?.name || 'Unknown',
  }))

  // Build summary counts
  const summary = {
    total: enriched.length,
    critical: enriched.filter(i => i.priority === 'critical').length,
    high: enriched.filter(i => i.priority === 'high').length,
    medium: enriched.filter(i => i.priority === 'medium').length,
    low: enriched.filter(i => i.priority === 'low').length,
    by_category: Object.entries(
      enriched.reduce((acc: any, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc }, {})
    ).map(([category, count]) => ({ category, count })),
  }

  return NextResponse.json({ items: enriched, summary })
}
```

---

## PART 5: ACTION ITEMS PAGE UI

### `src/app/actions/page.tsx`

**Design:**

**Top section — Summary bar:**
- 4 small cards in a row showing counts: 🔴 Critical (X), 🟠 High (X), 🟡 Medium (X), 🟢 Low (X)
- Plus a "Run Engine Now" button (calls POST /api/engine/evaluate, shows loading spinner, refreshes data after)

**Filter bar:**
- Location filter dropdown (All Locations, Omaha, Lincoln, Bellevue)
- Category filter pills (All, Lead Follow-up, Marketing, Compliance, Operations, Financial, Performance, Reputation)
- Status toggle (Open, In Progress, Resolved, All)

**Main content — Action item cards:**
Each action item renders as a card:

```
┌─────────────────────────────────────────────────────┐
│ 🔴 CRITICAL    │ compliance    │ Lincoln    │ 2h ago │
│                                                       │
│ 1 expired compliance item                             │
│                                                       │
│ The following are past due: Kevin Brown — first_aid.   │
│ Operating with expired credentials puts your location  │
│ at risk.                                              │
│                                                       │
│ 💡 Immediately address: Renew first_aid for Kevin     │
│    Brown.                                             │
│                                                       │
│ [Mark In Progress]  [Dismiss]  [View Details ▼]       │
└─────────────────────────────────────────────────────┘
```

**Card styling by priority:**
- Critical: left border `border-l-4 border-red-500`, light red bg `bg-red-50`
- High: left border `border-l-4 border-orange-500`, light orange bg `bg-orange-50`
- Medium: left border `border-l-4 border-yellow-500`, light yellow bg `bg-yellow-50`
- Low: left border `border-l-4 border-emerald-500`, light emerald bg `bg-emerald-50`

**Card layout:**
- Top row: Priority badge + category badge + location name + relative time (e.g. "2h ago")
- Title: bold, large
- Description: normal text
- Recommended action: prefixed with 💡, slightly different bg
- "View Details" expands to show `data_context` as formatted key-value pairs
- Action buttons: "Mark In Progress" (PATCH status), "Dismiss" (PATCH status to dismissed)

**Buttons need API calls:**
Create a PATCH handler in `/api/actions/route.ts`:
```typescript
export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { id, status } = body

  const { error } = await supabase
    .from('action_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Sort order:** Critical first, then high, medium, low. Within same priority, newest first.

**Empty state:** When no actions exist, show a green card: "✅ All clear! No action items right now. Run the engine to check for new issues."

---

## PART 6: ADD ACTION ITEMS COUNT TO SIDEBAR

Update the Sidebar component to show a badge with the count of open action items:

```
⚡ Action Items  [3]
```

Where the badge is red if any critical items exist, orange if any high, yellow otherwise.

Fetch from `/api/actions` on sidebar mount (just the summary, not full items).

---

## PART 7: ADD ACTIONS TO LOCATION DETAIL

In the Location Detail page, add a small "Action Items" section (above or below the Operations Forecast) that shows action items filtered to that location. Just show the cards — no filters needed since it's already scoped.

Use the same card component from the Actions page.

---

## BUILD ORDER

1. Create `src/lib/action-engine/types.ts`
2. Create `src/lib/action-engine/rules.ts` (all 18 rules)
3. Create `src/lib/action-engine/engine.ts` (orchestrator)
4. Create `src/app/api/engine/evaluate/route.ts` (trigger endpoint)
5. Create `src/app/api/actions/route.ts` (GET + PATCH)
6. Build `src/app/actions/page.tsx` (Action Items page)
7. Update Sidebar to show action items count badge
8. Update Location Detail to show location-scoped action items
9. **Test:** Hit `http://localhost:3000/api/engine/evaluate` in your browser to trigger the engine
10. **Verify:** Check `http://localhost:3000/actions` to see generated items

## EXPECTED RESULTS WITH SEED DATA

Based on the seeded data, these rules should fire:

| Rule | Location | Why |
|------|----------|-----|
| LEAD_001 | Multiple | 8 uncontacted leads seeded |
| LEAD_002 | Lincoln, Omaha | Contact rates are 25% and 33% (below 70%) |
| COMP_001 | Lincoln | Kevin Brown has expired first aid cert |
| REP_001 | All | Unreplied reviews: Omaha 2, Lincoln 3, Bellevue 1 |
| REP_002 | Lincoln | GBP rating 3.8★ (below 4.5) |
| MKT_003 | Lincoln | Highest CPL ($54) vs network avg |
| WIN_001 | Bellevue | Top performer on multiple metrics |
