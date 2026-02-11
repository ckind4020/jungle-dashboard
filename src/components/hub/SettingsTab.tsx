'use client'

import { useState } from 'react'
import { HubData } from '@/lib/types'
import { Save, Check } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
]

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hours = Math.floor(i / 2) + 6 // 06:00 to 19:30
  const minutes = i % 2 === 0 ? '00' : '30'
  const h = hours.toString().padStart(2, '0')
  return `${h}:${minutes}`
})

interface SettingsTabProps {
  data: HubData
  onRefresh: () => void
}

export default function SettingsTab({ data, onRefresh }: SettingsTabProps) {
  const { location } = data

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
  })

  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>(() => {
    const defaultHours: Record<string, { open: string; close: string } | null> = {}
    for (const day of DAYS) {
      defaultHours[day] = location.business_hours?.[day] ?? null
    }
    return defaultHours
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/hub/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          business_hours: hours,
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

  return (
    <div className="space-y-6 max-w-3xl">
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
