'use client'

import { useState, useEffect } from 'react'
import { UserPlus, X, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EnrollmentListProps {
  automationId: string
  locationId: string
  totalSteps: number
}

export function EnrollmentList({ automationId, locationId, totalSteps }: EnrollmentListProps) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  const fetchEnrollments = () => {
    setLoading(true)
    fetch(`/api/automations/${automationId}/enrollments`)
      .then(r => r.json())
      .then(data => setEnrollments(Array.isArray(data) ? data : []))
      .catch(() => setEnrollments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEnrollments() }, [automationId])

  const searchLeads = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/leads?location_id=${locationId}&search=${encodeURIComponent(query)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.leads || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const enrollLead = async (leadId: string) => {
    setEnrolling(true)
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
    setEnrolling(false)
  }

  const removeEnrollment = async (enrollmentId: string) => {
    // We don't have a DELETE endpoint for enrollments, so we just mark as completed
    // For now this is a no-op placeholder — could extend API
  }

  const activeCount = enrollments.filter(e => e.status === 'active').length
  const completedCount = enrollments.filter(e => e.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowEnrollModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Enroll Lead
        </button>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Active: {activeCount}</span>
          <span>Done: {completedCount}</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">No leads enrolled yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Current Step</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Next Run</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-gray-900 font-medium">
                    {e.leads?.first_name} {e.leads?.last_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      e.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      e.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {e.status === 'active' ? '● Active' : e.status === 'completed' ? '✓ Done' : e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {e.status === 'completed' ? 'Completed' : `Step ${e.current_step_order} / ${totalSteps}`}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {e.status === 'active' && e.next_execution_at
                      ? formatDistanceToNow(new Date(e.next_execution_at), { addSuffix: true })
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Enroll Lead</h3>
              <button onClick={() => { setShowEnrollModal(false); setSearchQuery(''); setSearchResults([]) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => searchLeads(e.target.value)}
                  placeholder="Search leads by name, email, or phone..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto">
                {searching ? (
                  <p className="text-xs text-gray-400 text-center py-4">Searching...</p>
                ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No leads found</p>
                ) : (
                  searchResults.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => enrollLead(lead.id)}
                      disabled={enrolling}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</p>
                        <p className="text-xs text-gray-500">{lead.email || lead.phone || 'No contact info'}</p>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">Enroll</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
