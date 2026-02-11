'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Pause, Trash2, Save, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import AutomationForm from '@/components/automations/AutomationForm'
import TriggerConfig from '@/components/automations/TriggerConfig'
import StepList from '@/components/automations/StepList'
import EnrollmentList from '@/components/automations/EnrollmentList'

/* eslint-disable @typescript-eslint/no-explicit-any */

type TabId = 'details' | 'steps' | 'enrolled'

export default function EditAutomationPage({ params }: { params: Promise<{ locationId: string; automationId: string }> }) {
  const { locationId, automationId } = use(params)
  const router = useRouter()

  const [automation, setAutomation] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('steps')

  // Editable fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/automations/${automationId}`)
      .then(r => r.json())
      .then(d => {
        if (d.automation) {
          setAutomation(d.automation)
          setName(d.automation.name)
          setDescription(d.automation.description || '')
          setTriggerType(d.automation.trigger_type)
          setTriggerConfig(d.automation.trigger_config || {})
          setStages(d.stages || [])
          document.title = `${d.automation.name} | Automations`
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [automationId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveDetails = async () => {
    setSaving(true)
    setSaved(false)
    try {
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
      setSaved(true)
      fetchData()
      setTimeout(() => setSaved(false), 3000)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const toggleActive = async () => {
    await fetch(`/api/automations/${automationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !automation?.is_active }),
    })
    fetchData()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/automations/${automationId}`, { method: 'DELETE' })
    router.push(`/automations/${locationId}`)
  }

  const processNow = async () => {
    setProcessing(true)
    setProcessResult(null)
    try {
      const res = await fetch('/api/cron/process-automations', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-cron-secret'}` },
      })
      const data = await res.json()
      setProcessResult(`Processed ${data.processed || 0} enrollment(s). ${data.errors ? `Errors: ${data.errors}` : ''}`)
      fetchData()
    } catch {
      setProcessResult('Failed to process')
    }
    setProcessing(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-6 w-72 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!automation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Automation not found.</p>
        <Link href={`/automations/${locationId}`} className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
          Back to automations
        </Link>
      </div>
    )
  }

  const steps = automation.automation_steps || []
  const enrollments = automation.automation_enrollments || []
  const activeEnrollments = enrollments.filter((e: any) => e.status === 'active').length

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'steps', label: 'Steps', count: steps.length },
    { id: 'enrolled', label: 'Enrolled Leads', count: enrollments.length },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
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
            <p className="text-sm text-gray-500 mt-1">{automation.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {steps.length} step{steps.length !== 1 ? 's' : ''} · {activeEnrollments} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={processNow}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Process enrollments now"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', processing && 'animate-spin')} />
            Process Now
          </button>
          <button
            onClick={toggleActive}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              automation.is_active
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            )}
          >
            {automation.is_active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {processResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">{processResult}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'details' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Details</h3>
            <AutomationForm
              name={name}
              description={description}
              onChange={(f, v) => { if (f === 'name') setName(v); else setDescription(v); setSaved(false) }}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Trigger</h3>
            <TriggerConfig
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              stages={stages}
              onChange={(type, config) => { setTriggerType(type); setTriggerConfig(config); setSaved(false) }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDetails}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? <><Save className="w-4 h-4 animate-spin" /> Saving...</> :
               saved ? <><Check className="w-4 h-4" /> Saved!</> :
               <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
            {saved && <span className="text-sm text-emerald-600">Changes saved.</span>}
          </div>
        </div>
      )}

      {tab === 'steps' && (
        <StepList
          automationId={automationId}
          steps={steps}
          stages={stages}
          onRefresh={fetchData}
        />
      )}

      {tab === 'enrolled' && (
        <EnrollmentList
          automationId={automationId}
          locationId={locationId}
          totalSteps={steps.length}
        />
      )}
    </div>
  )
}
