'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import StepEditor from './StepEditor'
import StepTypeSelector, { STEP_TYPES } from './StepTypeSelector'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Step {
  id: string
  step_type: string
  step_config: Record<string, any>
  position: number
  delay_seconds: number
}

interface StepListProps {
  automationId: string
  steps: Step[]
  stages: { id: string; name: string; color: string }[]
  onRefresh: () => void
}

export default function StepList({ automationId, steps, stages, onRefresh }: StepListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [deletingStep, setDeletingStep] = useState<string | null>(null)

  const addStep = async (stepType: string) => {
    setShowSelector(false)
    const res = await fetch(`/api/automations/${automationId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_type: stepType, step_config: {} }),
    })
    if (res.ok) {
      const newStep = await res.json()
      setExpandedId(newStep.id)
      onRefresh()
    }
  }

  const saveStep = async (stepId: string, config: Record<string, any>, stepType: string) => {
    setSavingStep(stepId)
    await fetch(`/api/automations/${automationId}/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_config: config, step_type: stepType }),
    })
    setSavingStep(null)
    onRefresh()
  }

  const deleteStep = async (stepId: string) => {
    setDeletingStep(stepId)
    await fetch(`/api/automations/${automationId}/steps/${stepId}`, { method: 'DELETE' })
    setDeletingStep(null)
    if (expandedId === stepId) setExpandedId(null)
    onRefresh()
  }

  const reorder = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= steps.length) return

    const newSteps = [...steps]
    const [moved] = newSteps.splice(index, 1)
    newSteps.splice(swapIndex, 0, moved)

    const reordered = newSteps.map((s, i) => ({ id: s.id, position: i + 1 }))
    await fetch(`/api/automations/${automationId}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: reordered }),
    })
    onRefresh()
  }

  const getStepMeta = (type: string) => STEP_TYPES.find(t => t.type === type) || STEP_TYPES[0]

  return (
    <div className="space-y-3">
      {steps.length === 0 && !showSelector ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
          <p className="text-sm text-gray-500 mb-3">Add your first step to build the workflow.</p>
        </div>
      ) : (
        steps.map((step, index) => {
          const meta = getStepMeta(step.step_type)
          const Icon = meta.icon
          const isExpanded = expandedId === step.id
          return (
            <div key={step.id}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : step.id)}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                    {index + 1}
                  </span>
                  <Icon className={cn('w-4 h-4', meta.color.split(' ')[0])} />
                  <span className="text-sm font-medium text-gray-900 flex-1">{meta.label}</span>
                  {step.step_type === 'wait_delay' && step.step_config?.delay_amount && (
                    <span className="text-xs text-gray-400">
                      {step.step_config.delay_amount} {step.step_config.delay_unit || 'min'}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => reorder(index, -1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => reorder(index, 1)} disabled={index === steps.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteStep(step.id)} disabled={deletingStep === step.id} className="p-1 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-90')} />
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <StepEditor
                      stepType={step.step_type}
                      config={step.step_config || {}}
                      stages={stages}
                      saving={savingStep === step.id}
                      onSave={config => saveStep(step.id, config, step.step_type)}
                    />
                  </div>
                )}
              </div>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-6 bg-gray-300" />
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Add Step */}
      {showSelector ? (
        <StepTypeSelector onSelect={addStep} onCancel={() => setShowSelector(false)} />
      ) : (
        <button
          onClick={() => setShowSelector(true)}
          className="w-full py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-dashed border-blue-300 transition-colors"
        >
          + Add Step
        </button>
      )}
    </div>
  )
}
