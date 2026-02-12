'use client'

import { TrendingUp, TrendingDown, Users, DollarSign, Target, Phone, Star, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface KpiCardProps {
  label: string
  value: string | number
  subtext?: string
  trend?: 'up' | 'down' | 'flat' | null
  icon?: React.ReactNode
  invertTrend?: boolean
  warning?: boolean
}

function KpiCard({ label, value, subtext, trend, icon, invertTrend, warning }: KpiCardProps) {
  const trendColor = trend === null || trend === undefined ? 'text-gray-500' :
    trend === 'flat' ? 'text-gray-500' :
    (trend === 'up' && !invertTrend) || (trend === 'down' && invertTrend) ? 'text-green-600' : 'text-red-600'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null

  return (
    <div className={cn(
      'bg-white rounded-xl shadow-sm border p-5',
      warning ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={cn('text-3xl font-bold', warning ? 'text-red-700' : 'text-gray-900')}>
        {value === null || value === undefined ? '—' : value}
      </p>
      {subtext && (
        <div className={cn('flex items-center gap-1 mt-1', trendColor)}>
          {TrendIcon && <TrendIcon className="w-3.5 h-3.5" />}
          <span className="text-xs font-medium">{subtext}</span>
        </div>
      )}
    </div>
  )
}

interface KpiCardsProps {
  summary: any
}

export function KpiCards({ summary }: KpiCardsProps) {
  const leadTrend = summary.lead_change_pct
    ? parseFloat(summary.lead_change_pct) > 0 ? 'up' : parseFloat(summary.lead_change_pct) < 0 ? 'down' : 'flat'
    : null

  const answerRate = parseFloat(summary.call_answer_rate || '0')

  const cards: KpiCardProps[] = [
    {
      label: 'New Leads',
      value: summary.total_leads ?? 0,
      subtext: summary.lead_change_pct ? `${parseFloat(summary.lead_change_pct) > 0 ? '+' : ''}${summary.lead_change_pct}% vs prev period` : undefined,
      trend: leadTrend,
      icon: <Users className="w-4 h-4 text-blue-500" />,
    },
    {
      label: 'Ad Spend',
      value: summary.total_ad_spend > 0 ? `$${summary.total_ad_spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0',
      icon: <DollarSign className="w-4 h-4 text-gray-400" />,
    },
    {
      label: 'Cost Per Lead',
      value: summary.overall_cpl != null ? `$${Number(summary.overall_cpl).toFixed(2)}` : '—',
      invertTrend: true,
      icon: <Target className="w-4 h-4 text-amber-500" />,
    },
    {
      label: 'Total Calls',
      value: summary.total_calls ?? 0,
      subtext: summary.total_calls > 0 ? `${summary.call_answer_rate}% answered` : undefined,
      trend: answerRate >= 90 ? 'up' : answerRate >= 75 ? 'flat' : answerRate > 0 ? 'down' : null,
      icon: <Phone className="w-4 h-4 text-emerald-500" />,
    },
    {
      label: 'GBP Rating',
      value: summary.gbp_rating != null ? `${Number(summary.gbp_rating).toFixed(1)}` : '—',
      subtext: summary.gbp_total_reviews > 0 ? `${summary.gbp_total_reviews} reviews` : undefined,
      icon: <Star className="w-4 h-4 text-yellow-500" />,
    },
    {
      label: 'Unreplied Reviews',
      value: summary.unreplied_reviews ?? 0,
      warning: (summary.unreplied_reviews || 0) > 0,
      icon: <MessageSquare className="w-4 h-4 text-gray-400" />,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(card => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  )
}
