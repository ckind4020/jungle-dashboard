'use client'

import { useState, useMemo, ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T, index?: number) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
  highlightBestWorst?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getField(obj: any, key: string): any {
  return obj[key]
}

export default function DataTable<T>({
  data,
  columns,
  onRowClick,
  defaultSortKey,
  defaultSortDir = 'desc',
  highlightBestWorst = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey || '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = getField(a, sortKey)
      const bVal = getField(b, sortKey)
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [data, sortKey, sortDir])

  const bestWorst = useMemo(() => {
    if (!highlightBestWorst || data.length < 2) return {}
    const result: Record<string, { best: unknown; worst: unknown }> = {}
    columns.forEach(col => {
      if (!col.sortable) return
      const values = data.map(r => getField(r, col.key)).filter((v: unknown) => typeof v === 'number') as number[]
      if (values.length < 2) return
      result[col.key] = { best: Math.max(...values), worst: Math.min(...values) }
    })
    return result
  }, [data, columns, highlightBestWorst])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function getCellHighlight(key: string, value: unknown): string {
    if (!highlightBestWorst || typeof value !== 'number') return ''
    const bw = bestWorst[key]
    if (!bw) return ''
    if (value === bw.best) return 'bg-emerald-50'
    if (value === bw.worst) return 'bg-red-50'
    return ''
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'hover:bg-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-gray-900 whitespace-nowrap',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      getCellHighlight(col.key, getField(row, col.key)),
                      col.className
                    )}
                  >
                    {col.render ? col.render(row, i) : String(getField(row, col.key) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
