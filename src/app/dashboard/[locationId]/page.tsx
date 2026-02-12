'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { KpiCards } from '@/components/dashboard-lite/KpiCards'
import { AdSpendChart } from '@/components/dashboard-lite/AdSpendChart'
import { CostPerLeadTable } from '@/components/dashboard-lite/CostPerLeadTable'
import { LeadsBySourceChart } from '@/components/dashboard-lite/LeadsBySourceChart'
import { CallTrackingCard } from '@/components/dashboard-lite/CallTrackingCard'
import { GbpCard } from '@/components/dashboard-lite/GbpCard'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function DashboardLitePage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [days, setDays] = useState(30)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/dashboard/${locationId}?days=${days}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(d => {
        setData(d)
        if (d.location?.name) {
          document.title = `${d.location.name} — Marketing Dashboard | Jungle Driving School`
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [locationId, days])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Marketing Dashboard" />
        <ErrorState message="Could not load dashboard data." onRetry={fetchData} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/hub/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h1 className="text-xl font-bold text-gray-900">
              {data?.location?.name || 'Loading...'} — Marketing Dashboard
            </h1>
          </div>
          {data?.location && (
            <p className="text-sm text-gray-500 mt-1">
              {data.location.location_number && <span>{data.location.location_number} · </span>}
              {data.period && <span>{data.period.start} to {data.period.end}</span>}
            </p>
          )}
        </div>

        {/* Period Selector */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                days === p.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* KPI skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
                <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            <div className="h-64 bg-gray-100 rounded" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <KpiCards summary={data.summary} />

          {/* Ad Spend Chart */}
          <AdSpendChart data={data.ad_spend_chart} locationId={locationId} />

          {/* CPL Table */}
          <CostPerLeadTable data={data.ad_spend_summary} />

          {/* Leads by Source */}
          <LeadsBySourceChart data={data.lead_source_summary} />

          {/* Call Tracking */}
          <CallTrackingCard
            callSummary={data.call_summary}
            callsByHour={data.calls_by_hour}
            missedByHour={data.missed_by_hour}
          />

          {/* GBP */}
          <GbpCard
            gbp={data.gbp}
            recentReviews={data.recent_reviews}
            unrepliedCount={data.summary.unreplied_reviews}
            locationId={locationId}
          />
        </div>
      ) : null}
    </div>
  )
}
