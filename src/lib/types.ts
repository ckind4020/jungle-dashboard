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
  slug?: string
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
  drive_backlog: number
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
  location_id?: string
  location_name: string
  new_leads: number
  active_students: number
  revenue_collected: number
  compliance_score: number
  total_ad_spend?: number
  cost_per_lead?: number
  gbp_overall_rating?: number
  missed_call_rate?: number
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
  rev_per_student: number
  instructor_utilization: number
  drive_backlog: number
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
  classes: ClassSummary[]
  drive_backlog: DriveBacklogStudent[]
  scheduled_drives: ScheduledDrive[]
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
  location_id?: string
  location_name?: string
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

// === Classes ===
export interface ClassSummary {
  id: string
  name: string
  class_type: string
  capacity: number
  enrolled_count: number
  status: string
  start_date: string
  end_date: string
  fill_rate: number // calculated client-side: enrolled_count / capacity * 100
}

// === Drive Backlog ===
export interface DriveBacklogStudent {
  id: string
  first_name: string
  last_name: string
  total_lessons_purchased: number
  lessons_completed: number
  lessons_remaining: number
  classroom_hours_remaining: number
  scheduled_count?: number // enriched client-side: how many future drives already scheduled
}

export interface ScheduledDrive {
  id: string
  student_id: string
  instructor_id: string
  scheduled_date: string
  scheduled_time: string
}

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
  state_min_classroom_hours: number | null
  state_min_drive_hours: number | null
  state_min_drive_count: number | null
}

export interface IntegrationSync {
  id: string
  organization_id: string
  location_id: string
  source: string
  sync_type: string
  status: 'success' | 'error' | 'running' | 'pending' | 'never'
  started_at: string | null
  completed_at: string | null
  records_synced: number
  error_message: string | null
}

export type IntegrationType = 'google_ads' | 'meta_ads' | 'call_tracking' | 'gbp' | 'driveato' | 'ghl'

export interface IntegrationConfig {
  type: IntegrationType
  label: string
  description: string
  icon: string
  color: string
  accountIdField: keyof LocationProfile
}

export interface HubData {
  location: LocationProfile
  integrations: IntegrationSync[]
  action_items_count: { critical: number; high: number; medium: number; low: number; total: number }
  today_kpi: KpiDaily | null
  quick_stats: {
    active_students: number
    outstanding_drives: number
    upcoming_classes: number
    open_leads: number
    unreplied_reviews: number
    compliance_score: number
  }
}

// === Leads ===

export interface LeadStage {
  id: string
  name: string
  color: string
  position: number
}

export interface Lead {
  id: string
  location_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  phone_normalized: string | null
  source: string
  stage_id: string | null
  score: number
  is_archived: boolean
  converted_at: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
  updated_at: string
  lead_stages?: LeadStage
  locations?: { id: string; name: string }
}

export interface ActivityLog {
  id: string
  lead_id: string
  activity_type: string
  channel: string | null
  direction: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface LeadListResponse {
  leads: Lead[]
  stages: LeadStage[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface LeadDetailResponse {
  lead: Lead
  activities: ActivityLog[]
  stages: LeadStage[]
}

// === Automations ===

export interface Automation {
  id: string
  location_id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  filter_conditions: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
  step_count: number
  enrolled_count: number
  completed_count: number
  total_enrolled: number
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
  location_id?: string
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
