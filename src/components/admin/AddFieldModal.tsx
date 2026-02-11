'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { FieldType } from '@/lib/types'

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'json', label: 'JSON' },
]

interface AddFieldModalProps {
  existingGroups: string[]
  onClose: () => void
  onCreated: () => void
}

export default function AddFieldModal({ existingGroups, onClose, onCreated }: AddFieldModalProps) {
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [group, setGroup] = useState(existingGroups[0] || 'General')
  const [customGroup, setCustomGroup] = useState('')
  const [showCustomGroup, setShowCustomGroup] = useState(false)
  const [description, setDescription] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const needsOptions = fieldType === 'select' || fieldType === 'multi_select'

  const addOption = () => {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    setOptions([...options, trimmed])
    setNewOption('')
  }

  const handleSubmit = async () => {
    if (!fieldName.trim()) {
      setError('Field name is required')
      return
    }
    if (needsOptions && options.length < 2) {
      setError('Dropdown fields need at least 2 options')
      return
    }

    setSaving(true)
    setError('')

    const finalGroup = showCustomGroup ? customGroup.trim() || 'General' : group

    try {
      const res = await fetch('/api/admin/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: fieldName.trim(),
          field_type: fieldType,
          field_group: finalGroup,
          description: description.trim() || null,
          is_required: isRequired,
          options: needsOptions ? options : [],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create field')
        setSaving(false)
        return
      }

      onCreated()
      onClose()
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Custom Field</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Name *</label>
            <input
              type="text"
              className={inputClass}
              value={fieldName}
              onChange={e => { setFieldName(e.target.value); setError('') }}
              placeholder="e.g. Funding Source"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
            <select
              className={inputClass}
              value={fieldType}
              onChange={e => setFieldType(e.target.value as FieldType)}
            >
              {FIELD_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            {showCustomGroup ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={inputClass}
                  value={customGroup}
                  onChange={e => setCustomGroup(e.target.value)}
                  placeholder="New group name"
                />
                <button
                  onClick={() => setShowCustomGroup(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  Use existing
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className={inputClass}
                  value={group}
                  onChange={e => setGroup(e.target.value)}
                >
                  {existingGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCustomGroup(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  + New
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              className={inputClass}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Help text shown below the field"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Required field</span>
          </label>

          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">{opt}</span>
                    <button
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOption()}
                    placeholder="Add option..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addOption}
                    disabled={!newOption.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Field'}
          </button>
        </div>
      </div>
    </div>
  )
}
