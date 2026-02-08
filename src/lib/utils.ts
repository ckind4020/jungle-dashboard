import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function getScoreColor(score: number, thresholds: { green: number; yellow: number }): string {
  if (score >= thresholds.green) return 'text-emerald-600'
  if (score >= thresholds.yellow) return 'text-amber-500'
  return 'text-red-500'
}

export function getBgScoreColor(score: number, thresholds: { green: number; yellow: number }): string {
  if (score >= thresholds.green) return 'bg-emerald-50 border-emerald-200'
  if (score >= thresholds.yellow) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}
