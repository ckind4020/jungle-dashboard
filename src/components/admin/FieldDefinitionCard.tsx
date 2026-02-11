'use client'

import { useState } from 'react'
import { Pencil, Trash2, ListOrdered, X, Save } from 'lucide-react'
import { FieldDefinition, FieldType } from '@/lib/types'
import OptionsEditor from './OptionsEditor'
import { cn } from '@/lib/utils'

const TYPE_BADGES: Record<FieldType, { label: string; color: string }> = {
  text: { label: 'Text', color: 'bg-gray-100 text-gray-700' },
  textarea: { label: 'Long Text', color: 'bg-gray-100 text-gray-700' },
  select: { label: 'Dropdown', color: 'bg-blue-100 text-blue-700' },
  multi_select: { label: 'Multi-Select', color: 'bg-indigo-100 text-indigo-700' },
  date: { label: 'Date', color: 'bg-green-100 text-green-700' },
  boolean: { label: 'Yes/No', color: 'bg-amber-100 text-amber-700' },
  url: { label: 'URL', color: 'bg-cyan-100 text-cyan-700' },
  phone: { label: 'Phone', color: 'bg-emerald-100 text-emerald-700' },
  email: { label: 'Email', color: 'bg-rose-100 text-rose-700' },
  number: { label: 'Number', color: 'bg-purple-100 text-purple-700' },
  json: { label: 'JSON', color: 'bg-orange-100 text-orange-700' },
}

interface FieldDefinitionCardProps {
  field: FieldDefinition
  onUpdated: () => void
  onDeleted: () => void
}

export default function FieldDefinitionCard({ field, onUpdated, onDeleted }: FieldDefinitionCardProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(field.field_name)
  const [editDescription, setEditDescription] = useState(field.description || '')
  const [editRequired, setEditRequired] = useState(field.is_required)
  const [showOptions, setShowOptions] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const badge = TYPE_BADGES[field.field_type] || TYPE_BADGES.text
  const hasOptions = field.field_type === 'select' || field.field_type === 'multi_select'

  const handleSaveEdit = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: editName.trim(),
          description: editDescription.trim() || null,
          is_required: editRequired,
        }),
      })
      if (res.ok) {
        setEditing(false)
        onUpdated()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleSaveOptions = async (newOptions: string[]) => {
    try {
      const res = await fetch(`/api/admin/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: newOptions }),
      })
      if (res.ok) {
        setShowOptions(false)
        onUpdated()
      }
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/fields/${field.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } catch { /* ignore */ }
    setDeleting(false)
  }

  if (confirmDelete) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700 font-medium mb-1">Delete &quot;{field.field_name}&quot;?</p>
        <p className="text-xs text-red-600 mb-3">
          This will remove all saved values for this field across all locations. This cannot be undone.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Field Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Help text..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editRequired}
              onChange={e => setEditRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Required</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditName(field.field_name); setEditDescription(field.description || ''); setEditRequired(field.is_required) }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-gray-900">{field.field_name}</h4>
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badge.color)}>
                  {badge.label}
                </span>
                {field.is_required && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                    Required
                  </span>
                )}
              </div>
              {field.description && (
                <p className="text-xs text-gray-500 mt-1">{field.description}</p>
              )}
              {hasOptions && field.options.length > 0 && !showOptions && (
                <p className="text-xs text-gray-400 mt-1">
                  Options: {field.options.join(', ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {hasOptions && (
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Manage Options"
                >
                  {showOptions ? <X className="w-3.5 h-3.5" /> : <ListOrdered className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showOptions && hasOptions && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <OptionsEditor
                options={field.options}
                onSave={handleSaveOptions}
                onCancel={() => setShowOptions(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
