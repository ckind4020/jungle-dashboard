'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, ShieldCheck, DollarSign } from 'lucide-react'
import { CorporateDashboardData, LocationSummary } from '@/lib/types'
import { formatCurrency, formatPercent, formatNumber, getScoreColor } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import DataTable, { Column } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDistanceToNow } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const LOCATION_COLORS = ['#3b82f6', '#10b981', '#f59e0b']

export default function DashboardPage() {
  const [data, setData] = useState<(CorporateDashboardData & { updated_at?: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const router = useRouter()

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/dashboard')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Dashboard | Jungle Driving School'
    fetchData()
  }, [fetchData])

  if (loading) return <><PageHeader title="Network Overview" subtitle="All 3 locations" /><DashboardSkeleton /></>
  if (error || !data) return <><PageHeader title="Network Overview" subtitle="All 3 locations" /><ErrorState message="Could not load dashboard data." onRetry={fetchData} /></>

  const { totals, locations, trends } = data

  const locationNames = [...new Set(trends.map(t => t.location_name))]
  const trendDates = [...new Set(trends.map(t => t.date))].sort()

  const studentChartData = trendDates.map(date => {
    const row: Record<string, unknown> = { date: date.slice(5) }
    locationNames.forEach(name => {
      const entry = trends.find(t => t.date === date && t.location_name === name)
      row[name] = entry?.active_students || 0
    })
    return row
  })

  const revenueChartData = trendDates.map(date => {
    const row: Record<string, unknown> = { date: date.slice(5) }
    locationNames.forEach(name => {
      const entry = trends.find(t => t.date === date && t.location_name === name)
      row[name] = entry?.revenue_collected || 0
    })
    return row
  })

  const columns: Column<LocationSummary>[] = [
    { key: 'name', label: 'Location', sortable: true },
    { key: 'active_students', label: 'Students', sortable: true, align: 'right' },
    { key: 'new_leads_7d', label: 'Leads (7d)', sortable: true, align: 'right' },
    {
      key: 'contact_rate', label: 'Contact Rate', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.contact_rate, { green: 80, yellow: 60 })}>
          {formatPercent(row.contact_rate)}
        </span>
      )
    },
    {
      key: 'missed_call_rate', label: 'Missed Calls', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(100 - row.missed_call_rate, { green: 85, yellow: 70 })}>
          {formatPercent(row.missed_call_rate)}
        </span>
      )
    },
    {
      key: 'compliance_score', label: 'Compliance', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.compliance_score, { green: 90, yellow: 75 })}>
          {formatPercent(row.compliance_score)}
        </span>
      )
    },
    {
      key: 'gbp_rating', label: 'GBP Rating', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.gbp_rating * 20, { green: 90, yellow: 80 })}>
          {row.gbp_rating.toFixed(1)}
        </span>
      )
    },
    { key: 'gbp_unreplied_reviews', label: 'Unreplied', sortable: true, align: 'right' },
    {
      key: 'revenue_collected_7d', label: 'Revenue (7d)', sortable: true, align: 'right',
      render: (row) => formatCurrency(row.revenue_collected_7d)
    },
    {
      key: 'cost_per_lead', label: 'CPL', sortable: true, align: 'right',
      render: (row) => formatCurrency(row.cost_per_lead)
    },
    {
      key: 'drive_backlog', label: 'Drive Backlog', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.drive_backlog <= 40 ? 90 : row.drive_backlog <= 80 ? 80 : 50, { green: 90, yellow: 75 })}>
          {row.drive_backlog} hrs
        </span>
      )
    },
  ]

  const updatedText = data.updated_at
    ? `Last updated ${formatDistanceToNow(new Date(data.updated_at), { addSuffix: true })}`
    : undefined

  return (
    <div className="space-y-8">
      <PageHeader
        title="Network Overview"
        subtitle={updatedText || `All ${locations.length} locations`}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Total Active Students"
          value={formatNumber(totals.total_active_students)}
          icon={Users}
        />
        <KpiCard
          title="New Leads (7d)"
          value={formatNumber(totals.total_new_leads_7d)}
          icon={UserPlus}
        />
        <KpiCard
          title="Avg Compliance Score"
          value={formatPercent(totals.avg_compliance_score)}
          icon={ShieldCheck}
          score={totals.avg_compliance_score}
          thresholds={{ green: 90, yellow: 75 }}
        />
        <KpiCard
          title="Total Revenue (7d)"
          value={formatCurrency(totals.total_revenue_7d)}
          icon={DollarSign}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Active Students (30d)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={studentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {locationNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Revenue Collected (30d)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {locationNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="revenue"
                  fill={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Location Summary Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Overview</h3>
        <DataTable<LocationSummary>
          data={locations}
          columns={columns}
          defaultSortKey="revenue_collected_7d"
          onRowClick={(row) => router.push(`/locations/${row.id}`)}
          highlightBestWorst
        />
      </div>
    </div>
  )
}
