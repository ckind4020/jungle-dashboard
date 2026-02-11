'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Search, Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import { Lead, LeadStage, LeadListResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import AddLeadModal from '@/components/leads/AddLeadModal'
import { formatDistanceToNow } from 'date-fns'

const SOURCE_LABELS: Record<string, string> = {
  manual_entry: 'Manual',
  phone_call: 'Phone',
  walk_in: 'Walk-In',
  web_form: 'Web Form',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  referral: 'Referral',
  import: 'Import',
  other: 'Other',
}

export default function LeadListPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<LeadListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [activeStageId, setActiveStageId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [locationName, setLocationName] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLeads = useCallback(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ location_id: locationId, page: String(page), limit: '25' })
    if (activeStageId) params.set('stage_id', activeStageId)
    if (search) params.set('search', search)

    fetch(`/api/leads?${params}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [locationId, page, activeStageId, search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Fetch location name
  useEffect(() => {
    fetch(`/api/hub/${locationId}`)
      .then(res => res.json())
      .then(d => {
        if (d.location?.name) {
          setLocationName(d.location.name)
          document.title = `Leads — ${d.location.name} | Jungle Driving School`
        }
      })
      .catch(() => {})
  }, [locationId])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      // fetchLeads will be called by the useEffect dependency on search
    }, 300)
  }

  const stages = data?.stages || []

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leads" />
        <ErrorState message="Could not load leads." onRetry={fetchLeads} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/hub/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {locationName || 'Hub'}
      </Link>

      <PageHeader
        title={`Leads${locationName ? ` — ${locationName}` : ''}`}
        subtitle={data ? `${data.total} total leads` : undefined}
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, email, phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Stage filter pills */}
      {stages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setActiveStageId(null); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !activeStageId ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}
          >
            All
          </button>
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => { setActiveStageId(activeStageId === stage.id ? null : stage.id); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                activeStageId === stage.id
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              )}
              style={activeStageId === stage.id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
            >
              {stage.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-12 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : data && data.leads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No leads yet</h3>
          <p className="text-sm text-gray-500 mb-6">Add your first lead or connect an integration to start capturing them automatically.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      ) : data && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.leads.map((lead: Lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${locationId}/${lead.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-gray-500">{lead.email || lead.phone || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {SOURCE_LABELS[lead.source] || lead.source}
                    </td>
                    <td className="px-6 py-4">
                      {lead.lead_stages ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: lead.lead_stages.color }}
                        >
                          {lead.lead_stages.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">{lead.score}</td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          locationId={locationId}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchLeads}
        />
      )}
    </div>
  )
}
