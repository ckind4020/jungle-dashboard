/* eslint-disable @typescript-eslint/no-explicit-any */
import { Rule } from './types'

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
  // Use 7-day sum from history
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
    title: `Top performer on ${topMetrics.length} metrics!`,
    description: `Great work! ${ctx.location_name} is leading the network in: ${topMetrics.join(', ')}. Keep doing what you're doing.`,
    recommended_action: 'Share your best practices with other locations. Document what\'s working so it can be replicated.',
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
