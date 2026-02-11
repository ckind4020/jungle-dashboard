'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { FieldDefinition } from '@/lib/types'
import { PageHeader } from '@/components/layout/PageHeader'
import FieldDefinitionCard from '@/components/admin/FieldDefinitionCard'
import AddFieldModal from '@/components/admin/AddFieldModal'

export default function AdminFieldsPage() {
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchFields = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/fields')
      .then(res => res.json())
      .then(data => setFields(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.title = 'Field Manager | Jungle Driving School'
    fetchFields()
  }, [fetchFields])

  // Group fields by field_group
  const grouped = fields.reduce<Record<string, FieldDefinition[]>>((acc, field) => {
    const group = field.field_group || 'General'
    if (!acc[group]) acc[group] = []
    acc[group].push(field)
    return acc
  }, {})

  const existingGroups = [...new Set(fields.map(f => f.field_group || 'General'))]
  if (!existingGroups.includes('General')) existingGroups.push('General')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Manager"
        subtitle="Define the fields that appear on each location's profile"
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Field
          </button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-16 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : fields.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom fields yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create custom fields to track additional data on each location.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([groupName, groupFields]) => (
            <div key={groupName} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {groupName}
                <span className="text-xs font-normal text-gray-400">({groupFields.length} {groupFields.length === 1 ? 'field' : 'fields'})</span>
              </h3>
              <div className="space-y-3">
                {groupFields
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(field => (
                    <FieldDefinitionCard
                      key={field.id}
                      field={field}
                      onUpdated={fetchFields}
                      onDeleted={fetchFields}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddFieldModal
          existingGroups={existingGroups}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchFields}
        />
      )}
    </div>
  )
}
