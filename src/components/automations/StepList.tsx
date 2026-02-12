'use client'

import { useState } from 'react'
import {
  MessageSquare, Mail, Clock, ArrowRightLeft, Edit, Bell, Link, GitBranch,
  ChevronUp, ChevronDown, X, Save, GripVertical
} from 'lucide-react'
import { StepEditor } from './StepEditor'
import { StepTypeSelector } from './StepTypeSelector'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

const STEP_META: Record<string, { label: string; icon: any; color: string }> = {
  send_sms: { label: 'Send SMS', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  send_email: { label: 'Send Email', icon: Mail, color: 'text-purple-600 bg-purple-50' },
  wait_delay: { label: 'Wait / Delay', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  change_stage: { label: 'Change Stage', icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50' },
  update_lead: { label: 'Update Lead', icon: Edit, color: 'text-gray-600 bg-gray-100' },
  notify_user: { label: 'Send Notification', icon: Bell, color: 'text-orange-600 bg-orange-50' },
  webhook: { label: 'HTTP Webhook', icon: Link, color: 'text-indigo-600 bg-indigo-50' },
  condition: { label: 'If/Else Condition', icon: GitBranch, color: 'text-pink-600 bg-pink-50' },
}

interface Step {
  id: string
  step_type: string
  step_config: Record<string, any>
  position: number
  delay_seconds: number
}

interface LeadStage {
  id: string
  name: string
  color: string
  position: number
}

interface StepListProps {
  automationId: string
  steps: Step[]
  stages: LeadStage[]
  onRefresh: () => void
}

export function StepList({ automationId, steps, stages, onRefresh }: StepListProps) {
  const [showSelector, setShowSelector] = useState(false)
  const [editingConfig, setEditingConfig] = useState<Record<string, Record<string, any>>>({})
  const [savingStep, setSavingStep] = useState<string | null>(null)

  const addStep = async (stepType: string) => {
    setShowSelector(false)
    const res = await fetch(`/api/automations/${automationId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_type: stepType, step_config: {} }),
    })
    if (res.ok) onRefresh()
  }

  const deleteStep = async (stepId: string) => {
    const res = await fetch(`/api/automations/${automationId}/steps/${stepId}`, { method: 'DELETE' })
    if (res.ok) onRefresh()
  }

  const saveStep = async (step: Step) => {
    setSavingStep(step.id)
    const config = editingConfig[step.id] || step.step_config
    await fetch(`/api/automations/${automationId}/steps/${step.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_type: step.step_type, step_config: config }),
    })
    setSavingStep(null)
    setEditingConfig(prev => {
      const next = { ...prev }
      delete next[step.id]
      return next
    })
    onRefresh()
  }

  const reorder = async (stepId: string, direction: 'up' | 'down') => {
    const idx = steps.findIndex(s => s.id === stepId)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === steps.length - 1)) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newSteps = steps.map((s, i) => {
      if (i === idx) return { id: s.id, position: steps[swapIdx].position }
      if (i === swapIdx) return { id: s.id, position: steps[idx].position }
      return { id: s.id, position: s.position }
    })

    await fetch(`/api/automations/${automationId}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: newSteps }),
    })
    onRefresh()
  }

  return (
    <div className="space-y-0">
      {steps.length === 0 && !showSelector && (
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">Add your first step to build the workflow.</p>
        </div>
      )}

      {steps.map((step, idx) => {
        const meta = STEP_META[step.step_type] || { label: step.step_type, icon: Edit, color: 'text-gray-600 bg-gray-100' }
        const Icon = meta.icon
        const currentConfig = editingConfig[step.id] || step.step_config
        const hasEdits = !!editingConfig[step.id]

        return (
          <div key={step.id}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', meta.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium">Step {idx + 1}</span>
                    <h4 className="text-sm font-semibold text-gray-900">{meta.label}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => reorder(step.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => reorder(step.id, 'down')}
                    disabled={idx === steps.length - 1}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteStep(step.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <StepEditor
                stepType={step.step_type}
                config={currentConfig}
                stages={stages}
                totalSteps={steps.length}
                onChange={newConfig => setEditingConfig(prev => ({ ...prev, [step.id]: newConfig }))}
              />

              <div className="flex justify-end mt-3">
                <button
                  onClick={() => saveStep(step)}
                  disabled={savingStep === step.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    hasEdits
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingStep === step.id ? 'Saving...' : 'Save Step'}
                </button>
              </div>
            </div>

            {/* Connector */}
            {idx < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-px h-6 bg-gray-300" />
              </div>
            )}
          </div>
        )
      })}

      {/* Add Step */}
      {steps.length > 0 && !showSelector && (
        <div className="flex justify-center py-1">
          <div className="w-px h-4 bg-gray-300" />
        </div>
      )}

      {showSelector ? (
        <StepTypeSelector onSelect={addStep} onCancel={() => setShowSelector(false)} />
      ) : (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowSelector(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          >
            + Add Step
          </button>
        </div>
      )}
    </div>
  )
}
