'use client'

import { useState } from 'react'
import { ActivityLog } from '@/lib/types'
import { Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const ACTIVITY_ICONS: Record<string, string> = {
  lead_created: '➕',
  stage_change: '🔄',
  note: '📝',
  sms_sent: '💬',
  email_sent: '✉️',
  call_inbound: '📞',
  call_outbound: '📞',
  lead_archived: '📦',
  lead_converted: '🎓',
}

function getActivityLabel(type: string): string {
  const labels: Record<string, string> = {
    lead_created: 'Lead created',
    stage_change: 'Stage changed',
    note: 'Note added',
    sms_sent: 'SMS sent',
    email_sent: 'Email sent',
    call_inbound: 'Inbound call',
    call_outbound: 'Outbound call',
    lead_archived: 'Lead archived',
    lead_converted: 'Lead converted',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

interface ActivityTimelineProps {
  activities: ActivityLog[]
  leadId: string
  onNoteAdded: () => void
}

export default function ActivityTimeline({ activities, leadId, onNoteAdded }: ActivityTimelineProps) {
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)

  const handlePostNote = async () => {
    if (!note.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/leads/${leadId}?action=note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note.trim() }),
      })
      if (res.ok) {
        setNote('')
        onNoteAdded()
      }
    } catch { /* ignore */ }
    setPosting(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Activity Timeline</h3>
      </div>

      {/* Add note */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePostNote()}
            placeholder="Add a note..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handlePostNote}
            disabled={posting || !note.trim()}
            className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No activity yet.</p>
          </div>
        ) : (
          activities.map(activity => (
            <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{ACTIVITY_ICONS[activity.activity_type] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{getActivityLabel(activity.activity_type)}</p>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {activity.notes && (
                    <p className="text-sm text-gray-600 mt-0.5">{activity.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
