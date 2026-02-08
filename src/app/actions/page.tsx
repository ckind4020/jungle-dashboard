'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ActionsSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ActionItem {
  id: string
  rule_id: string
  category: string
  priority: string
  status: string
  title: string
  description: string
  recommended_action: string
  data_context: Record<string, any>
  location_name: string
  created_at: string
  updated_at: string
}

interface Summary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  by_category: { category: string; count: number }[]
}

const PRIORITY_STYLES: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  critical: { border: 'border-l-4 border-red-500', bg: 'bg-red-50', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  high: { border: 'border-l-4 border-orange-500', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  medium: { border: 'border-l-4 border-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  low: { border: 'border-l-4 border-emerald-500', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
}

const CATEGORY_LABELS: Record<string, string> = {
  lead_followup: 'Lead Follow-up',
  marketing: 'Marketing',
  compliance: 'Compliance',
  operations: 'Operations',
  financial: 'Financial',
  performance: 'Performance',
  reputation: 'Reputation',
  scheduling: 'Scheduling',
}

const STATUS_OPTIONS = [
  { value: 'open,in_progress', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'open,in_progress,resolved,dismissed,expired', label: 'All' },
]

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function ActionItemCard({
  item,
  onUpdateStatus,
}: {
  item: ActionItem
  onUpdateStatus: (id: string, status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const style = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium

  const handleStatus = async (status: string) => {
    setUpdating(true)
    await onUpdateStatus(item.id, status)
    setUpdating(false)
  }

  return (
    <div className={cn('rounded-lg shadow-sm border border-gray-200 overflow-hidden', style.border, style.bg)}>
      <div className="p-5">
        {/* Top Row: Priority, Category, Location, Time */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase', style.badge)}>
            <span className={cn('w-2 h-2 rounded-full', style.dot)} />
            {item.priority}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
          <span className="text-xs text-gray-500">{item.location_name}</span>
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(item.created_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>

        {/* Description */}
        <p className="text-sm text-gray-700 mb-3">{item.description}</p>

        {/* Recommended Action */}
        <div className="bg-white/60 border border-gray-200/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-800">
            <span className="mr-1">💡</span>
            {item.recommended_action}
          </p>
        </div>

        {/* Actions Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.status === 'open' && (
            <button
              onClick={() => handleStatus('in_progress')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" />
              Mark In Progress
            </button>
          )}
          {item.status === 'in_progress' && (
            <button
              onClick={() => handleStatus('resolved')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Resolved
            </button>
          )}
          {(item.status === 'open' || item.status === 'in_progress') && (
            <button
              onClick={() => handleStatus('dismissed')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Dismiss
            </button>
          )}
          {item.status === 'in_progress' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <Clock className="w-3 h-3" />
              In Progress
            </span>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            View Details
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Expanded Details */}
        {expanded && item.data_context && (
          <div className="mt-4 border-t border-gray-200/50 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Data Context</p>
            <div className="space-y-1.5">
              {Object.entries(item.data_context).map(([key, value]) => {
                if (Array.isArray(value)) {
                  return (
                    <div key={key}>
                      <span className="text-xs font-medium text-gray-500">{key.replace(/_/g, ' ')}:</span>
                      <div className="ml-2 mt-1 space-y-0.5">
                        {value.slice(0, 5).map((v: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </p>
                        ))}
                        {value.length > 5 && <p className="text-xs text-gray-400">+{value.length - 5} more</p>}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={key} className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gray-500">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-xs text-gray-700">
                      {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(2) : value) : String(value)}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">Rule ID: {item.rule_id}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [engineRunning, setEngineRunning] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  // Filters
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('open,in_progress')

  const fetchActions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter })
      if (locationFilter !== 'all') params.set('location_id', locationFilter)
      const res = await fetch(`/api/actions?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      setSummary(data.summary || null)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, locationFilter])

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

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchActions()
    } catch { /* ignore */ }
  }

  // Apply category filter client-side
  const filteredItems = categoryFilter === 'all'
    ? items
    : items.filter(i => i.category === categoryFilter)

  const categories = ['all', 'lead_followup', 'marketing', 'compliance', 'operations', 'financial', 'performance', 'reputation']

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Action Items"
        subtitle={summary ? `${summary.total} items across ${locations.length || 3} locations` : 'Automated alerts and recommendations'}
        action={
          <button
            onClick={handleRunEngine}
            disabled={engineRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw className={cn('w-4 h-4', engineRunning && 'animate-spin')} />
            {engineRunning ? 'Running Engine...' : 'Run Engine Now'}
          </button>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{summary.critical}</p>
            <p className="text-xs font-medium text-red-600 mt-1">Critical</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-700">{summary.high}</p>
            <p className="text-xs font-medium text-orange-600 mt-1">High</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-700">{summary.medium}</p>
            <p className="text-xs font-medium text-yellow-600 mt-1">Medium</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-700">{summary.low}</p>
            <p className="text-xs font-medium text-emerald-600 mt-1">Low</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Location:</label>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Status:</label>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    statusFilter === opt.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Category:</label>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Item Cards */}
      {loading ? (
        <ActionsSkeleton />
      ) : filteredItems.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-800 mb-1">All clear!</h3>
          <p className="text-sm text-emerald-600">
            No action items right now. Run the engine to check for new issues.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{filteredItems.length} action item{filteredItems.length !== 1 ? 's' : ''}</p>
          {filteredItems.map(item => (
            <ActionItemCard
              key={item.id}
              item={item}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
