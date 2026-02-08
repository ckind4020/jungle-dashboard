'use client'

import { useState, useEffect, useCallback } from 'react'
import { MarketingData, AdSpendSummary } from '@/lib/types'
import { formatCurrency, formatNumber } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { MarketingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Star, MessageSquare, Eye, Search } from 'lucide-react'

const LOCATION_COLORS = ['#3b82f6', '#10b981', '#f59e0b']

export default function MarketingPage() {
  const [data, setData] = useState<MarketingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/marketing')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Marketing | Jungle Driving School'
    fetchData()
  }, [fetchData])

  if (loading) return <><PageHeader title="Marketing Performance" subtitle="Last 30 days" /><MarketingSkeleton /></>
  if (error || !data) return <><PageHeader title="Marketing Performance" subtitle="Last 30 days" /><ErrorState message="Could not load marketing data." onRetry={fetchData} /></>

  const locationNames = [...new Set(data.ad_spend_trends.map(t => t.location_name))]
  const dates = [...new Set(data.ad_spend_trends.map(t => t.date))].sort()

  const chartData = dates.map(date => {
    const row: Record<string, unknown> = { date: date.slice(5) }
    locationNames.forEach(name => {
      const entries = data.ad_spend_trends.filter(t => t.date === date && t.location_name === name)
      row[name] = entries.reduce((sum, e) => sum + Number(e.spend), 0)
    })
    return row
  })

  const adSpendColumns: Column<AdSpendSummary>[] = [
    { key: 'location_name', label: 'Location', sortable: true },
    { key: 'source', label: 'Source', sortable: true },
    { key: 'total_spend', label: 'Spend', sortable: true, align: 'right', render: (row) => formatCurrency(row.total_spend) },
    { key: 'total_impressions', label: 'Impressions', sortable: true, align: 'right', render: (row) => formatNumber(row.total_impressions) },
    { key: 'total_clicks', label: 'Clicks', sortable: true, align: 'right', render: (row) => formatNumber(row.total_clicks) },
    { key: 'total_conversions', label: 'Conversions', sortable: true, align: 'right', render: (row) => formatNumber(row.total_conversions) },
    { key: 'avg_cpl', label: 'Avg CPL', sortable: true, align: 'right', render: (row) => formatCurrency(row.avg_cpl) },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Marketing Performance" subtitle="Last 30 days" />

      {/* GBP Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Business Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.gbp_metrics.map((gbp) => (
            <div key={gbp.location_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h4 className="text-sm font-medium text-gray-500 mb-4">{gbp.location_name}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{gbp.overall_rating.toFixed(1)}</p>
                    <p className="text-xs text-gray-500">{gbp.total_reviews} reviews</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{gbp.unreplied_count}</p>
                    <p className="text-xs text-gray-500">Unreplied</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{Math.round(gbp.avg_search_views_7d)}</p>
                    <p className="text-xs text-gray-500">Avg Search/d</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{Math.round(gbp.avg_maps_views_7d)}</p>
                    <p className="text-xs text-gray-500">Avg Maps/d</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ad Spend Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Daily Ad Spend by Location (30d)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            {locationNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="spend"
                stroke={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                fill={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ad Spend Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Spend by Location & Source</h3>
        <DataTable<AdSpendSummary>
          data={data.ad_spend_by_location}
          columns={adSpendColumns}
          defaultSortKey="total_spend"
        />
      </div>
    </div>
  )
}
