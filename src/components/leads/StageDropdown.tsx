'use client'

import { LeadStage } from '@/lib/types'

interface StageDropdownProps {
  stages: LeadStage[]
  currentStageId: string | null
  onChange: (stageId: string) => void
}

export default function StageDropdown({ stages, currentStageId, onChange }: StageDropdownProps) {
  return (
    <select
      value={currentStageId || ''}
      onChange={e => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: stages.find(s => s.id === currentStageId)?.color || '#d1d5db',
      }}
    >
      {stages.map(stage => (
        <option key={stage.id} value={stage.id}>
          {stage.name}
        </option>
      ))}
    </select>
  )
}
