'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import AutomationForm from '@/components/automations/AutomationForm'
import TriggerConfig from '@/components/automations/TriggerConfig'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function NewAutomationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})
  const [stages, setStages] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [locationName, setLocationName] = useState('')

  useEffect(() => {
    document.title = 'New Automation | Jungle Driving School'
    fetch(`/api/hub/${locationId}`)
      .then(r => r.json())
      .then(d => {
        if (d.location?.name) setLocationName(d.location.name)
      })
      .catch(() => {})

    // Fetch stages for trigger config
    fetch(`/api/leads?location_id=${locationId}&limit=1`)
      .then(r => r.json())
      .then(d => setStages(d.stages || []))
      .catch(() => {})
  }, [locationId])

  const handleSave = async () => {
    if (!name.trim()) { setError('Automation name is required.'); return }
    setSaving(true)
    setError('')

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

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create automation')
        setSaving(false)
        return
      }

      const automation = await res.json()
      router.push(`/automations/${locationId}/${automation.id}`)
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href={`/automations/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Automations{locationName && ` — ${locationName}`}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Create Automation</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Draft'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Details</h3>
        <AutomationForm
          name={name}
          description={description}
          onChange={(f, v) => { if (f === 'name') setName(v); else setDescription(v) }}
        />
      </div>

      {/* Trigger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Trigger</h3>
        <TriggerConfig
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          stages={stages}
          onChange={(type, config) => { setTriggerType(type); setTriggerConfig(config) }}
        />
      </div>

      {/* Steps placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Steps</h3>
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">Save the automation first, then add steps on the edit page.</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href={`/automations/${locationId}`} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save & Continue Editing'}
        </button>
      </div>
    </div>
  )
}
