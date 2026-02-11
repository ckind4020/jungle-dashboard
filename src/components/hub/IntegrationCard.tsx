'use client'

import { useState } from 'react'
import { IntegrationConfig, IntegrationSync, LocationProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Search, Megaphone, Phone, MapPin, Car, Workflow, Check, AlertTriangle, Save, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Megaphone, Phone, MapPin, Car, Workflow,
}

const COLOR_MAP: Record<string, { border: string; badge: string; badgeText: string; iconBg: string }> = {
  blue:    { border: 'border-l-4 border-blue-500',    badge: 'bg-blue-100 text-blue-800',       badgeText: 'text-blue-800',    iconBg: 'bg-blue-50 text-blue-600' },
  indigo:  { border: 'border-l-4 border-indigo-500',  badge: 'bg-indigo-100 text-indigo-800',   badgeText: 'text-indigo-800',  iconBg: 'bg-indigo-50 text-indigo-600' },
  emerald: { border: 'border-l-4 border-emerald-500', badge: 'bg-emerald-100 text-emerald-800', badgeText: 'text-emerald-800', iconBg: 'bg-emerald-50 text-emerald-600' },
  red:     { border: 'border-l-4 border-red-500',     badge: 'bg-red-100 text-red-800',         badgeText: 'text-red-800',     iconBg: 'bg-red-50 text-red-600' },
  amber:   { border: 'border-l-4 border-amber-500',   badge: 'bg-amber-100 text-amber-800',     badgeText: 'text-amber-800',   iconBg: 'bg-amber-50 text-amber-600' },
  purple:  { border: 'border-l-4 border-purple-500',  badge: 'bg-purple-100 text-purple-800',   badgeText: 'text-purple-800',  iconBg: 'bg-purple-50 text-purple-600' },
}

interface IntegrationCardProps {
  config: IntegrationConfig
  sync: IntegrationSync | null
  location: LocationProfile
  onSaveAccountId: (field: keyof LocationProfile, value: string) => Promise<void>
}

export default function IntegrationCard({ config, sync, location, onSaveAccountId }: IntegrationCardProps) {
  const accountId = location[config.accountIdField] as string | null
  const isConnected = !!accountId
  const hasError = sync?.status === 'error'

  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(accountId || '')
  const [saving, setSaving] = useState(false)

  const Icon = ICON_MAP[config.icon] || Search
  const colors = COLOR_MAP[config.color] || COLOR_MAP.blue

  const handleSave = async () => {
    setSaving(true)
    await onSaveAccountId(config.accountIdField, inputValue)
    setSaving(false)
    setEditing(false)
  }

  const borderClass = isConnected
    ? hasError ? 'border-l-4 border-amber-500' : colors.border
    : 'border-l-4 border-gray-300'

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden', borderClass)}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors.iconBg)}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{config.label}</h3>
          </div>
          {isConnected ? (
            hasError ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                <AlertTriangle className="w-3 h-3" /> Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                <Check className="w-3 h-3" /> Connected
              </span>
            )
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Not Connected
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-4">{config.description}</p>

        {/* Connected state */}
        {isConnected && !editing && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Account ID:</span>
              <span className="font-mono text-gray-700">{accountId}</span>
            </div>
            {sync && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Last Sync:</span>
                  <span className="text-gray-700">
                    {sync.completed_at
                      ? formatDistanceToNow(new Date(sync.completed_at), { addSuffix: true })
                      : 'Never'}
                    {sync.records_synced > 0 && ` · ${sync.records_synced} records`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status:</span>
                  {sync.status === 'success' ? (
                    <span className="text-emerald-600 font-medium">Success</span>
                  ) : sync.status === 'error' ? (
                    <span className="text-red-600 font-medium">Error</span>
                  ) : (
                    <span className="text-gray-600 font-medium capitalize">{sync.status}</span>
                  )}
                </div>
              </>
            )}
            {hasError && sync?.error_message && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">{sync.error_message}</p>
              </div>
            )}
          </div>
        )}

        {/* Edit / Connect mode */}
        {(editing || !isConnected) && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {isConnected ? 'Update Account ID' : 'Enter Account ID to connect'}
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="e.g. 123-456-7890"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !inputValue.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : isConnected ? 'Save' : 'Connect'}
              </button>
              {isConnected && (
                <button
                  onClick={() => { setEditing(false); setInputValue(accountId || '') }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions for connected state */}
        {isConnected && !editing && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Edit Account ID
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
