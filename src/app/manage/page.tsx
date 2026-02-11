'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, MapPin, X, Building2 } from 'lucide-react'
import { LocationProfile } from '@/lib/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

export default function ManagePage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', address_line1: '', city: '', state: '', zip_code: '', phone: '', manager_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchLocations = useCallback(() => {
    setLoading(true)
    fetch('/api/manage/locations')
      .then(res => res.json())
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Manage Locations | Jungle Driving School'
    fetchLocations()
  }, [fetchLocations])

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Location name is required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/manage/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create location')
        setSaving(false)
        return
      }

      const location = await res.json()
      router.push(`/hub/${location.id}?tab=settings`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Franchise Management"
        subtitle="Add and manage franchise locations"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Location
          </button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-72 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No locations yet</h3>
          <p className="text-sm text-gray-500 mb-6">Click &quot;Add Location&quot; to get started.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map((loc: any) => (
            <div key={loc.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{loc.name}</h3>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        loc.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      )}>
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {[loc.address_line1, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ') || 'No address set'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {loc.manager_name ? `Manager: ${loc.manager_name}` : 'No manager assigned'}
                      {loc.opened_date && `  ·  Opened: ${new Date(loc.opened_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/hub/${loc.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
                >
                  Open Hub →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Location Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add New Location</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
                <input type="text" className={inputClass} value={form.name} onChange={e => { setForm(prev => ({ ...prev, name: e.target.value })); setError('') }} placeholder="e.g. Jungle Driving School — Omaha" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" className={inputClass} value={form.address_line1} onChange={e => setForm(prev => ({ ...prev, address_line1: e.target.value }))} placeholder="4502 S 84th St" />
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" className={inputClass} value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select className={inputClass} value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}>
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                  <input type="text" className={inputClass} value={form.zip_code} onChange={e => setForm(prev => ({ ...prev, zip_code: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" className={inputClass} value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="(402) 555-0101" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                <input type="text" className={inputClass} value={form.manager_name} onChange={e => setForm(prev => ({ ...prev, manager_name: e.target.value }))} placeholder="Sarah Mitchell" />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
