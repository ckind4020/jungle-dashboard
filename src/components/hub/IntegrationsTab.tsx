'use client'

import { HubData, IntegrationSync, LocationProfile } from '@/lib/types'
import { INTEGRATIONS } from '@/lib/integrations'
import IntegrationCard from './IntegrationCard'
import { formatDistanceToNow } from 'date-fns'

interface IntegrationsTabProps {
  data: HubData
  onRefresh: () => void
}

export default function IntegrationsTab({ data, onRefresh }: IntegrationsTabProps) {
  const { location, integrations } = data

  const connectedCount = INTEGRATIONS.filter(config => {
    const accountId = location[config.accountIdField]
    return !!accountId
  }).length

  const latestSync = integrations
    .filter((s: IntegrationSync) => s.completed_at)
    .sort((a: IntegrationSync, b: IntegrationSync) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]

  const handleSaveAccountId = async (field: keyof LocationProfile, value: string) => {
    await fetch(`/api/hub/${location.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Data Integrations</h3>
        <p className="text-sm text-gray-500 mb-3">
          Connect your location&apos;s data sources. Each integration syncs automatically via Make.com once configured.
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Connected: <strong>{connectedCount}/{INTEGRATIONS.length}</strong></span>
          {latestSync?.completed_at && (
            <>
              <span className="text-gray-300">·</span>
              <span>Last sync: {formatDistanceToNow(new Date(latestSync.completed_at), { addSuffix: true })}</span>
            </>
          )}
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {INTEGRATIONS.map(config => {
          const sync = integrations.find((s: IntegrationSync) => s.source === config.type) || null
          return (
            <IntegrationCard
              key={config.type}
              config={config}
              sync={sync}
              location={location}
              onSaveAccountId={handleSaveAccountId}
            />
          )
        })}
      </div>
    </div>
  )
}
