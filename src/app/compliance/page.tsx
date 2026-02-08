'use client'

import { useState, useEffect, useCallback } from 'react'
import { ComplianceItem } from '@/lib/types'
import { formatPercent, getScoreColor } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { ComplianceSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { CheckCircle2 } from 'lucide-react'

interface ComplianceSummary {
  location_id: string
  location_name: string
  total: number
  current: number
  expiring_soon: number
  expired: number
  score: number
}

interface ComplianceData {
  items: ComplianceItem[]
  summaries: ComplianceSummary[]
}

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/compliance')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Compliance | Jungle Driving School'
    fetchData()
  }, [fetchData])

  if (loading) return <><PageHeader title="Compliance Tracker" subtitle="Across all locations" /><ComplianceSkeleton /></>
  if (error || !data) return <><PageHeader title="Compliance Tracker" subtitle="Across all locations" /><ErrorState message="Could not load compliance data." onRetry={fetchData} /></>

  const columns: Column<ComplianceItem>[] = [
    { key: 'location_name', label: 'Location', sortable: true },
    { key: 'entity_name', label: 'Entity', sortable: true },
    { key: 'entity_type', label: 'Type', sortable: true },
    { key: 'compliance_type', label: 'Compliance Type', sortable: true },
    { key: 'expiry_date', label: 'Expiry Date', sortable: true },
    {
      key: 'days_until_expiry', label: 'Days Left', sortable: true, align: 'right',
      render: (row) => (
        <span className={getScoreColor(row.days_until_expiry, { green: 30, yellow: 14 })}>
          {row.days_until_expiry}
        </span>
      )
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (row) => <StatusBadge status={row.status} />
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Compliance Tracker" subtitle="Across all locations" />

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.summaries.map(summary => (
          <div key={summary.location_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <h4 className="text-sm font-medium text-gray-500 mb-3">{summary.location_name}</h4>
            <p className={`text-3xl font-bold ${getScoreColor(summary.score, { green: 90, yellow: 75 })}`}>
              {formatPercent(summary.score)}
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-emerald-600">{summary.current} current</span>
              <span className="text-amber-500">{summary.expiring_soon} expiring</span>
              <span className="text-red-500">{summary.expired} expired</span>
            </div>
          </div>
        ))}
      </div>

      {/* Items Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Compliance Items</h3>
        {data.items.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-emerald-800 mb-1">All items are current</h3>
            <p className="text-sm text-emerald-600">No compliance issues to address.</p>
          </div>
        ) : (
          <DataTable<ComplianceItem>
            data={data.items}
            columns={columns}
            defaultSortKey="days_until_expiry"
            defaultSortDir="asc"
          />
        )}
      </div>
    </div>
  )
}
