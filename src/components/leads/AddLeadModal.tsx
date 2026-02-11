'use client'

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

const SOURCES = [
  { value: 'manual_entry', label: 'Manual Entry' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'web_form', label: 'Web Form' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

interface AddLeadModalProps {
  locationId: string
  onClose: () => void
  onCreated: () => void
}

interface Duplicate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

export default function AddLeadModal({ locationId, onClose, onCreated }: AddLeadModalProps) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: 'manual_entry',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
    setDuplicates([])
  }

  const handleSubmit = async (force = false) => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          ...form,
          force,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDuplicates(data.duplicates || [])
        setSaving(false)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create lead')
        setSaving(false)
        return
      }

      onCreated()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    }
    setSaving(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Duplicate warning */}
          {duplicates.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Possible duplicate found</p>
                  {duplicates.map(d => (
                    <p key={d.id} className="text-xs text-amber-700 mt-1">
                      {d.first_name} {d.last_name} {d.email && `(${d.email})`} {d.phone && `· ${d.phone}`}
                    </p>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={onClose}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSubmit(true)}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create Anyway'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input type="text" className={inputClass} value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input type="text" className={inputClass} value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} placeholder="Smith" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className={inputClass} value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="john@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" className={inputClass} value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="(402) 555-1234" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select className={inputClass} value={form.source} onChange={e => handleChange('source', e.target.value)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {duplicates.length === 0 && (
          <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Add Lead'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
