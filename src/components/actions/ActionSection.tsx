'use client'

import { cn } from '@/lib/utils'
import ActionItemCard, { ActionItemData } from './ActionItemCard'

interface ActionSectionProps {
  title: string
  icon: string
  count: number
  items: ActionItemData[]
  onAction: (id: string, action: string) => void
  defaultCollapsed?: boolean
}

export default function ActionSection({
  title,
  icon,
  count,
  items,
  onAction,
  defaultCollapsed = false,
}: ActionSectionProps) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{icon}</span>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {title} ({count})
        </h2>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <ActionItemCard key={item.id} item={item} onAction={onAction} />
        ))}
      </div>
    </div>
  )
}
