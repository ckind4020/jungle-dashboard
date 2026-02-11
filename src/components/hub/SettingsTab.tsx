'use client'

import { useState } from 'react'
import { HubData, FranchiseOwner } from '@/lib/types'
import { Save, Check, Plus, X } from 'lucide-react'
import DynamicFieldRenderer from './DynamicFieldRenderer'

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
]

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hours = Math.floor(i / 2) + 6
  const minutes = i % 2 === 0 ? '00' : '30'
  const h = hours.toString().padStart(2, '0')
  return `${h}:${minutes}`
})

const FRANCHISE_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'basecamp', label: 'Basecamp' },
  { value: 'deep_jungle', label: 'Deep Jungle' },
  { value: 'live', label: 'Live' },
]

interface SettingsTabProps {
  data: HubData
  onRefresh: () => void
}

export default function SettingsTab({ data, onRefresh }: SettingsTabProps) {
  const { location, field_definitions, field_values } = data

  // Core location fields
  const [form, setForm] = useState({
    name: location.name || '',
    address_line1: location.address_line1 || '',
    address_line2: location.address_line2 || '',
    city: location.city || '',
    state: location.state || '',
    zip_code: location.zip_code || '',
    phone: location.phone || '',
    email: location.email || '',
    timezone: location.timezone || 'America/Chicago',
    opened_date: location.opened_date || '',
    manager_name: location.manager_name || '',
    manager_email: location.manager_email || '',
    manager_phone: location.manager_phone || '',
    notes: location.notes || '',
    // Franchise core fields
    location_number: location.location_number || '',
    franchise_status: location.franchise_status || 'open',
    sign_date: location.sign_date || '',
    go_live_date: location.go_live_date || '',
    expedition_date: location.expedition_date || '',
    franchise_operator_name: location.franchise_operator_name || '',
    franchise_operator_phone: location.franchise_operator_phone || '',
    franchise_operator_email: location.franchise_operator_email || '',
    assigned_support_partner: location.assigned_support_partner || '',
    location_url: location.location_url || '',
  })

  // Franchise owners (JSONB array)
  const [owners, setOwners] = useState<FranchiseOwner[]>(
    Array.isArray(location.franchise_owners) && location.franchise_owners.length > 0
      ? location.franchise_owners
      : []
  )

  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>(() => {
    const defaultHours: Record<string, { open: string; close: string } | null> = {}
    for (const day of DAYS) {
      defaultHours[day] = location.business_hours?.[day] ?? null
    }
    return defaultHours
  })

  // Custom field values: { [fieldId]: { value, valueJson } }
  const [customFields, setCustomFields] = useState<Record<string, { value: string | null; valueJson: any }>>(() => {
    const map: Record<string, { value: string | null; valueJson: any }> = {}
    for (const fv of (field_values || [])) {
      map[fv.field_id] = { value: fv.value, valueJson: fv.value_json }
    }
    return map
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleHoursToggle = (day: string, isOpen: boolean) => {
    setHours(prev => ({
      ...prev,
      [day]: isOpen ? { open: '08:00', close: '18:00' } : null,
    }))
    setSaved(false)
  }

  const handleHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day]!, [field]: value } : { open: '08:00', close: '18:00', [field]: value },
    }))
    setSaved(false)
  }

  const handleOwnerChange = (index: number, field: keyof FranchiseOwner, value: string) => {
    setOwners(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setSaved(false)
  }

  const addOwner = () => {
    setOwners(prev => [...prev, { name: '', phone: '', email: '' }])
    setSaved(false)
  }

  const removeOwner = (index: number) => {
    setOwners(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  const handleCustomFieldChange = (fieldId: string, value: string | null, valueJson?: any) => {
    setCustomFields(prev => ({
      ...prev,
      [fieldId]: { value, valueJson: valueJson ?? null },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build custom_fields payload: { fieldId: value_or_json }
      const customPayload: Record<string, any> = {}
      for (const [fieldId, { value, valueJson }] of Object.entries(customFields)) {
        customPayload[fieldId] = valueJson !== null && valueJson !== undefined ? valueJson : (value ?? '')
      }

      const res = await fetch(`/api/hub/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          business_hours: hours,
          franchise_owners: owners,
          custom_fields: customPayload,
        }),
      })
      if (res.ok) {
        setSaved(true)
        onRefresh()
        setTimeout(() => setSaved(false), 3000)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  // Group custom fields
  const groupedFields = (field_definitions || []).reduce<Record<string, typeof field_definitions>>((acc, f) => {
    const g = f.field_group || 'General'
    if (!acc[g]) acc[g] = []
    acc[g].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Franchise Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Franchise Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Location Number</label>
            <input type="text" className={inputClass} value={form.location_number} onChange={e => handleChange('location_number', e.target.value)} placeholder="JUNGLE-118" />
          </div>
          <div>
            <label className={labelClass}>Franchise Status</label>
            <select className={inputClass} value={form.franchise_status} onChange={e => handleChange('franchise_status', e.target.value)}>
              {FRANCHISE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sign Date</label>
            <input type="date" className={inputClass} value={form.sign_date} onChange={e => handleChange('sign_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Go-Live Date</label>
            <input type="date" className={inputClass} value={form.go_live_date} onChange={e => handleChange('go_live_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Expedition Date</label>
            <input type="date" className={inputClass} value={form.expedition_date} onChange={e => handleChange('expedition_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Location URL</label>
            <input type="url" className={inputClass} value={form.location_url} onChange={e => handleChange('location_url', e.target.value)} placeholder="https://" />
          </div>
        </div>
      </div>

      {/* Franchise Owners */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Franchise Owners</h3>
          <button
            onClick={addOwner}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Owner
          </button>
        </div>
        {owners.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No owners added yet.</p>
        ) : (
          <div className="space-y-4">
            {owners.map((owner, i) => (
              <div key={i} className="relative bg-gray-50 rounded-lg p-4">
                <button
                  onClick={() => removeOwner(i)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                    <input type="text" className={inputClass} value={owner.name} onChange={e => handleOwnerChange(i, 'name', e.target.value)} placeholder="Jane Cronin" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                    <input type="tel" className={inputClass} value={owner.phone} onChange={e => handleOwnerChange(i, 'phone', e.target.value)} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input type="email" className={inputClass} value={owner.email} onChange={e => handleOwnerChange(i, 'email', e.target.value)} placeholder="jane@example.com" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Franchise Operator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Franchise Operator</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Operator Name</label>
            <input type="text" className={inputClass} value={form.franchise_operator_name} onChange={e => handleChange('franchise_operator_name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Operator Phone</label>
            <input type="tel" className={inputClass} value={form.franchise_operator_phone} onChange={e => handleChange('franchise_operator_phone', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Operator Email</label>
            <input type="email" className={inputClass} value={form.franchise_operator_email} onChange={e => handleChange('franchise_operator_email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Assigned Support Partner</label>
            <input type="text" className={inputClass} value={form.assigned_support_partner} onChange={e => handleChange('assigned_support_partner', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Location Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Location Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Location Name</label>
            <input type="text" className={inputClass} value={form.name} onChange={e => handleChange('name', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address Line 1</label>
            <input type="text" className={inputClass} value={form.address_line1} onChange={e => handleChange('address_line1', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address Line 2</label>
            <input type="text" className={inputClass} value={form.address_line2} onChange={e => handleChange('address_line2', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input type="text" className={inputClass} value={form.city} onChange={e => handleChange('city', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>State</label>
              <input type="text" className={inputClass} value={form.state} onChange={e => handleChange('state', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Zip Code</label>
              <input type="text" className={inputClass} value={form.zip_code} onChange={e => handleChange('zip_code', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="text" className={inputClass} value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={form.email} onChange={e => handleChange('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select className={inputClass} value={form.timezone} onChange={e => handleChange('timezone', e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Opened Date</label>
            <input type="date" className={inputClass} value={form.opened_date} onChange={e => handleChange('opened_date', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Manager */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Manager</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" className={inputClass} value={form.manager_name} onChange={e => handleChange('manager_name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={form.manager_email} onChange={e => handleChange('manager_email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="text" className={inputClass} value={form.manager_phone} onChange={e => handleChange('manager_phone', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Business Hours</h3>
        <div className="space-y-3">
          {DAYS.map(day => {
            const isOpen = hours[day] !== null
            return (
              <div key={day} className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-24 capitalize">{day}</span>
                {isOpen ? (
                  <>
                    <select
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                      value={hours[day]?.open || '08:00'}
                      onChange={e => handleHoursChange(day, 'open', e.target.value)}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-sm text-gray-400">to</span>
                    <select
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                      value={hours[day]?.close || '18:00'}
                      onChange={e => handleHoursChange(day, 'close', e.target.value)}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                ) : (
                  <span className="text-sm text-gray-400 italic">Closed</span>
                )}
                <label className="ml-auto flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={e => handleHoursToggle(day, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">{isOpen ? 'Open' : 'Closed'}</span>
                </label>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Notes</h3>
        <textarea
          className={inputClass + ' h-32 resize-y'}
          value={form.notes}
          onChange={e => handleChange('notes', e.target.value)}
          placeholder="Internal notes about this location..."
        />
      </div>

      {/* Custom Fields (dynamic) */}
      {Object.keys(groupedFields).length > 0 && (
        <>
          <div className="border-t border-gray-200 pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Fields</p>
          </div>
          {Object.entries(groupedFields).map(([groupName, fields]) => (
            <div key={groupName} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{groupName}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.sort((a, b) => a.display_order - b.display_order).map(field => {
                  const cv = customFields[field.id]
                  // Make textarea, json, and multi_select full-width
                  const isWide = field.field_type === 'textarea' || field.field_type === 'json' || field.field_type === 'multi_select'
                  return (
                    <div key={field.id} className={isWide ? 'sm:col-span-2' : ''}>
                      <DynamicFieldRenderer
                        field={field}
                        value={cv?.value ?? null}
                        valueJson={cv?.valueJson ?? null}
                        onChange={(val, valJson) => handleCustomFieldChange(field.id, val, valJson)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {saving ? (
            <>
              <Save className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4" /> Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Changes
            </>
          )}
        </button>
        {saved && <span className="text-sm text-emerald-600">Changes saved successfully.</span>}
      </div>
    </div>
  )
}
