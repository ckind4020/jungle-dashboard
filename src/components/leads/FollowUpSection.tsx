'use client'

import { useState } from 'react'
import { Calendar, Phone, Mail, MessageSquare, Users, Clock, Save, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface FollowUpSectionProps {
  leadId: string
  followUpDate: string | null
  followUpType: string | null
  followUpNotes: string | null
  lastContactAt: string | null
  lastContactType: string | null
  onSaved: () => void
}

const FOLLOW_UP_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'text', label: 'Text', icon: MessageSquare },
]

const CONTACT_TYPE_LABELS: Record<string, string> = {
  call_inbound: 'call inbound',
  call_outbound: 'call outbound',
  email_sent: 'email sent',
  email_received: 'email received',
  sms: 'SMS',
  in_person: 'in person',
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function FollowUpSection({
  leadId,
  followUpDate,
  followUpType,
  followUpNotes,
  lastContactAt,
  lastContactType,
  onSaved,
}: FollowUpSectionProps) {
  const [date, setDate] = useState(followUpDate || '')
  const [type, setType] = useState(followUpType || 'call')
  const [notes, setNotes] = useState(followUpNotes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_date: date || null,
          follow_up_type: type,
          follow_up_notes: notes || null,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_date: null,
          follow_up_type: null,
          follow_up_notes: null,
        }),
      })
      setDate('')
      setType('call')
      setNotes('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-blue-600" />
        Follow-up
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            className={inputClass}
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {FOLLOW_UP_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="e.g. Check if she got pricing"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !date}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save Follow-up
          </button>
          {followUpDate && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Last Contact */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">Last Contact:</span>
          {lastContactAt ? (
            <span className="text-gray-700">
              {formatDistanceToNow(new Date(lastContactAt), { addSuffix: true })}
              {lastContactType && ` (${CONTACT_TYPE_LABELS[lastContactType] || lastContactType})`}
            </span>
          ) : (
            <span className="text-red-500">Never contacted</span>
          )}
        </div>
      </div>
    </div>
  )
}
