'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AutomationFormProps {
  name: string
  description: string
  onChange: (field: string, value: string) => void
}

export default function AutomationForm({ name, description, onChange }: AutomationFormProps) {
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Automation Name *</label>
        <input
          type="text"
          className={inputClass}
          value={name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="e.g. Welcome Sequence for New Leads"
        />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input
          type="text"
          className={inputClass}
          value={description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="Sends intro SMS then follow-up email"
        />
      </div>
    </div>
  )
}
