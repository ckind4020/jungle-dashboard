'use client'

import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  current: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expiring_soon: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200',
  in_maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_use: 'bg-blue-50 text-blue-700 border-blue-200',
  withdrawn: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  current: 'Current',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
  in_maintenance: 'In Maintenance',
  available: 'Available',
  in_use: 'In Use',
  withdrawn: 'Withdrawn',
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-50 text-gray-700 border-gray-200'
  const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      style,
      className
    )}>
      {label}
    </span>
  )
}
