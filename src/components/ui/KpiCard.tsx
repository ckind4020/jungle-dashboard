'use client'

import { cn, getScoreColor } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  icon: LucideIcon
  subtitle?: string
  score?: number
  thresholds?: { green: number; yellow: number }
}

export default function KpiCard({ title, value, icon: Icon, subtitle, score, thresholds }: KpiCardProps) {
  const valueColor = score !== undefined && thresholds
    ? getScoreColor(score, thresholds)
    : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className={cn('text-2xl font-bold', valueColor)}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}
