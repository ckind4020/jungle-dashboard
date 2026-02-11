'use client'

import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TriggerConfigProps {
  triggerType: string
  triggerConfig: Record<string, any>
  stages: { id: string; name: string; color: string }[]
  onChange: (type: string, config: Record<string, any>) => void
}

const TRIGGERS = [
  { type: 'lead_created', label: 'New Lead Created', desc: 'Fires when a lead is added to this location' },
  { type: 'stage_changed', label: 'Stage Changed', desc: 'Fires when a lead moves to a specific stage' },
  { type: 'manual', label: 'Manual Enrollment', desc: 'No trigger — you\'ll enroll leads manually' },
]

export default function TriggerConfig({ triggerType, triggerConfig, stages, onChange }: TriggerConfigProps) {
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">When should this automation start?</p>
      {TRIGGERS.map(t => (
        <div key={t.type}>
          <label
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              triggerType === t.type
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <input
              type="radio"
              name="trigger_type"
              checked={triggerType === t.type}
              onChange={() => onChange(t.type, {})}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">{t.label}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>

              {/* Config fields for each trigger type */}
              {triggerType === t.type && t.type === 'lead_created' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source filter (optional)</label>
                  <select
                    className={inputClass}
                    value={triggerConfig.source_filter || 'any'}
                    onChange={e => onChange(t.type, { ...triggerConfig, source_filter: e.target.value })}
                  >
                    <option value="any">Any source</option>
                    <option value="manual_entry">Manual Entry</option>
                    <option value="website">Website</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="referral">Referral</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
              )}

              {triggerType === t.type && t.type === 'stage_changed' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From stage (optional)</label>
                    <select
                      className={inputClass}
                      value={triggerConfig.from_stage_id || ''}
                      onChange={e => onChange(t.type, { ...triggerConfig, from_stage_id: e.target.value || null })}
                    >
                      <option value="">Any stage</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To stage *</label>
                    <select
                      className={inputClass}
                      value={triggerConfig.to_stage_id || ''}
                      onChange={e => onChange(t.type, { ...triggerConfig, to_stage_id: e.target.value })}
                    >
                      <option value="">Select stage...</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
      ))}
    </div>
  )
}
