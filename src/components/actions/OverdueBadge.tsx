'use client'

import { cn } from '@/lib/utils'

interface OverdueBadgeProps {
  overdueDays: number
  overdueLevel: string
}

export default function OverdueBadge({ overdueDays, overdueLevel }: OverdueBadgeProps) {
  if (overdueLevel === 'none') return null

  if (overdueLevel === 'due_today') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
        DUE TODAY
      </span>
    )
  }

  if (overdueLevel === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        OVERDUE 1 DAY
      </span>
    )
  }

  // critical
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800',
      'animate-pulse'
    )}>
      OVERDUE {overdueDays} DAYS
    </span>
  )
}
