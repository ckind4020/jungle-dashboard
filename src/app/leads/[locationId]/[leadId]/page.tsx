'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Archive, GraduationCap, Edit3, Save, X } from 'lucide-react'
import { Lead, LeadStage, ActivityLog } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import StageDropdown from '@/components/leads/StageDropdown'
import ActivityTimeline from '@/components/leads/ActivityTimeline'
import { formatDistanceToNow, format } from 'date-fns'

const SOURCE_LABELS: Record<string, string> = {
  manual_entry: 'Manual Entry',
  phone_call: 'Phone Call',
  walk_in: 'Walk-In',
  web_form: 'Web Form',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  referral: 'Referral',
  import: 'Import',
  other: 'Other',
}

export default function LeadDetailPage({ params }: { params: Promise<{ locationId: string; leadId: string }> }) {
  const { locationId, leadId } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [stages, setStages] = useState<LeadStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', score: 0 })

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/leads/${leadId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        setLead(data.lead)
        setActivities(data.activities)
        setStages(data.stages)
        setEditForm({
          first_name: data.lead.first_name,
          last_name: data.lead.last_name,
          email: data.lead.email || '',
          phone: data.lead.phone || '',
          score: data.lead.score || 0,
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [leadId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (lead) {
      document.title = `${lead.first_name} ${lead.last_name} | Jungle Driving School`
    }
  }, [lead])

  const handleStageChange = async (stageId: string) => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    })
    fetchData()
  }

  const handleArchive = async () => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: true }),
    })
    router.push(`/leads/${locationId}`)
  }

  const handleConvert = async () => {
    // Find the "Enrolled" stage
    const enrolledStage = stages.find(s => s.name.toLowerCase() === 'enrolled')
    const updates: Record<string, unknown> = { converted_at: new Date().toISOString() }
    if (enrolledStage) updates.stage_id = enrolledStage.id

    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    fetchData()
  }

  const handleSaveEdit = async () => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditing(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lead Detail" />
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lead Detail" />
        <ErrorState message="Could not load lead." onRetry={fetchData} />
      </div>
    )
  }

  const locationName = lead.locations?.name || ''
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-6">
      <Link href={`/leads/${locationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Leads{locationName ? ` — ${locationName}` : ''}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — Lead info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {!editing ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{lead.first_name} {lead.last_name}</h2>
                    {lead.email && <p className="text-sm text-gray-500 mt-0.5">{lead.email}</p>}
                    {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Score</p>
                    <p className={cn('text-2xl font-bold', lead.score >= 70 ? 'text-emerald-600' : lead.score >= 40 ? 'text-amber-500' : 'text-gray-400')}>
                      {lead.score}
                    </p>
                  </div>
                </div>

                {/* Stage */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stage</label>
                  <StageDropdown stages={stages} currentStageId={lead.stage_id} onChange={handleStageChange} />
                </div>

                {/* Info rows */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <span className="text-gray-700">{SOURCE_LABELS[lead.source] || lead.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="text-gray-700">{format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {lead.converted_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Converted</span>
                      <span className="text-emerald-600 font-medium">{format(new Date(lead.converted_at), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">UTM</span>
                      <span className="text-gray-700 text-right">
                        {[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={handleArchive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                  {!lead.converted_at && (
                    <button
                      onClick={handleConvert}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <GraduationCap className="w-3.5 h-3.5" /> Convert
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* Edit mode */
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Edit Lead</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                    <input type="text" className={inputClass} value={editForm.first_name} onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                    <input type="text" className={inputClass} value={editForm.last_name} onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input type="email" className={inputClass} value={editForm.email} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input type="tel" className={inputClass} value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lead Score (0-100)</label>
                  <input type="number" min={0} max={100} className={inputClass} value={editForm.score} onChange={e => setEditForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Activity Timeline */}
        <div className="lg:col-span-3">
          <ActivityTimeline activities={activities} leadId={leadId} onNoteAdded={fetchData} />
        </div>
      </div>
    </div>
  )
}
