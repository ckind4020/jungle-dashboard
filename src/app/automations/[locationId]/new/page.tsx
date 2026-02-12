'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { AutomationForm } from '@/components/automations/AutomationForm'
import { TriggerConfig } from '@/components/automations/TriggerConfig'
import { PageHeader } from '@/components/layout/PageHeader'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function CreateAutomationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})
  const [stages, setStages] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [locationName, setLocationName] = useState('')

  useEffect(() => {
    fetch(`/api/hub/${locationId}`)
      .then(r => r.json())
      .then(d => { if (d.location?.name) setLocationName(d.location.name) })
      .catch(() => {})

    fetch(`/api/leads?location_id=${locationId}&limit=1`)
      .then(r => r.json())
      .then(d => { if (d.stages) setStages(d.stages) })
      .catch(() => {})
  }, [locationId])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          name: name.trim(),
          description: description.trim() || null,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/automations/${locationId}/${data.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/automations/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Automations
      </Link>

      <div className="flex items-center justify-between">
        <PageHeader title="Create Automation" />
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
      </div>

      {/* Details Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Details</h2>
        <AutomationForm
          name={name}
          description={description}
          onChangeName={setName}
          onChangeDescription={setDescription}
        />
      </div>

      {/* Trigger Section */}
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

      {/* Steps Section (empty for create page) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Steps</h2>
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">Save your automation first, then add steps on the edit page.</p>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={`/automations/${locationId}`}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save & Continue Editing'}
        </button>
      </div>
    </div>
  )
}
