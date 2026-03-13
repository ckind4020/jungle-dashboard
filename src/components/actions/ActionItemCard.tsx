'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Clock, CheckCircle2, XCircle, Eye, ChevronDown, ChevronUp, AlarmClock, Lightbulb, UserPlus, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'
import OverdueBadge from './OverdueBadge'
import { formatDistanceToNow } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ActionItemData {
  id: string
  action_type: string
  priority: string
  status: string
  title: string
  description: string
  recommended_action: string
  ai_suggestion?: string | null
  overdue_days: number
  overdue_level: string
  created_at: string
  lead?: {
    id: string
    first_name: string
    last_name: string
    phone: string | null
    email: string | null
    source: string
    stage_name: string | null
    follow_up_date?: string | null
    last_contact_at?: string | null
    location_id?: string
  } | null
  location_name: string
  location_id: string
  category: string
  data_context: any
  rule_id?: string
}

interface ActionItemCardProps {
  item: ActionItemData
  onAction: (id: string, action: string) => void
}

const SOURCE_LABELS: Record<string, string> = {
  manual_entry: 'Manual',
  phone_call: 'Phone',
  walk_in: 'Walk-In',
  web_form: 'Web',
  google_ads: 'Google Ad',
  meta_ads: 'Meta Ad',
  referral: 'Referral',
  import: 'Import',
  other: 'Other',
}

const SOURCE_COLORS: Record<string, string> = {
  meta_ads: 'bg-purple-100 text-purple-700',
  google_ads: 'bg-blue-100 text-blue-700',
  referral: 'bg-green-100 text-green-700',
  web_form: 'bg-cyan-100 text-cyan-700',
  walk_in: 'bg-amber-100 text-amber-700',
  phone_call: 'bg-teal-100 text-teal-700',
}

function getCardStyle(item: ActionItemData) {
  // Overdue styling takes priority
  if (item.overdue_level === 'critical') {
    return { border: 'border-l-4 border-red-600', bg: 'bg-red-50' }
  }
  if (item.overdue_level === 'warning') {
    return { border: 'border-l-4 border-amber-500', bg: 'bg-amber-50' }
  }
  if (item.overdue_level === 'due_today') {
    return { border: 'border-l-4 border-blue-500', bg: 'bg-blue-50' }
  }

  // Regular priority colors
  const styles: Record<string, { border: string; bg: string }> = {
    critical: { border: 'border-l-4 border-red-500', bg: 'bg-red-50' },
    high: { border: 'border-l-4 border-orange-500', bg: 'bg-orange-50' },
    medium: { border: 'border-l-4 border-yellow-500', bg: 'bg-yellow-50' },
    low: { border: 'border-l-4 border-emerald-500', bg: 'bg-emerald-50' },
  }
  return styles[item.priority] || styles.medium
}

/** Collect all recording URLs from data_context */
function getRecordingUrls(dataContext: any): string[] {
  if (!dataContext) return []
  const urls: string[] = []

  // Direct recording_url
  if (dataContext.recording_url) {
    urls.push(dataContext.recording_url)
  }

  // Consolidated call_records
  if (Array.isArray(dataContext.call_records)) {
    for (const rec of dataContext.call_records) {
      if (rec.recording_url) {
        urls.push(rec.recording_url)
      }
    }
  }

  return urls
}

