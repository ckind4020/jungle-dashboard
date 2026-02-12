'use client'

import Link from 'next/link'
import { HubData, IntegrationSync } from '@/lib/types'
import { INTEGRATIONS } from '@/lib/integrations'
import { formatNumber, formatPercent, cn } from '@/lib/utils'
import { Users, Car, BookOpen, Inbox, Star, ShieldCheck, Zap, BarChart3, Megaphone, Trophy, Settings, Workflow } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface OverviewTabProps {
  data: HubData
  onSwitchTab: (tab: string) => void
}

export default function OverviewTab({ data, onSwitchTab }: OverviewTabProps) {
  const { quick_stats, action_items_count, integrations, location } = data

  const statCards = [
    { label: 'Active Students', value: formatNumber(quick_stats.active_students), icon: Users, warning: false },
    { label: 'Drives Remaining', value: formatNumber(quick_stats.outstanding_drives), icon: Car, warning: false },
    { label: 'Classes Active', value: formatNumber(quick_stats.upcoming_classes), icon: BookOpen, warning: false },
    { label: 'Open Leads', value: formatNumber(quick_stats.open_leads), icon: Inbox, warning: false },
    { label: 'Unreplied Reviews', value: formatNumber(quick_stats.unreplied_reviews), icon: Star, warning: quick_stats.unreplied_reviews > 0 },
    { label: 'Compliance Score', value: formatPercent(quick_stats.compliance_score), icon: ShieldCheck, warning: quick_stats.compliance_score < 90 },
  ]

  const quickLinks = [
    { label: 'Marketing Dashboard', subtitle: 'Leads, ads, calls, reviews', icon: BarChart3, href: `/dashboard/${location.id}`, enabled: true },
    { label: 'Action Items', subtitle: 'See what needs doing', icon: Zap, href: `/actions?location_id=${location.id}`, enabled: true },
    { label: 'Lead Pipeline', subtitle: 'Manage incoming leads and follow-ups', icon: Inbox, href: `/leads/${location.id}`, enabled: true },
    { label: 'Automations', subtitle: 'SMS & email sequences', icon: Workflow, href: `/automations/${location.id}`, enabled: true },
    { label: 'Compliance', subtitle: 'Track certifications and renewals', icon: ShieldCheck, href: '/compliance', enabled: true },
    { label: 'Marketing', subtitle: 'Ad performance and GBP analytics', icon: Megaphone, href: '/marketing', enabled: true },
    { label: 'Network Rankings', subtitle: 'See how you compare', icon: Trophy, href: '/ranker', enabled: true },
  ]

  // Integration status strip
  const getIntegrationStatus = (source: string): 'connected' | 'error' | 'disconnected' => {
    const config = INTEGRATIONS.find(i => i.type === source)
    if (!config) return 'disconnected'
    const accountId = location[config.accountIdField]
    if (!accountId) return 'disconnected'
    const sync = integrations.find((s: IntegrationSync) => s.source === source)
    if (sync?.status === 'error') return 'error'
    return 'connected'
  }

  const latestSync = integrations
    .filter((s: IntegrationSync) => s.completed_at)
    .sort((a: IntegrationSync, b: IntegrationSync) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={cn(
                'bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow',
                card.warning ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">{card.label}</p>
                <Icon className={cn('w-4 h-4', card.warning ? 'text-amber-500' : 'text-gray-400')} />
              </div>
              <p className={cn('text-xl font-bold', card.warning ? 'text-amber-700' : 'text-gray-900')}>
                {card.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Action Items Alert */}
      {action_items_count.total > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              {action_items_count.total} action item{action_items_count.total !== 1 ? 's' : ''} need attention
            </h3>
          </div>
          <div className="flex items-center gap-4 flex-wrap mb-4">
            {action_items_count.critical > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="font-medium text-gray-700">{action_items_count.critical} Critical</span>
              </span>
            )}
            {action_items_count.high > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="font-medium text-gray-700">{action_items_count.high} High</span>
              </span>
            )}
            {action_items_count.medium > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="font-medium text-gray-700">{action_items_count.medium} Medium</span>
              </span>
            )}
            {action_items_count.low > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-gray-700">{action_items_count.low} Low</span>
              </span>
            )}
          </div>
          <Link
            href={`/actions?location_id=${location.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View All Action Items &rarr;
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map(link => {
          const Icon = link.icon
          if (!link.enabled) {
            return (
              <div
                key={link.label}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{link.label}</h3>
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Coming Soon</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{link.subtitle}</p>
                  </div>
                </div>
              </div>
            )
          }
          return (
            <Link
              key={link.label}
              href={link.href}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{link.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{link.subtitle}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Integration Status Strip */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Data Connections</h3>
          <button
            onClick={() => onSwitchTab('integrations')}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" /> Manage &rarr;
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {INTEGRATIONS.map(integration => {
            const status = getIntegrationStatus(integration.type)
            return (
              <div key={integration.type} className="flex items-center gap-1.5">
                <span className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  status === 'connected' ? 'bg-emerald-500' :
                  status === 'error' ? 'bg-amber-500' :
                  'bg-gray-300'
                )} />
                <span className="text-sm text-gray-600">{integration.label}</span>
              </div>
            )
          })}
        </div>
        {latestSync?.completed_at && (
          <p className="text-xs text-gray-400 mt-3">
            Last sync: {formatDistanceToNow(new Date(latestSync.completed_at), { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  )
}
