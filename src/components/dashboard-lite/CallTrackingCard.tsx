'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CallTrackingCardProps {
  callSummary: any
  callsByHour: number[]
  missedByHour: number[]
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

export function CallTrackingCard({ callSummary, callsByHour, missedByHour }: CallTrackingCardProps) {
  if (!callSummary || callSummary.total === 0) {
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

  const answerRate = parseFloat(callSummary.answer_rate)
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Call Volume */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h3>
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
              <p className="text-xs text-gray-500">Avg call duration: <span className="font-medium text-gray-700">{formatDuration(callSummary.avg_duration)}</span></p>
            </div>
          </div>
        </div>

        {/* Answer Rate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Answer Rate</h3>
          <div className="flex flex-col items-center justify-center">
            <p className={cn('text-5xl font-bold', rateTextColor)}>{answerRate.toFixed(0)}%</p>
            <div className="w-full mt-4 bg-gray-200 rounded-full h-3 relative">
              <div className={cn('h-3 rounded-full transition-all', rateColor)} style={{ width: `${Math.min(answerRate, 100)}%` }} />
              {/* Target line at 90% */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400" style={{ left: '90%' }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Target: 90%</p>
          </div>
        </div>
      </div>

      {/* Missed Calls by Hour */}
      {peakMissedCount > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Missed Calls by Hour</h3>
            {peakMissedCount > 0 && (
              <span className="text-xs text-red-600 font-medium">
                Peak missed: {formatHour(peakMissedHour)} ({peakMissedCount} missed)
              </span>
            )}
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
  )
}
