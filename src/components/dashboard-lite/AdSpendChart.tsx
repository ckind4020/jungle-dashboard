'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'
import { BarChart3 } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCE_COLORS: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#A855F7',
  meta: '#A855F7',
  unknown: '#6B7280',
}

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  meta: 'Meta Ads',
  unknown: 'Other',
}

interface AdSpendChartProps {
  data: any[]
  locationId: string
}

export function AdSpendChart({ data, locationId }: AdSpendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Spend Over Time</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No ad spend data yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Connect Google Ads or Meta to start tracking.
          </p>
        </div>
      </div>
    )
  }

  // Detect which sources exist
  const sources = new Set<string>()
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== 'date') sources.add(key)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(val) => format(parseISO(val), 'MMM d')}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
          />
          <YAxis
            tickFormatter={(val) => `$${val}`}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
          />
          <Tooltip
            formatter={(value: any, name: any) => [`$${Number(value || 0).toFixed(2)}`, SOURCE_LABELS[name] || name]}
            labelFormatter={(label) => format(parseISO(label as string), 'MMM d, yyyy')}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend formatter={(value) => SOURCE_LABELS[value] || value} />
          {Array.from(sources).map(source => (
            <Area
              key={source}
              type="monotone"
              dataKey={source}
              stackId="1"
              stroke={SOURCE_COLORS[source] || '#6B7280'}
              fill={SOURCE_COLORS[source] || '#6B7280'}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
