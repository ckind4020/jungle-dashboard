'use client'

import { useState } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Save } from 'lucide-react'

interface OptionsEditorProps {
  options: string[]
  onSave: (options: string[]) => void
  onCancel: () => void
}

export default function OptionsEditor({ options: initialOptions, onSave, onCancel }: OptionsEditorProps) {
  const [options, setOptions] = useState<string[]>(initialOptions)
  const [newOption, setNewOption] = useState('')

  const addOption = () => {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    setOptions([...options, trimmed])
    setNewOption('')
  }

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= options.length) return
    const updated = [...options]
    const [item] = updated.splice(index, 1)
    updated.splice(newIndex, 0, item)
    setOptions(updated)
  }

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button
                onClick={() => moveOption(i, -1)}
                disabled={i === 0}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => moveOption(i, 1)}
                disabled={i === options.length - 1}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => removeOption(i)}
              className="text-gray-400 hover:text-red-500 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newOption}
          onChange={e => setNewOption(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addOption()}
          placeholder="New option..."
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

      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => onSave(options)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> Save Options
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
