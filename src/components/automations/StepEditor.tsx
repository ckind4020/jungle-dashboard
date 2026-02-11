'use client'

import { useState, useRef } from 'react'
import { Save } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'first_name' },
  { tag: '{{last_name}}', label: 'last_name' },
  { tag: '{{full_name}}', label: 'full_name' },
  { tag: '{{email}}', label: 'email' },
  { tag: '{{phone}}', label: 'phone' },
  { tag: '{{location_name}}', label: 'location_name' },
  { tag: '{{location_phone}}', label: 'location_phone' },
]

interface StepEditorProps {
  stepType: string
  config: Record<string, any>
  stages: { id: string; name: string; color: string }[]
  onSave: (config: Record<string, any>) => void
  saving?: boolean
}

export default function StepEditor({ stepType, config: initialConfig, stages, onSave, saving }: StepEditorProps) {
  const [config, setConfig] = useState<Record<string, any>>({ ...initialConfig })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const set = (key: string, value: any) => setConfig(prev => ({ ...prev, [key]: value }))

  const insertMergeTag = (tag: string, ref?: React.RefObject<HTMLTextAreaElement | null>) => {
    const el = ref?.current || textareaRef.current
    if (!el) {
      set('message', (config.message || '') + tag)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = el.value
    const newText = text.substring(0, start) + tag + text.substring(end)
    const field = el.name || 'message'
    set(field, newText)
    setTimeout(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + tag.length
    }, 0)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  const renderMergeTags = (ref?: React.RefObject<HTMLTextAreaElement | null>) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {MERGE_TAGS.map(mt => (
        <button
          key={mt.tag}
          type="button"
          onClick={() => insertMergeTag(mt.tag, ref)}
          className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
        >
          {mt.label}
        </button>
      ))}
    </div>
  )

  const renderConfig = () => {
    switch (stepType) {
      case 'send_sms':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              ref={textareaRef}
              name="message"
              className={inputClass + ' h-24 resize-y'}
              value={config.message || ''}
              onChange={e => set('message', e.target.value)}
              placeholder="Hi {{first_name}}, thanks for your interest..."
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{(config.message || '').length}/160 characters</span>
            </div>
            {renderMergeTags()}
          </div>
        )

      case 'send_email':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input type="text" className={inputClass} value={config.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="Welcome to Jungle Driving School!" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                ref={textareaRef}
                name="body"
                className={inputClass + ' h-32 resize-y'}
                value={config.body || ''}
                onChange={e => set('body', e.target.value)}
                placeholder="Hi {{first_name}},&#10;&#10;Thank you for reaching out..."
              />
              {renderMergeTags()}
            </div>
          </div>
        )

      case 'wait_delay':
        return (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Wait for:</label>
            <input
              type="number"
              min="1"
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={config.delay_amount || ''}
              onChange={e => set('delay_amount', parseInt(e.target.value) || 0)}
            />
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={config.delay_unit || 'minutes'}
              onChange={e => set('delay_unit', e.target.value)}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        )

      case 'change_stage':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Move lead to stage:</label>
            <select className={inputClass} value={config.stage_id || ''} onChange={e => {
              const stage = stages.find(s => s.id === e.target.value)
              set('stage_id', e.target.value)
              set('stage_name', stage?.name || '')
            }}>
              <option value="">Select stage...</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )

      case 'update_lead':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              <select className={inputClass} value={config.field || ''} onChange={e => set('field', e.target.value)}>
                <option value="">Select field...</option>
                <option value="score">Score</option>
                <option value="source">Source</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input type="text" className={inputClass} value={config.value || ''} onChange={e => set('value', e.target.value)} />
            </div>
          </div>
        )

      case 'notify_user':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                ref={textareaRef}
                name="message"
                className={inputClass + ' h-20 resize-y'}
                value={config.message || ''}
                onChange={e => set('message', e.target.value)}
                placeholder="New lead {{full_name}} needs follow-up"
              />
              {renderMergeTags()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select className={inputClass} value={config.channel || 'in_app'} onChange={e => set('channel', e.target.value)}>
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
            </div>
          </div>
        )

      case 'webhook':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input type="url" className={inputClass} value={config.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://hooks.example.com/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select className={inputClass} value={config.method || 'POST'} onChange={e => set('method', e.target.value)}>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
              <textarea className={inputClass + ' h-16 font-mono text-xs resize-y'} value={config.headers || ''} onChange={e => set('headers', e.target.value)} placeholder='{"Content-Type": "application/json"}' />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body template</label>
              <textarea
                ref={textareaRef}
                name="body_template"
                className={inputClass + ' h-20 font-mono text-xs resize-y'}
                value={config.body_template || ''}
                onChange={e => set('body_template', e.target.value)}
                placeholder='{"name": "{{full_name}}", "email": "{{email}}"}'
              />
              {renderMergeTags()}
            </div>
          </div>
        )

      case 'condition':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                <select className={inputClass} value={config.field || ''} onChange={e => set('field', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="score">Score</option>
                  <option value="source">Source</option>
                  <option value="stage">Stage</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                <select className={inputClass} value={config.operator || 'equals'} onChange={e => set('operator', e.target.value)}>
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="greater_than">greater than</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input type="text" className={inputClass} value={config.value || ''} onChange={e => set('value', e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <p><strong>Then:</strong> continue to next step</p>
              <p><strong>Else:</strong> skip or end automation</p>
            </div>
          </div>
        )

      default:
        return <p className="text-sm text-gray-500 italic">Unknown step type</p>
    }
  }

  return (
    <div className="space-y-3">
      {renderConfig()}
      <div className="flex justify-end">
        <button
          onClick={() => onSave(config)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Step'}
        </button>
      </div>
    </div>
  )
}
