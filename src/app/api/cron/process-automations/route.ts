import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  // Protect with cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  let processed = 0
  let errors = 0

  // Find enrollments ready to execute
  const { data: enrollments } = await supabase
    .from('automation_enrollments')
    .select(`
      *,
      automations ( id, name, location_id, is_active,
        locations ( id, name, phone )
      ),
      leads ( id, first_name, last_name, email, phone )
    `)
    .eq('status', 'active')
    .lte('next_execution_at', now)
    .limit(50)

  if (!enrollments?.length) {
    return NextResponse.json({ processed: 0, message: 'No enrollments to process' })
  }

  for (const enrollment of enrollments) {
    try {
      // Skip if automation is paused
      if (!enrollment.automations?.is_active) continue

      // Get current step
      const { data: step } = await supabase
        .from('automation_steps')
        .select('*')
        .eq('automation_id', enrollment.automation_id)
        .eq('position', enrollment.current_step_order)
        .single()

      if (!step) {
        // No more steps — mark as completed
        await supabase
          .from('automation_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id)
        processed++
        continue
      }

      // Execute step (MOCK MODE)
      const lead = enrollment.leads
      const location = enrollment.automations?.locations
      const result = executeMockStep(step, lead, location)

      // Log to automation_logs
      await supabase.from('automation_logs').insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        status: 'success',
        result,
      })

      // Log to activity_logs (lead's timeline)
      await supabase.from('activity_logs').insert({
        lead_id: enrollment.lead_id,
        activity_type: getActivityType(step.step_type),
        notes: `[MOCK] ${result.description}`,
        metadata: { automation_name: enrollment.automations?.name, step_position: step.position },
      })

      // If step is change_stage, actually change it
      if (step.step_type === 'change_stage' && step.step_config?.stage_id) {
        await supabase
          .from('leads')
          .update({ stage_id: step.step_config.stage_id })
          .eq('id', enrollment.lead_id)
      }

      // If step is update_lead, actually update
      if (step.step_type === 'update_lead' && step.step_config?.field) {
        const field = step.step_config.field
        const value = step.step_config.value
        if (['score', 'source', 'email', 'phone'].includes(field)) {
          await supabase
            .from('leads')
            .update({ [field]: value })
            .eq('id', enrollment.lead_id)
        }
      }

      // Advance to next step
      const nextPosition = enrollment.current_step_order + 1
      const { data: nextStep } = await supabase
        .from('automation_steps')
        .select('position, delay_seconds')
        .eq('automation_id', enrollment.automation_id)
        .eq('position', nextPosition)
        .single()

      if (nextStep) {
        const nextExecutionAt = new Date(Date.now() + (nextStep.delay_seconds || 0) * 1000).toISOString()
        await supabase
          .from('automation_enrollments')
          .update({
            current_step_order: nextPosition,
            next_execution_at: nextExecutionAt,
          })
          .eq('id', enrollment.id)
      } else {
        // No more steps — completed
        await supabase
          .from('automation_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id)
      }

      processed++
    } catch (err) {
      errors++
      console.error(`Error processing enrollment ${enrollment.id}:`, err)
    }
  }

  return NextResponse.json({ processed, errors, total: enrollments.length })
}

// Mock step execution — logs what would happen
function executeMockStep(step: any, lead: any, location: any) {
  const config = step.step_config || {}
  const replaceTags = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, lead?.first_name || '')
      .replace(/\{\{last_name\}\}/g, lead?.last_name || '')
      .replace(/\{\{full_name\}\}/g, `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim())
      .replace(/\{\{email\}\}/g, lead?.email || '')
      .replace(/\{\{phone\}\}/g, lead?.phone || '')
      .replace(/\{\{location_name\}\}/g, location?.name || '')
      .replace(/\{\{location_phone\}\}/g, location?.phone || '')
  }

  switch (step.step_type) {
    case 'send_sms':
      return {
        type: 'sms',
        description: `Would send SMS to ${lead?.phone}: "${replaceTags(config.message || '').substring(0, 50)}..."`,
        to: lead?.phone,
        message: replaceTags(config.message || ''),
      }
    case 'send_email':
      return {
        type: 'email',
        description: `Would send email to ${lead?.email}: "${replaceTags(config.subject || '')}"`,
        to: lead?.email,
        subject: replaceTags(config.subject || ''),
        body: replaceTags(config.body || ''),
      }
    case 'wait_delay':
      return {
        type: 'wait',
        description: `Waited ${config.delay_amount} ${config.delay_unit}`,
      }
    case 'change_stage':
      return {
        type: 'stage_change',
        description: `Changed stage to ${config.stage_name || config.stage_id}`,
      }
    case 'update_lead':
      return {
        type: 'update',
        description: `Updated ${config.field} to "${config.value}"`,
      }
    case 'notify_user':
      return {
        type: 'notification',
        description: `Would notify via ${config.channel}: "${replaceTags(config.message || '').substring(0, 50)}..."`,
      }
    case 'webhook':
      return {
        type: 'webhook',
        description: `Would ${config.method || 'POST'} to ${config.url}`,
      }
    default:
      return { type: step.step_type, description: `Executed ${step.step_type}` }
  }
}

function getActivityType(stepType: string): string {
  switch (stepType) {
    case 'send_sms': return 'sms_sent'
    case 'send_email': return 'email_sent'
    case 'change_stage': return 'stage_change'
    case 'update_lead': return 'lead_updated'
    default: return 'automation_step'
  }
}
