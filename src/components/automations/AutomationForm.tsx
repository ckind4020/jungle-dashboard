'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AutomationFormProps {
  name: string
  description: string
  onChangeName: (name: string) => void
  onChangeDescription: (description: string) => void
}

export function AutomationForm({ name, description, onChangeName, onChangeDescription }: AutomationFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => onChangeName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Welcome Sequence for New Leads"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => onChangeDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Sends intro SMS then follow-up email"
        />
      </div>
    </div>
  )
}
