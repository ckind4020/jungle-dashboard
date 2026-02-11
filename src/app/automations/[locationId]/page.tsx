'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Workflow, Play, Pause, Zap, Plus, Trash2 } from 'lucide-react'
import { Automation } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDistanceToNow } from 'date-fns'

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'New lead created',
  stage_changed: 'Stage changed',
  manual: 'Manual enrollment',
  stage_change: 'Stage changed',
  lead_score_change: 'Lead score updated',
  tag_added: 'Tag added',
  form_submitted: 'Form submitted',
}

export default function AutomationsPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/automations?location_id=${locationId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setAutomations)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [locationId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    fetch(`/api/hub/${locationId}`)
      .then(res => res.json())
      .then(d => {
        if (d.location?.name) {
          setLocationName(d.location.name)
          document.title = `Automations — ${d.location.name} | Jungle Driving School`
        }
      })
      .catch(() => {})
  }, [locationId])

  const toggleActive = async (e: React.MouseEvent, id: string, isActive: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch('/api/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    })
    fetchData()
  }

  const deleteAutomation = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    fetchData()
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Automations" />
        <ErrorState message="Could not load automations." onRetry={fetchData} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/hub/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {locationName || 'Hub'}
      </Link>

      <PageHeader
        title={`Automations${locationName ? ` — ${locationName}` : ''}`}
        action={
          <Link
            href={`/automations/${locationId}/new`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Automation
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-72 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No automations yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Automations will auto-send SMS, emails, and update leads based on triggers you define.
          </p>
          <Link
            href={`/automations/${locationId}/new`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Automation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map(auto => (
            <Link
              key={auto.id}
              href={`/automations/${locationId}/${auto.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Zap className={cn('w-5 h-5 mt-0.5', auto.is_active ? 'text-amber-500' : 'text-gray-400')} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{auto.name}</h3>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        auto.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      )}>
                        {auto.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {auto.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{auto.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Trigger: {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{auto.step_count} step{auto.step_count !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{auto.enrolled_count} enrolled</span>
                      <span>·</span>
                      <span>{auto.completed_count} completed</span>
                      <span>·</span>
                      <span>Updated {formatDistanceToNow(new Date(auto.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={(e) => toggleActive(e, auto.id, auto.is_active)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      auto.is_active
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    )}
                  >
                    {auto.is_active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
                  </button>
                  {confirmDeleteId === auto.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => deleteAutomation(e, auto.id)}
                        className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(auto.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
