'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Phone, MessageSquare, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CallTrackingCardProps {
  callSummary: any
  callsByHour: number[]
  missedByHour: number[]
  smsSummary?: { total: number; inbound: number; outbound: number }
  callbacks?: {
    unreturned_calls: { caller_number: string; called_at: string; source: string | null; hours_waiting: number }[]
    unreturned_count: number
    avg_callback_time_hours: number
    callback_rate: number
    returned_count: number
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function formatPhone(num: string): string {
  if (num.length === 10) {
    return `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`
  }
  return num
}

function urgencyColor(hours: number): { dot: string; text: string } {
  if (hours < 1) return { dot: 'bg-green-500', text: 'text-green-600' }
  if (hours < 4) return { dot: 'bg-yellow-500', text: 'text-yellow-600' }
  return { dot: 'bg-red-500', text: 'text-red-600' }
}

export function CallTrackingCard({ callSummary, callsByHour, missedByHour, smsSummary, callbacks }: CallTrackingCardProps) {
  const hasCallData = callSummary && (callSummary.total > 0 || callSummary.outbound > 0)
  const hasSmsData = smsSummary && smsSummary.total > 0
  const hasCallbacks = callbacks && callbacks.unreturned_count > 0

  if (!hasCallData && !hasSmsData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Performance</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Phone className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No call data yet.</p>
          <p className="text-xs text-gray-400 mt-1">Connect CallTrackingMetrics to start tracking.</p>
        </div>
      </div>
    )
  }

  const answerRate = hasCallData ? parseFloat(callSummary.answer_rate) : 0
  const rateColor = answerRate >= 90 ? 'bg-green-500' : answerRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
  const rateTextColor = answerRate >= 90 ? 'text-green-600' : answerRate >= 75 ? 'text-yellow-600' : 'text-red-600'

  // Business hours missed calls chart (6 AM - 9 PM)
  const hourData = []
  for (let h = 6; h <= 21; h++) {
    hourData.push({
      hour: formatHour(h),
      missed: missedByHour[h] || 0,
      total: callsByHour[h] || 0,
    })
  }

  const peakMissedHour = missedByHour.reduce((maxH, val, h) => val > (missedByHour[maxH] || 0) ? h : maxH, 0)
  const peakMissedCount = missedByHour[peakMissedHour] || 0

  return (
    <div className="space-y-4">
      {/* Top row: Call Volume, Answer Rate, Callback Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inbound Call Volume */}
        {hasCallData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inbound Calls</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">Answered</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {callSummary.answered} ({callSummary.total > 0 ? ((callSummary.answered / callSummary.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-700">Missed</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {callSummary.missed} ({callSummary.total > 0 ? ((callSummary.missed / callSummary.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-gray-700">Voicemail</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {callSummary.voicemail} ({callSummary.total > 0 ? ((callSummary.voicemail / callSummary.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Avg duration: <span className="font-medium text-gray-700">{formatDuration(callSummary.avg_duration)}</span></p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">Inbound total: <span className="font-medium text-gray-700">{callSummary.total}</span></p>
                  <p className="text-xs text-gray-500">Outbound: <span className="font-medium text-gray-700">{callSummary.outbound || 0}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Answer Rate */}
        {hasCallData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inbound Answer Rate</h3>
            <div className="flex flex-col items-center justify-center">
              <p className={cn('text-5xl font-bold', rateTextColor)}>{answerRate.toFixed(0)}%</p>
              <div className="w-full mt-4 bg-gray-200 rounded-full h-3 relative">
                <div className={cn('h-3 rounded-full transition-all', rateColor)} style={{ width: `${Math.min(answerRate, 100)}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400" style={{ left: '90%' }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Target: 90% · Business hours only (M-F 8-5 CST)</p>
              {callSummary.after_hours_missed > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {callSummary.after_hours_missed} after-hours missed calls excluded
                </p>
              )}
            </div>
          </div>
        )}

        {/* Callback Performance */}
        {callbacks && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Callback Performance</h3>
            <div className="space-y-4">
              <div className="text-center">
                <p className={cn('text-4xl font-bold', callbacks.callback_rate >= 90 ? 'text-green-600' : callbacks.callback_rate >= 70 ? 'text-yellow-600' : 'text-red-600')}>
                  {callbacks.callback_rate}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Callback Rate</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-900">{callbacks.avg_callback_time_hours}h</p>
                  <p className="text-xs text-gray-500">Avg Response</p>
                  <p className="text-xs text-gray-400">(business hrs)</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-xl font-semibold', callbacks.unreturned_count > 0 ? 'text-red-600' : 'text-green-600')}>
                    {callbacks.unreturned_count}
                  </p>
                  <p className="text-xs text-gray-500">Unreturned</p>
                  <p className="text-xs text-gray-400">({callbacks.returned_count} returned)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unreturned Calls */}
      {hasCallbacks && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PhoneOff className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Unreturned Calls ({callbacks!.unreturned_count})
            </h3>
          </div>
          <div className="space-y-2">
            {callbacks!.unreturned_calls.slice(0, 10).map((call, i) => {
              const urg = urgencyColor(call.hours_waiting)
              return (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={cn('w-2.5 h-2.5 rounded-full', urg.dot)} />
                    <span className="text-sm font-medium text-gray-900">{formatPhone(call.caller_number)}</span>
                    {call.source && (
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{call.source}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-medium', urg.text)}>
                      {call.hours_waiting < 1 ? '<1' : call.hours_waiting} hrs
                    </span>
                    <a
                      href={`tel:${call.caller_number}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                    >
                      Call Back
                    </a>
                  </div>
                </div>
              )
            })}
            {callbacks!.unreturned_calls.length > 10 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                + {callbacks!.unreturned_calls.length - 10} more unreturned calls
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom row: SMS Summary + Missed Calls by Hour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Text Messages */}
        {hasSmsData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900">Text Messages</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{smsSummary!.total}</p>
                <p className="text-xs text-gray-500 mt-1">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{smsSummary!.inbound}</p>
                <p className="text-xs text-gray-500 mt-1">Inbound</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{smsSummary!.outbound}</p>
                <p className="text-xs text-gray-500 mt-1">Outbound</p>
              </div>
            </div>
          </div>
        )}

        {/* Missed Calls by Hour */}
        {peakMissedCount > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Missed Calls by Hour</h3>
              <span className="text-xs text-red-600 font-medium">
                Peak missed: {formatHour(peakMissedHour)} ({peakMissedCount} missed)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [value, 'Missed Calls']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="missed" fill="#EF4444" radius={[2, 2, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
