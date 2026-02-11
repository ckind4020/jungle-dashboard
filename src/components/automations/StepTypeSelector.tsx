'use client'

import { MessageSquare, Mail, Clock, ArrowRightLeft, Edit, Bell, Link, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepTypeOption {
  type: string
  label: string
  icon: typeof MessageSquare
  color: string
}

export const STEP_TYPES: StepTypeOption[] = [
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { type: 'send_email', label: 'Send Email', icon: Mail, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { type: 'wait_delay', label: 'Wait / Delay', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { type: 'change_stage', label: 'Change Stage', icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { type: 'update_lead', label: 'Update Lead', icon: Edit, color: 'text-gray-600 bg-gray-50 border-gray-200' },
  { type: 'notify_user', label: 'Send Notification', icon: Bell, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { type: 'webhook', label: 'HTTP Webhook', icon: Link, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { type: 'condition', label: 'If/Else Condition', icon: GitBranch, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
]

interface StepTypeSelectorProps {
  onSelect: (type: string) => void
  onCancel: () => void
}

export default function StepTypeSelector({ onSelect, onCancel }: StepTypeSelectorProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Choose a step type</h4>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {STEP_TYPES.map(st => {
          const Icon = st.icon
          return (
            <button
              key={st.type}
              onClick={() => onSelect(st.type)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-[1.02] cursor-pointer',
                st.color
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium text-center">{st.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
