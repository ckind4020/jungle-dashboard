'use client'

import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LeadStage {
  id: string
  name: string
  color: string
  position: number
}

interface TriggerConfigProps {
  triggerType: string
  triggerConfig: Record<string, any>
  stages: LeadStage[]
  onChangeTriggerType: (type: string) => void
  onChangeTriggerConfig: (config: Record<string, any>) => void
}

const TRIGGER_TYPES = [
  {
    value: 'lead_created',
    label: 'New Lead Created',
    description: 'Fires when a lead is added to this location',
  },
  {
    value: 'stage_changed',
    label: 'Stage Changed',
    description: 'Fires when a lead moves to a specific stage',
  },
  {
    value: 'manual',
    label: 'Manual Enrollment',
    description: "No trigger — you'll enroll leads manually",
  },
]

export function TriggerConfig({ triggerType, triggerConfig, stages, onChangeTriggerType, onChangeTriggerConfig }: TriggerConfigProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 mb-2">When should this automation start?</p>
      {TRIGGER_TYPES.map(t => (
        <div key={t.value}>
          <label className={cn(
            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            triggerType === t.value ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
          )}>
            <input
              type="radio"
              name="trigger_type"
              value={t.value}
              checked={triggerType === t.value}
              onChange={() => onChangeTriggerType(t.value)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">{t.label}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>

              {/* Extra config fields */}
              {triggerType === t.value && t.value === 'lead_created' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source filter (optional)</label>
                  <select
                    value={triggerConfig.source_filter || 'any'}
                    onChange={e => onChangeTriggerConfig({ ...triggerConfig, source_filter: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="any">Any source</option>
                    <option value="website">Website</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="referral">Referral</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="facebook_ads">Facebook Ads</option>
                    <option value="manual_entry">Manual Entry</option>
                  </select>
                </div>
              )}

              {triggerType === t.value && t.value === 'stage_changed' && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From stage (optional)</label>
                    <select
                      value={triggerConfig.from_stage_id || ''}
                      onChange={e => onChangeTriggerConfig({ ...triggerConfig, from_stage_id: e.target.value || undefined })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Any stage</option>
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To stage (required)</label>
                    <select
                      value={triggerConfig.to_stage_id || ''}
                      onChange={e => onChangeTriggerConfig({ ...triggerConfig, to_stage_id: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select stage...</option>
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
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
