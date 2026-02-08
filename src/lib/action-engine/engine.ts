/* eslint-disable @typescript-eslint/no-explicit-any */
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
    .maybeSingle()

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
        call_summary: null,
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
          errors.push(`Rule failed for ${location.name}: ${e.message}`)
        }
      }

      // --- Upsert results into action_items ---
      const firedRuleIds = results.map(r => r.rule_id)

      // Mark open items as resolved if rule no longer fires
      if (firedRuleIds.length > 0) {
        await supabase
          .from('action_items')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('location_id', location.id)
          .eq('status', 'open')
          .not('rule_id', 'in', `(${firedRuleIds.map(id => `"${id}"`).join(',')})`)
      } else {
        // No rules fired — resolve all open items for this location
        await supabase
          .from('action_items')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('location_id', location.id)
          .eq('status', 'open')
      }

      // Upsert fired rules
      for (const item of results) {
        const { data: existing } = await supabase
          .from('action_items')
          .select('id, status, priority')
          .eq('location_id', location.id)
          .eq('rule_id', item.rule_id)
          .in('status', ['open', 'in_progress'])
          .limit(1)
          .maybeSingle()

        if (existing) {
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
