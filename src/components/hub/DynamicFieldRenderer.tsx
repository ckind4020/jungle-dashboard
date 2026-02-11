'use client'

import { FieldDefinition } from '@/lib/types'
import { Link2, Phone, Mail } from 'lucide-react'

interface DynamicFieldRendererProps {
  field: FieldDefinition
  value: string | null
  valueJson: any | null
  onChange: (value: string | null, valueJson?: any) => void
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

export default function DynamicFieldRenderer({ field, value, valueJson, onChange }: DynamicFieldRendererProps) {
  const renderInput = () => {
    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            className={inputClass}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.description || ''}
          />
        )

      case 'textarea':
        return (
          <textarea
            className={inputClass + ' h-20 resize-y'}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.description || ''}
            rows={3}
          />
        )

      case 'select':
        return (
          <select
            className={inputClass}
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
          >
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )

      case 'multi_select': {
        const selected: string[] = valueJson || []
        return (
          <div className="space-y-1.5">
            {(field.options || []).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter(s => s !== opt)
                    onChange(null, next)
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        )
      }

      case 'date':
        return (
          <input
            type="date"
            className={inputClass}
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={e => onChange(e.target.checked ? 'true' : 'false')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span className="text-sm text-gray-700">{value === 'true' ? 'Yes' : 'No'}</span>
          </label>
        )

      case 'url':
        return (
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              className={inputClass + ' pl-9'}
              value={value || ''}
              onChange={e => onChange(e.target.value || null)}
              placeholder="https://"
            />
          </div>
        )

      case 'phone':
        return (
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              className={inputClass + ' pl-9'}
              value={value || ''}
              onChange={e => onChange(e.target.value || null)}
              placeholder="(555) 123-4567"
            />
          </div>
        )

      case 'email':
        return (
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              className={inputClass + ' pl-9'}
              value={value || ''}
              onChange={e => onChange(e.target.value || null)}
              placeholder="name@example.com"
            />
          </div>
        )

      case 'number':
        return (
          <input
            type="number"
            className={inputClass}
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
          />
        )

      case 'json':
        return (
          <textarea
            className={inputClass + ' h-24 resize-y font-mono text-xs'}
            value={valueJson ? JSON.stringify(valueJson, null, 2) : (value || '')}
            onChange={e => {
              const raw = e.target.value
              try {
                const parsed = JSON.parse(raw)
                onChange(null, parsed)
              } catch {
                onChange(raw)
              }
            }}
            placeholder={field.description || 'Enter JSON...'}
            rows={3}
          />
        )

      default:
        return (
          <input
            type="text"
            className={inputClass}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
          />
        )
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.field_name}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderInput()}
      {field.description && field.field_type !== 'text' && field.field_type !== 'textarea' && field.field_type !== 'json' && (
        <p className="mt-1 text-xs text-gray-400">{field.description}</p>
      )}
    </div>
  )
}
