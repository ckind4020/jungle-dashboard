'use client'

import { useState, useRef } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LeadStage {
  id: string
  name: string
  color: string
  position: number
}

interface StepEditorProps {
  stepType: string
  config: Record<string, any>
  stages: LeadStage[]
  totalSteps: number
  onChange: (config: Record<string, any>) => void
}

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'first_name' },
  { tag: '{{last_name}}', label: 'last_name' },
  { tag: '{{full_name}}', label: 'full_name' },
  { tag: '{{email}}', label: 'email' },
  { tag: '{{phone}}', label: 'phone' },
  { tag: '{{location_name}}', label: 'location_name' },
  { tag: '{{location_phone}}', label: 'location_phone' },
]

function MergeTagButtons({ textareaRef, config, field, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  config: Record<string, any>
  field: string
  onChange: (config: Record<string, any>) => void
}) {
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const current = config[field] || ''
    const newValue = current.substring(0, start) + tag + current.substring(end)
    onChange({ ...config, [field]: newValue })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {MERGE_TAGS.map(({ tag, label }) => (
        <button
          key={tag}
          type="button"
          onClick={() => insertTag(tag)}
          className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 font-mono"
        >
          {`{{${label}}}`}
        </button>
      ))}
    </div>
  )
}

export function StepEditor({ stepType, config, stages, totalSteps, onChange }: StepEditorProps) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const notifyRef = useRef<HTMLTextAreaElement>(null)
  const webhookBodyRef = useRef<HTMLTextAreaElement>(null)
  const [charCount, setCharCount] = useState((config.message || '').length)

  switch (stepType) {
    case 'send_sms':
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">Message</label>
          <textarea
            ref={messageRef}
            value={config.message || ''}
            onChange={e => {
              onChange({ ...config, message: e.target.value })
              setCharCount(e.target.value.length)
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Hi {{first_name}}, thanks for your interest!"
          />
          <div className="flex items-center justify-between">
            <MergeTagButtons textareaRef={messageRef} config={config} field="message" onChange={onChange} />
            <span className="text-xs text-gray-400">{charCount}/160</span>
          </div>
        </div>
      )

    case 'send_email':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={config.subject || ''}
              onChange={e => onChange({ ...config, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Welcome to Jungle Driving School!"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
            <textarea
              ref={bodyRef}
              value={config.body || ''}
              onChange={e => onChange({ ...config, body: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Hi {{first_name}},&#10;&#10;Thank you for reaching out..."
            />
            <MergeTagButtons textareaRef={bodyRef} config={config} field="body" onChange={onChange} />
          </div>
        </div>
      )

    case 'wait_delay':
      return (
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-700">Wait for:</label>
          <input
            type="number"
            min={1}
            value={config.delay_amount || ''}
            onChange={e => onChange({ ...config, delay_amount: parseInt(e.target.value) || 0 })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={config.delay_unit || 'minutes'}
            onChange={e => onChange({ ...config, delay_unit: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Move lead to stage:</label>
          <select
            value={config.stage_id || ''}
            onChange={e => {
              const stage = stages.find(s => s.id === e.target.value)
              onChange({ ...config, stage_id: e.target.value, stage_name: stage?.name || '' })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select stage...</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )

    case 'update_lead':
      return (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
            <select
              value={config.field || ''}
              onChange={e => onChange({ ...config, field: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select field...</option>
              <option value="score">Score</option>
              <option value="source">Source</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
            <input
              type="text"
              value={config.value || ''}
              onChange={e => onChange({ ...config, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )

    case 'notify_user':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notification message</label>
            <textarea
              ref={notifyRef}
              value={config.message || ''}
              onChange={e => onChange({ ...config, message: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="New lead {{full_name}} needs attention"
            />
            <MergeTagButtons textareaRef={notifyRef} config={config} field="message" onChange={onChange} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
            <select
              value={config.channel || 'in_app'}
              onChange={e => onChange({ ...config, channel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
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
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
              <input
                type="text"
                value={config.url || ''}
                onChange={e => onChange({ ...config, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/webhook"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
              <select
                value={config.method || 'POST'}
                onChange={e => onChange({ ...config, method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Headers (JSON)</label>
            <textarea
              value={typeof config.headers === 'string' ? config.headers : JSON.stringify(config.headers || {}, null, 2)}
              onChange={e => onChange({ ...config, headers: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder='{"Content-Type": "application/json"}'
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body template</label>
            <textarea
              ref={webhookBodyRef}
              value={config.body_template || ''}
              onChange={e => onChange({ ...config, body_template: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder='{"name": "{{full_name}}", "email": "{{email}}"}'
            />
            <MergeTagButtons textareaRef={webhookBodyRef} config={config} field="body_template" onChange={onChange} />
          </div>
        </div>
      )

    case 'condition':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-700">If lead&apos;s</span>
            <select
              value={config.field || ''}
              onChange={e => onChange({ ...config, field: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select field...</option>
              <option value="score">Score</option>
              <option value="source">Source</option>
              <option value="stage_id">Stage</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
            <select
              value={config.operator || 'equals'}
              onChange={e => onChange({ ...config, operator: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="greater_than">greater than</option>
            </select>
            <input
              type="text"
              value={config.value || ''}
              onChange={e => onChange({ ...config, value: e.target.value })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="value"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Then: continue to next step</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Else:</span>
            <select
              value={config.else_action || 'end'}
              onChange={e => onChange({ ...config, else_action: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="end">End automation</option>
              {Array.from({ length: totalSteps }, (_, i) => (
                <option key={i + 1} value={`skip_to_${i + 1}`}>Skip to step {i + 1}</option>
              ))}
            </select>
          </div>
        </div>
      )

    default:
      return <p className="text-sm text-gray-500">Unknown step type: {stepType}</p>
  }
}
