'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Pause, Trash2, Save, RefreshCw } from 'lucide-react'
import { AutomationForm } from '@/components/automations/AutomationForm'
import { TriggerConfig } from '@/components/automations/TriggerConfig'
import { StepList } from '@/components/automations/StepList'
import { EnrollmentList } from '@/components/automations/EnrollmentList'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tab = 'details' | 'steps' | 'enrollments'

export default function EditAutomationPage({ params }: { params: Promise<{ locationId: string; automationId: string }> }) {
  const { locationId, automationId } = use(params)
  const router = useRouter()

  const [automation, setAutomation] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('steps')

  // Editable state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  const fetchAutomation = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/automations/${automationId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setAutomation(data.automation)
        setStages(data.stages || [])
        setName(data.automation.name)
        setDescription(data.automation.description || '')
        setTriggerType(data.automation.trigger_type)
        setTriggerConfig(data.automation.trigger_config || {})
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [automationId])

  useEffect(() => { fetchAutomation() }, [fetchAutomation])

  const saveDetails = async () => {
    setSaving(true)
    await fetch(`/api/automations/${automationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
      }),
    })
    setSaving(false)
    fetchAutomation()
  }

  const toggleActive = async () => {
    await fetch(`/api/automations/${automationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !automation.is_active }),
    })
    fetchAutomation()
  }

  const deleteAutomation = async () => {
    setDeleting(true)
    const res = await fetch(`/api/automations/${automationId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(`/automations/${locationId}`)
    }
    setDeleting(false)
  }

  const processNow = async () => {
    setProcessing(true)
    try {
      await fetch('/api/cron/process-automations', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-secret'}` },
      })
    } catch {}
    setProcessing(false)
    fetchAutomation()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-72 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error || !automation) {
    return (
      <div className="space-y-6">
        <PageHeader title="Automation" />
        <ErrorState message="Could not load automation." onRetry={fetchAutomation} />
      </div>
    )
  }

  const steps = automation.automation_steps || []
  const enrollments = automation.automation_enrollments || []
  const activeEnrollments = enrollments.filter((e: any) => e.status === 'active').length

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'steps', label: `Steps (${steps.length})` },
    { key: 'enrollments', label: `Enrolled Leads (${enrollments.length})` },
  ]

  return (
    <div className="space-y-6">
      <Link href={`/automations/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Automations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{automation.name}</h1>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              automation.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
            )}>
              {automation.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {automation.description && (
            <p className="text-sm text-gray-500 mt-1">
              {automation.description} · {steps.length} step{steps.length !== 1 ? 's' : ''} · {enrollments.length} enrolled
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={processNow}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', processing && 'animate-spin')} />
            Process Now
          </button>
          <button
            onClick={toggleActive}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              automation.is_active
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            )}
          >
            {automation.is_active ? <><Pause className="w-3.5 h-3.5" /> Deactivate</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Details</h2>
            <AutomationForm
              name={name}
              description={description}
              onChangeName={setName}
              onChangeDescription={setDescription}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Trigger</h2>
            <TriggerConfig
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              stages={stages}
              onChangeTriggerType={setTriggerType}
              onChangeTriggerConfig={setTriggerConfig}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveDetails}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'steps' && (
        <StepList
          automationId={automationId}
          steps={steps}
          stages={stages}
          onRefresh={fetchAutomation}
        />
      )}

      {activeTab === 'enrollments' && (
        <EnrollmentList
          automationId={automationId}
          locationId={locationId}
          totalSteps={steps.length}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Automation?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete &ldquo;{automation.name}&rdquo; and all its steps, enrollments, and logs. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAutomation}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
