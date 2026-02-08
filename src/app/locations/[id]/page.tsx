'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { Users, Phone, ShieldCheck, Star, DollarSign, PhoneMissed, BookOpen, Car, CalendarClock, AlertTriangle, Zap, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { LocationDetail, KpiDaily, StudentSummary, InstructorSummary, VehicleSummary, ComplianceItem, GbpReview, ClassSummary, DriveBacklogStudent } from '@/lib/types'
import { formatCurrency, formatPercent, formatNumber, getScoreColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import DataTable, { Column } from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { LocationDetailSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

/* eslint-disable @typescript-eslint/no-explicit-any */

type TabKey = 'students' | 'instructors' | 'vehicles' | 'compliance' | 'reviews'

// === Action Item Types ===
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// === Location Action Items Sub-Component ===
function LocationActionItems({ locationId }: { locationId: string }) {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/actions?location_id=${locationId}&status=open,in_progress`)
      const data = await res.json()
      setItems(data.items || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [locationId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchItems()
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-3/4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
        <span className="text-sm text-gray-500">({items.length})</span>
      </div>
      <div className="space-y-3">
        {items.map(item => {
          const style = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium
          const isExpanded = expandedId === item.id
          return (
            <div key={item.id} className={cn('rounded-lg shadow-sm border border-gray-200 overflow-hidden', style.border, style.bg)}>
              <div className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase', style.badge)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
                    {item.priority}
                  </span>
                  <span className="text-xs text-gray-500">{CATEGORY_LABELS[item.category] || item.category}</span>
                  <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(item.created_at)}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h4>
                <p className="text-xs text-gray-600 mb-2">{item.description}</p>
                <div className="bg-white/60 border border-gray-200/50 rounded p-2 mb-3">
                  <p className="text-xs text-gray-700">
                    <span className="mr-1">💡</span>
                    {item.recommended_action}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {item.status === 'open' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Clock className="w-3 h-3" />
                      In Progress
                    </button>
                  )}
                  {item.status === 'in_progress' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'resolved')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve
                    </button>
                  )}
                  {(item.status === 'open' || item.status === 'in_progress') && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'dismissed')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                    >
                      <XCircle className="w-3 h-3" />
                      Dismiss
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Details
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                {isExpanded && item.data_context && (
                  <div className="mt-3 border-t border-gray-200/50 pt-3 space-y-1">
                    {Object.entries(item.data_context).map(([key, value]) => (
                      <div key={key} className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-gray-500">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-xs text-gray-600">
                          {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(2) : value)
                            : Array.isArray(value) ? `${value.length} items`
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// === Operations Forecast Sub-Component ===
function OperationsForecast({ data }: { data: LocationDetail }) {
  const classes = (data.classes || []).map(c => ({
    ...c,
    fill_rate: c.capacity > 0 ? Math.round((c.enrolled_count / c.capacity) * 100) : 0,
  }))
  const avgFillRate = classes.length
    ? Math.round(classes.reduce((s, c) => s + c.fill_rate, 0) / classes.length)
    : 0

  // Enrich drive backlog students with scheduled counts
  const scheduledDrives = data.scheduled_drives || []
  const backlogStudents: DriveBacklogStudent[] = (data.drive_backlog || []).map(s => {
    const scheduled_count = scheduledDrives.filter(d => d.student_id === s.id).length
    return { ...s, scheduled_count }
  })
  // Sort by gap descending
  const sortedBacklog = [...backlogStudents].sort((a, b) => {
    const gapA = a.lessons_remaining - (a.scheduled_count || 0)
    const gapB = b.lessons_remaining - (b.scheduled_count || 0)
    return gapB - gapA
  })

  const totalOutstanding = backlogStudents.reduce((s, st) => s + st.lessons_remaining, 0)
  const totalScheduled = scheduledDrives.length

  // Staffing insight
  const estimatedDrivesPerWeek = totalScheduled > 0 ? Math.round(totalScheduled * 7 / 14) : Math.max(totalOutstanding > 0 ? 5 : 0, 1)
  const weeksToClr = estimatedDrivesPerWeek > 0 ? Math.ceil(totalOutstanding / estimatedDrivesPerWeek) : 0
  const hoursNeeded = totalOutstanding > 0 ? Math.ceil(totalOutstanding / 8) : 0

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Operations Forecast</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Capacity Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h4 className="text-sm font-semibold text-gray-900">Class Capacity</h4>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {classes.length} active/upcoming class{classes.length !== 1 ? 'es' : ''} — avg fill rate: <span className={getScoreColor(avgFillRate, { green: 90, yellow: 60 })}>{avgFillRate}%</span>
          </p>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No active or upcoming classes.</p>
          ) : (
            <div className="space-y-3">
              {classes.map(cls => {
                const fillColor = cls.fill_rate >= 90 ? 'bg-emerald-500' : cls.fill_rate >= 60 ? 'bg-amber-500' : 'bg-red-500'
                const fillTextColor = cls.fill_rate >= 90 ? 'text-emerald-600' : cls.fill_rate >= 60 ? 'text-amber-600' : 'text-red-600'
                return (
                  <div key={cls.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">{cls.name}</span>
                        <span className={`text-xs font-semibold ${fillTextColor}`}>{cls.fill_rate}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${Math.min(cls.fill_rate, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{cls.enrolled_count}/{cls.capacity}</span>
                      </div>
                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                        <span>{cls.class_type}</span>
                        <span>·</span>
                        <StatusBadge status={cls.status} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Drive Hours Backlog Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Car className="w-5 h-5 text-orange-500" />
            <h4 className="text-sm font-semibold text-gray-900">Drive Hours Backlog</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalOutstanding}</p>
              <p className="text-xs text-gray-500">Outstanding hrs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{backlogStudents.length}</p>
              <p className="text-xs text-gray-500">Students w/ drives left</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{totalScheduled}</p>
              <p className="text-xs text-gray-500">Already scheduled</p>
            </div>
          </div>

          {sortedBacklog.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No students with remaining drives.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Done</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Left</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Class Left</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Sched.</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBacklog.map(s => {
                    const gap = s.lessons_remaining - (s.scheduled_count || 0)
                    return (
                      <tr key={s.id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-900">{s.first_name} {s.last_name}</td>
                        <td className="py-2 text-right text-gray-600">{s.lessons_completed}</td>
                        <td className="py-2 text-right text-gray-600">{s.lessons_remaining}</td>
                        <td className="py-2 text-right text-gray-600">{s.classroom_hours_remaining}</td>
                        <td className="py-2 text-right text-gray-600">{s.scheduled_count || 0}</td>
                        <td className="py-2 text-right">
                          {gap > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              {gap} unscheduled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              Fully booked
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalOutstanding > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800">
                  At current pace (~{estimatedDrivesPerWeek} drives/week), backlog clears in ~{weeksToClr} weeks.
                  You need ~{hoursNeeded} instructor-hours/week to clear in 8 weeks.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<LocationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('students')

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/locations/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (data?.location?.name) {
      document.title = `${data.location.name} | Jungle Driving School`
    }
  }, [data?.location?.name])

  if (loading) return <><PageHeader title="Location Detail" /><LocationDetailSkeleton /></>
  if (error || !data || !data.location) return <><PageHeader title="Location Detail" /><ErrorState message="Could not load location data." onRetry={fetchData} /></>

  const { location, trends } = data
  // Fallback: use an empty KPI object if today's snapshot is missing
  const today = data.today || {
    active_students: 0, contact_rate: 0, compliance_score: 0,
    gbp_overall_rating: 0, revenue_collected: 0, missed_call_rate: 0,
    cost_per_lead: 0,
  } as KpiDaily

  // Chart data
  const trendChartData = trends.map(t => ({
    date: t.date.slice(5),
    compliance_score: Number(t.compliance_score),
    missed_call_rate: Number(t.missed_call_rate),
    new_leads: t.new_leads,
    revenue: Number(t.revenue_collected),
  }))

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'students', label: 'Students', count: data.students.length },
    { key: 'instructors', label: 'Instructors', count: data.instructors.length },
    { key: 'vehicles', label: 'Vehicles', count: data.vehicles.length },
    { key: 'compliance', label: 'Compliance', count: data.compliance_items.length },
    { key: 'reviews', label: 'Reviews', count: data.recent_reviews.length },
  ]

  const studentColumns: Column<StudentSummary>[] = [
    { key: 'last_name', label: 'Name', sortable: true, render: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'program_type', label: 'Program', sortable: true },
    { key: 'lessons_completed', label: 'Drives Done', sortable: true, align: 'right' },
    { key: 'lessons_remaining', label: 'Drives Left', sortable: true, align: 'right' },
    { key: 'classroom_hours_completed', label: 'Class Hrs', sortable: true, align: 'right' },
    { key: 'classroom_hours_remaining', label: 'Class Left', sortable: true, align: 'right' },
    { key: 'balance_due', label: 'Balance', sortable: true, align: 'right', render: (r) => formatCurrency(r.balance_due) },
  ]

  const instructorColumns: Column<InstructorSummary>[] = [
    { key: 'last_name', label: 'Name', sortable: true, render: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'avg_student_rating', label: 'Rating', sortable: true, align: 'right', render: (r) => r.avg_student_rating?.toFixed(1) || 'N/A' },
    { key: 'hire_date', label: 'Hire Date', sortable: true },
  ]

  const vehicleColumns: Column<VehicleSummary>[] = [
    { key: 'make', label: 'Vehicle', sortable: true, render: (r) => `${r.year} ${r.make} ${r.model}` },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'mileage', label: 'Mileage', sortable: true, align: 'right', render: (r) => formatNumber(r.mileage) },
  ]

  const complianceColumns: Column<ComplianceItem>[] = [
    { key: 'entity_name', label: 'Entity', sortable: true },
    { key: 'entity_type', label: 'Type', sortable: true },
    { key: 'compliance_type', label: 'Compliance Type', sortable: true },
    { key: 'expiry_date', label: 'Expiry', sortable: true },
    { key: 'days_until_expiry', label: 'Days Left', sortable: true, align: 'right',
      render: (r) => <span className={getScoreColor(r.days_until_expiry, { green: 30, yellow: 14 })}>{r.days_until_expiry}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title={location.name} subtitle="Location detail" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Active Students" value={formatNumber(today.active_students)} icon={Users} />
        <KpiCard
          title="Contact Rate"
          value={formatPercent(today.contact_rate)}
          icon={Phone}
          score={today.contact_rate}
          thresholds={{ green: 80, yellow: 60 }}
        />
        <KpiCard
          title="Compliance"
          value={formatPercent(today.compliance_score)}
          icon={ShieldCheck}
          score={today.compliance_score}
          thresholds={{ green: 90, yellow: 75 }}
        />
        <KpiCard
          title="GBP Rating"
          value={Number(today.gbp_overall_rating).toFixed(1)}
          icon={Star}
          score={Number(today.gbp_overall_rating) * 20}
          thresholds={{ green: 90, yellow: 80 }}
        />
        <KpiCard title="Revenue Today" value={formatCurrency(today.revenue_collected)} icon={DollarSign} />
        <KpiCard
          title="Missed Call Rate"
          value={formatPercent(today.missed_call_rate)}
          icon={PhoneMissed}
          score={100 - today.missed_call_rate}
          thresholds={{ green: 85, yellow: 70 }}
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Compliance & Missed Calls (30d)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="compliance_score" name="Compliance %" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="missed_call_rate" name="Missed Call %" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Leads & Revenue (30d)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="new_leads" name="New Leads" fill="#3b82f6" />
              <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action Items for this Location */}
      <LocationActionItems locationId={id} />

      {/* Operations Forecast */}
      <OperationsForecast data={data} />

      {/* Tabbed Tables */}
      <div>
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {activeTab === 'students' && (
          <DataTable<StudentSummary>
            data={data.students}
            columns={studentColumns}
            defaultSortKey="last_name"
            defaultSortDir="asc"
          />
        )}

        {activeTab === 'instructors' && (
          <DataTable<InstructorSummary>
            data={data.instructors}
            columns={instructorColumns}
            defaultSortKey="last_name"
            defaultSortDir="asc"
          />
        )}

        {activeTab === 'vehicles' && (
          <DataTable<VehicleSummary>
            data={data.vehicles}
            columns={vehicleColumns}
            defaultSortKey="mileage"
          />
        )}

        {activeTab === 'compliance' && (
          <DataTable<ComplianceItem>
            data={data.compliance_items}
            columns={complianceColumns}
            defaultSortKey="days_until_expiry"
            defaultSortDir="asc"
          />
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {data.recent_reviews.map(review => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{review.reviewer_name}</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < review.star_rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{review.review_date}</span>
                    {review.has_reply ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Replied</span>
                    ) : (
                      <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">No Reply</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700">{review.review_text}</p>
                {review.reply_text && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-200">
                    <p className="text-sm text-gray-500">{review.reply_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
