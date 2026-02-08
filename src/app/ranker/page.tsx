'use client'

import { useState, useEffect, useCallback } from 'react'
import { RankerRow } from '@/lib/types'
import { formatCurrency, formatPercent, formatNumber, getScoreColor } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { RankerSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'

export default function RankerPage() {
  const [rows, setRows] = useState<RankerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/ranker')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => setRows(data.rows || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Rankings | Jungle Driving School'
    fetchData()
  }, [fetchData])

  if (loading) return <><PageHeader title="Franchise Rankings" subtitle="Sorted by performance" /><RankerSkeleton /></>
  if (error) return <><PageHeader title="Franchise Rankings" subtitle="Sorted by performance" /><ErrorState message="Could not load rankings data." onRetry={fetchData} /></>

  const columns: Column<RankerRow>[] = [
    {
      key: 'rank', label: '#', align: 'center',
      render: (_, i) => <span className="font-semibold text-gray-500">{(i ?? 0) + 1}</span>
    },
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
      key: 'missed_call_rate', label: 'Missed Call %', sortable: true, align: 'right',
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
    { key: 'unreplied_reviews', label: 'Unreplied', sortable: true, align: 'right' },
    {
      key: 'cost_per_lead_7d', label: 'CPL', sortable: true, align: 'right',
      render: (row) => formatCurrency(row.cost_per_lead_7d)
    },
    {
      key: 'revenue_7d', label: 'Revenue (7d)', sortable: true, align: 'right',
      render: (row) => formatCurrency(row.revenue_7d)
    },
    {
      key: 'ad_spend_7d', label: 'Ad Spend (7d)', sortable: true, align: 'right',
      render: (row) => formatCurrency(row.ad_spend_7d)
    },
    {
      key: 'rev_per_student', label: 'Rev / Student', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.rev_per_student, { green: 500, yellow: 300 })}>
          {formatCurrency(row.rev_per_student)}
        </span>
      )
    },
    {
      key: 'instructor_utilization', label: 'Instructor Util.', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.instructor_utilization, { green: 70, yellow: 50 })}>
          {row.instructor_utilization}%
        </span>
      )
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

  return (
    <div className="space-y-6">
      <PageHeader title="Franchise Rankings" subtitle="Click any column header to sort. Best values highlighted green, worst red." />
      <DataTable<RankerRow>
        data={rows}
        columns={columns}
        defaultSortKey="revenue_7d"
        highlightBestWorst
      />
    </div>
  )
}
