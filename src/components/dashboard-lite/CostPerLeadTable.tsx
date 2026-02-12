'use client'

import { DollarSign } from 'lucide-react'

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

interface CostPerLeadTableProps {
  data: any[]
}

export function CostPerLeadTable({ data }: CostPerLeadTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Per Lead by Source</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <DollarSign className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No ad campaigns tracked yet.</p>
        </div>
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.spend - a.spend)
  const totalSpend = sorted.reduce((s, r) => s + r.spend, 0)
  const totalConversions = sorted.reduce((s, r) => s + r.conversions, 0)
  const totalClicks = sorted.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = sorted.reduce((s, r) => s + r.impressions, 0)
  const overallCPL = totalConversions > 0 ? totalSpend / totalConversions : null
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Per Lead by Source</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Spend</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Leads</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">CPL</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">CTR</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const cpl = row.cpl ? parseFloat(row.cpl) : null
              const isAboveAvg = overallCPL && cpl ? cpl > overallCPL : false
              return (
                <tr key={row.source} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 font-medium text-gray-900">{SOURCE_LABELS[row.source] || row.source}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">${row.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.conversions}</td>
                  <td className={`py-2.5 px-3 text-right font-medium ${cpl ? (isAboveAvg ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>
                    {cpl ? `$${cpl.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{row.ctr}%</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="py-2.5 px-3 font-bold text-gray-900">Total</td>
              <td className="py-2.5 px-3 text-right font-bold text-gray-900">${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{totalConversions}</td>
              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{overallCPL ? `$${overallCPL.toFixed(2)}` : '—'}</td>
              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{overallCTR}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