export default function ActionItemCard({ item, onAction }: ActionItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const [creatingLead, setCreatingLead] = useState(false)
  const [createLeadError, setCreateLeadError] = useState<string | null>(null)
  const router = useRouter()
  const style = getCardStyle(item)

  const handleAction = async (action: string) => {
    setActing(true)
    await onAction(item.id, action)
    setActing(false)
  }

  const handleCreateLead = async () => {
    const ctx = item.data_context
    if (!ctx) return

    const callerName = ctx.ctm_caller_name || ''
    const spaceIdx = callerName.indexOf(' ')
    const firstName = spaceIdx > 0 ? callerName.slice(0, spaceIdx) : callerName
    const lastName = spaceIdx > 0 ? callerName.slice(spaceIdx + 1) : ''

    const notes = ctx.call_summary || item.description

    setCreatingLead(true)
    setCreateLeadError(null)

    try {
      // 1. Create lead
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: item.location_id,
          first_name: firstName || 'Unknown',
          last_name: lastName || 'Caller',
          phone: ctx.caller_number || null,
          email: ctx.ctm_email || null,
          source: 'phone_call',
          notes,
        }),
      })

      if (leadRes.status === 409) {
        const dupData = await leadRes.json()
        const dup = dupData.duplicates?.[0]
        if (dup) {
          // Duplicate found — resolve action item linking to existing lead, then navigate
          await fetch('/api/actions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, action: 'resolve_with_lead', lead_id: dup.id }),
          })
          router.push(`/leads/${item.location_id}/${dup.id}`)
          return
        }
      }

      if (!leadRes.ok) {
        const errData = await leadRes.json()
        throw new Error(errData.error || 'Failed to create lead')
      }

      const lead = await leadRes.json()

      // 2. Resolve the action item with the new lead_id
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'resolve_with_lead', lead_id: lead.id }),
      })

      // 3. Navigate to the new lead
      router.push(`/leads/${item.location_id}/${lead.id}`)
    } catch (err: any) {
      setCreateLeadError(err.message || 'Failed to create lead')
    } finally {
      setCreatingLead(false)
    }
  }

  const recordingUrls = getRecordingUrls(item.data_context)
  const showCreateLead = item.action_type === 'create_lead' &&
    item.data_context &&
    (item.data_context.ctm_caller_name || item.data_context.caller_number)

  return (
    <div className={cn('rounded-lg shadow-sm border border-gray-200 overflow-hidden', style.border, style.bg)}>
      <div className="p-5">
        {/* Top Row: Overdue badge + priority + location + time */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <OverdueBadge overdueDays={item.overdue_days} overdueLevel={item.overdue_level} />
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase',
            item.priority === 'critical' ? 'bg-red-100 text-red-800' :
            item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-emerald-100 text-emerald-800'
          )}>
            {item.priority}
          </span>
          <span className="text-xs text-gray-500">{item.location_name}</span>
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>

        {/* Caller Contact Info */}
        {(item.data_context?.caller_number || item.data_context?.ctm_email) && (
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            {item.data_context.caller_number && (
              <a
                href={`tel:${item.data_context.caller_number}`}
                className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {item.data_context.caller_number}
              </a>
            )}
            {item.data_context.ctm_email && (
              <a
                href={`mailto:${item.data_context.ctm_email}`}
                className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {item.data_context.ctm_email}
              </a>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-700 mb-3">{item.description}</p>

        {/* Lead Context */}
        {item.lead && (
          <div className="bg-white/70 border border-gray-200/60 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Link
                href={`/leads/${item.lead.location_id || item.location_id}/${item.lead.id}`}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {item.lead.first_name} {item.lead.last_name}
              </Link>
              {item.lead.source && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  SOURCE_COLORS[item.lead.source] || 'bg-gray-100 text-gray-700'
                )}>
                  {SOURCE_LABELS[item.lead.source] || item.lead.source}
                </span>
              )}
              {item.lead.stage_name && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {item.lead.stage_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              {item.lead.phone && (
                <a href={`tel:${item.lead.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                  <Phone className="w-3 h-3" />
                  {item.lead.phone}
                </a>
              )}
              {item.lead.email && (
                <a href={`mailto:${item.lead.email}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                  <Mail className="w-3 h-3" />
                  {item.lead.email}
                </a>
              )}
            </div>
            {item.lead.last_contact_at ? (
              <p className="text-xs text-gray-500 mt-1.5">
                Last contact: {formatDistanceToNow(new Date(item.lead.last_contact_at), { addSuffix: true })}
              </p>
            ) : (
              <p className="text-xs text-red-500 mt-1.5">Never contacted</p>
            )}
          </div>
        )}

        {/* Recording Links */}
        {recordingUrls.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {recordingUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
              >
                <Headphones className="w-3.5 h-3.5" />
                {recordingUrls.length > 1 ? `Listen to Recording ${i + 1}` : 'Listen to Recording'}
              </a>
            ))}
          </div>
        )}

        {/* AI Suggestion */}
        {item.ai_suggestion && (
          <div className="bg-amber-50/60 border border-amber-200/50 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-800 flex items-start gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              {item.ai_suggestion}
            </p>
          </div>
        )}

        {/* Recommended Action (for items without AI suggestion) */}
        {!item.ai_suggestion && item.recommended_action && (
          <div className="bg-white/60 border border-gray-200/50 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-800 flex items-start gap-1.5">
              <Lightbulb className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              {item.recommended_action}
            </p>
          </div>
        )}

        {/* Create Lead Error */}
        {createLeadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
            <p className="text-xs text-red-700">{createLeadError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Create Lead button for create_lead action items */}
          {showCreateLead && (
            <button
              onClick={handleCreateLead}
              disabled={creatingLead || acting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              {creatingLead ? 'Creating...' : 'Create Lead'}
            </button>
          )}

          {item.action_type === 'call_back' && (
            <>
              {item.lead?.phone && (
                <a
                  href={`tel:${item.lead.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
              )}
              <button
                onClick={() => handleAction('complete')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                onClick={() => handleAction('snooze')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                Snooze
              </button>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Skip
              </button>
            </>
          )}

          {item.action_type === 'send_email' && (
            <>
              <button
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 opacity-60 cursor-not-allowed"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white opacity-60 cursor-not-allowed"
              >
                <Mail className="w-3.5 h-3.5" />
                Send
              </button>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Skip
              </button>
            </>
          )}

          {item.action_type === 'follow_up' && (
            <>
              {item.lead?.phone && (
                <a
                  href={`tel:${item.lead.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
              )}
              {item.lead?.email && (
                <a
                  href={`mailto:${item.lead.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
              <button
                onClick={() => handleAction('complete')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                onClick={() => handleAction('snooze')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                Snooze
              </button>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Skip
              </button>
            </>
          )}

          {item.action_type === 'create_lead' && !showCreateLead && (
            <>
              {item.status === 'open' && (
                <button
                  onClick={() => handleAction('in_progress')}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Mark In Progress
                </button>
              )}
              <button
                onClick={() => handleAction('complete')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </>
          )}

          {item.action_type === 'create_lead' && showCreateLead && (
            <>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </>
          )}

          {(item.action_type === 'general' || !['call_back', 'send_email', 'follow_up', 'create_lead'].includes(item.action_type)) && (
            <>
              {item.status === 'open' && (
                <button
                  onClick={() => handleAction('in_progress')}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Mark In Progress
                </button>
              )}
              <button
                onClick={() => handleAction('complete')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                onClick={() => handleAction('skip')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </>
          )}

          {/* Expand data context */}
          {item.data_context && Object.keys(item.data_context).length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Details
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Expanded Details */}
        {expanded && item.data_context && (
          <div className="mt-4 border-t border-gray-200/50 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Data Context</p>
            <div className="space-y-1.5">
              {Object.entries(item.data_context).map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-500">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-xs text-gray-700">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
