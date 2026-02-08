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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data_context: Record<string, any>
  generated_by: GeneratedBy
}

export interface RuleContext {
  location_id: string
  location_name: string
  organization_id: string

  // KPI snapshots (most recent + 30 days)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  today_kpi: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi_history: any[]  // 30 days of kpi_daily rows

  // Raw data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uncontacted_leads: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recent_leads: any[]      // leads created in last 7 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call_summary: any | null // from get_missed_call_summary RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compliance_items: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ad_spend_recent: any[]   // last 7 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ad_spend_baseline: any[] // last 30 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unreplied_reviews: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recent_drives: any[]     // drive_appointments last 7 days

  // Benchmarks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network_benchmarks: any | null

  // Students
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active_students: any[]
}

export type Rule = (ctx: RuleContext) => ActionItemOutput | null
