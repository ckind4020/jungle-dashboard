'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Inbox } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  meta: 'Meta Ads',
  web_form: 'Web Form',
  manual_entry: 'Manual Entry',
  referral: 'Referral',
  phone_call: 'Phone Call',
  walk_in: 'Walk-In',
  other: 'Other',
  unknown: 'Other',
}

const SOURCE_COLORS: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#A855F7',
  meta: '#A855F7',
  web_form: '#10B981',
  manual_entry: '#6B7280',
  referral: '#F59E0B',
  phone_call: '#EC4899',
  walk_in: '#6366F1',
  other: '#6B7280',
  unknown: '#6B7280',
}

interface LeadsBySourceChartProps {
  data: any[]
}

export function LeadsBySourceChart({ data }: LeadsBySourceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No leads yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add your first lead or connect an integration.</p>
        </div>
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.total - a.total)
  const totalLeads = sorted.reduce((s, r) => s + r.total, 0)
  const chartData = sorted.map(r => ({
    ...r,
    name: SOURCE_LABELS[r.source] || r.source,
    color: SOURCE_COLORS[r.source] || '#6B7280',
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12, fill: '#374151' }}
              />
              <Tooltip
                formatter={(value: any) => [value, 'Leads']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Leads</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">%</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Conv</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.source} className="border-b border-gray-50">
                  <td className="py-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[row.source] || '#6B7280' }} />
                    <span className="font-medium text-gray-900">{SOURCE_LABELS[row.source] || row.source}</span>
                  </td>
                  <td className="py-2 text-right text-gray-700">{row.total}</td>
                  <td className="py-2 text-right text-gray-500">{totalLeads > 0 ? ((row.total / totalLeads) * 100).toFixed(0) : 0}%</td>
                  <td className="py-2 text-right text-gray-500">{row.conversion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
