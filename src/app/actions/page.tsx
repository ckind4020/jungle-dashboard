'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, Phone, Mail, Clock, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ActionsSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import ActionSection from '@/components/actions/ActionSection'
import { ActionItemData } from '@/components/actions/ActionItemCard'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Summary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  overdue_count: number
  by_action_type: Record<string, number>
}

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItemData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [engineRunning, setEngineRunning] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationFilter, setLocationFilter] = useState<string>('all')

  const fetchActions = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ status: 'open,in_progress' })
      if (locationFilter !== 'all') params.set('location_id', locationFilter)
      const res = await fetch(`/api/actions?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items || [])
      setSummary(data.summary || null)
    } catch {
      setError(true)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [locationFilter])

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      if (data.locations) {
        setLocations(data.locations.map((l: any) => ({ id: l.id, name: l.name })))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { document.title = 'Action Items | Jungle Driving School'; fetchLocations() }, [fetchLocations])
  useEffect(() => { fetchActions() }, [fetchActions])

  const handleRunEngine = async () => {
    setEngineRunning(true)
    try {
      await fetch('/api/engine/evaluate', { method: 'POST' })
      await fetchActions()
    } catch { /* ignore */ }
    setEngineRunning(false)
  }

  const handleAction = async (id: string, action: string) => {
    try {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await fetchActions()
    } catch { /* ignore */ }
  }

  // Group items by section
  const overdueItems = items.filter(i => i.overdue_days > 0)
  const callBackItems = items.filter(i => i.action_type === 'call_back' && i.overdue_days === 0)
  const emailItems = items.filter(i => i.action_type === 'send_email' && i.overdue_days === 0)
  const followUpItems = items.filter(i => i.action_type === 'follow_up' && i.overdue_days === 0)
  const otherItems = items.filter(i =>
    !['call_back', 'send_email', 'follow_up'].includes(i.action_type) && i.overdue_days === 0
  )

  const selectedLocationName = locationFilter === 'all'
    ? 'All Locations'
    : locations.find(l => l.id === locationFilter)?.name || 'All Locations'

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Action Items — ${selectedLocationName}`}
        subtitle={today}
        action={
          <div className="flex items-center gap-3">
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <button
              onClick={handleRunEngine}
              disabled={engineRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', engineRunning && 'animate-spin')} />
              {engineRunning ? 'Running...' : 'Run Engine'}
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn(
            'rounded-xl p-4 text-center border',
            summary.overdue_count > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          )}>
            <p className={cn('text-3xl font-bold', summary.overdue_count > 0 ? 'text-red-700' : 'text-gray-400')}>
              {summary.overdue_count}
            </p>
            <p className={cn('text-xs font-medium mt-1', summary.overdue_count > 0 ? 'text-red-600' : 'text-gray-500')}>
              Overdue
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{summary.by_action_type.call_back || 0}</p>
            <p className="text-xs font-medium text-blue-600 mt-1">Call Back</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-700">{summary.by_action_type.send_email || 0}</p>
            <p className="text-xs font-medium text-purple-600 mt-1">Emails</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{summary.by_action_type.follow_up || 0}</p>
            <p className="text-xs font-medium text-amber-600 mt-1">Follow Up</p>
          </div>
        </div>
      )}

      {/* Action Item Sections */}
      {loading ? (
        <ActionsSkeleton />
      ) : error ? (
        <ErrorState message="Could not load action items." onRetry={fetchActions} />
      ) : items.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-800 mb-1">All clear!</h3>
          <p className="text-sm text-emerald-600">
            No action items right now. Run the engine to check for new issues.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <ActionSection
            title="Overdue"
            icon="🔴"
            count={overdueItems.length}
            items={overdueItems}
            onAction={handleAction}
          />
          <ActionSection
            title="Call Back"
            icon="📞"
            count={callBackItems.length}
            items={callBackItems}
            onAction={handleAction}
          />
          <ActionSection
            title="Emails to Send"
            icon="📧"
            count={emailItems.length}
            items={emailItems}
            onAction={handleAction}
          />
          <ActionSection
            title="Follow Ups"
            icon="📅"
            count={followUpItems.length}
            items={followUpItems}
            onAction={handleAction}
          />
          <ActionSection
            title="Other"
            icon="📋"
            count={otherItems.length}
            items={otherItems}
            onAction={handleAction}
          />
        </div>
      )}
    </div>
  )
}
