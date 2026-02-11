'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EnrollmentListProps {
  automationId: string
  locationId: string
  totalSteps: number
}

export default function EnrollmentList({ automationId, locationId, totalSteps }: EnrollmentListProps) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const fetchEnrollments = useCallback(() => {
    setLoading(true)
    fetch(`/api/automations/${automationId}/enrollments`)
      .then(r => r.json())
      .then(d => setEnrollments(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [automationId])

  useEffect(() => { fetchEnrollments() }, [fetchEnrollments])

  const searchLeads = async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/leads?location_id=${locationId}&search=${encodeURIComponent(query)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.leads || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const enrollLead = async (leadId: string) => {
    const res = await fetch(`/api/automations/${automationId}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
    if (res.ok) {
      setShowEnrollModal(false)
      setSearchQuery('')
      setSearchResults([])
      fetchEnrollments()
    }
  }

  const activeCount = enrollments.filter(e => e.status === 'active').length
  const completedCount = enrollments.filter(e => e.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowEnrollModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> Enroll Lead
        </button>
        <span className="text-xs text-gray-500">
          Active: {activeCount} · Done: {completedCount}
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No leads enrolled yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Step</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Next Run</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(en => (
                <tr key={en.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900">
                    {en.leads?.first_name} {en.leads?.last_name}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      en.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      en.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                      'bg-red-100 text-red-700'
                    )}>
                      {en.status === 'active' ? 'Active' : en.status === 'completed' ? 'Done' : en.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {en.status === 'completed' ? 'Completed' : `Step ${en.current_step_order} / ${totalSteps}`}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">
                    {en.status === 'active' && en.next_execution_at
                      ? formatDistanceToNow(new Date(en.next_execution_at), { addSuffix: true })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Enroll Lead Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEnrollModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Enroll a Lead</h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchLeads(e.target.value) }}
                  placeholder="Search by name, email, phone..."
                  autoFocus
                />
              </div>
              <div className="mt-3 max-h-48 overflow-y-auto">
                {searching && <p className="text-xs text-gray-400 p-2">Searching...</p>}
                {searchResults.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => enrollLead(lead.id)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{lead.email || lead.phone}</span>
                  </button>
                ))}
                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-xs text-gray-400 p-2">No leads found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
