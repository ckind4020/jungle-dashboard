'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { HubData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton'
import OverviewTab from '@/components/hub/OverviewTab'
import IntegrationsTab from '@/components/hub/IntegrationsTab'
import SettingsTab from '@/components/hub/SettingsTab'

type TabKey = 'overview' | 'integrations' | 'settings'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'settings', label: 'Settings' },
]

export default function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/hub/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (data?.location?.name) {
      document.title = `${data.location.name} Hub | Jungle Driving School`
    }
  }, [data?.location?.name])

  if (loading) return <><PageHeader title="Franchise Hub" /><DashboardSkeleton /></>
  if (error || !data || !data.location) return <><PageHeader title="Franchise Hub" /><ErrorState message="Could not load hub data." onRetry={fetchData} /></>

  const { location } = data
  const addressParts = [location.address_line1, location.city, location.state, location.zip_code].filter(Boolean)
  const subtitle = [
    addressParts.length > 0 ? addressParts.join(', ') : null,
    location.manager_name ? `Manager: ${location.manager_name}` : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <div className="space-y-6">
      <PageHeader title={location.name} subtitle={subtitle} />

      {/* Tab switcher */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab data={data} onSwitchTab={(tab: string) => setActiveTab(tab as TabKey)} />}
      {activeTab === 'integrations' && <IntegrationsTab data={data} onRefresh={fetchData} />}
      {activeTab === 'settings' && <SettingsTab data={data} onRefresh={fetchData} />}
    </div>
  )
}
