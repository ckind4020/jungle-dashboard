'use client'

import {
  MessageSquare, Mail, Clock, ArrowRightLeft, Edit, Bell, Link, GitBranch
} from 'lucide-react'

const STEP_TYPES = [
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  { type: 'send_email', label: 'Send Email', icon: Mail, color: 'text-purple-600 bg-purple-50' },
  { type: 'wait_delay', label: 'Wait / Delay', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { type: 'change_stage', label: 'Change Stage', icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50' },
  { type: 'update_lead', label: 'Update Lead', icon: Edit, color: 'text-gray-600 bg-gray-50' },
  { type: 'notify_user', label: 'Send Notification', icon: Bell, color: 'text-orange-600 bg-orange-50' },
  { type: 'webhook', label: 'HTTP Webhook', icon: Link, color: 'text-indigo-600 bg-indigo-50' },
  { type: 'condition', label: 'If/Else Condition', icon: GitBranch, color: 'text-pink-600 bg-pink-50' },
] as const

interface StepTypeSelectorProps {
  onSelect: (type: string) => void
  onCancel: () => void
}

export function StepTypeSelector({ onSelect, onCancel }: StepTypeSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Choose a step type</h3>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {STEP_TYPES.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-center"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
