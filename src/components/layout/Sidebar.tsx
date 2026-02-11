'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Trophy, Megaphone, ShieldCheck, Zap, MapPin, Menu, X, Settings, Plus, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LocationLink {
  id: string
  name: string
  slug: string
}

interface ActionSummary {
  total: number
  critical: number
  high: number
}

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Rankings', path: '/ranker', icon: Trophy },
  { label: 'Marketing', path: '/marketing', icon: Megaphone },
  { label: 'Compliance', path: '/compliance', icon: ShieldCheck },
  { label: 'Action Items', path: '/actions', icon: Zap },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [locations, setLocations] = useState<LocationLink[]>([])
  const [actionSummary, setActionSummary] = useState<ActionSummary | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    fetch('/api/manage/locations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLocations(data.map((l: LocationLink) => ({
            id: l.id,
            name: l.name,
            slug: l.slug || l.id,
          })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/actions?status=open,in_progress')
      .then(res => res.json())
      .then(data => {
        if (data.summary) {
          setActionSummary({
            total: data.summary.total,
            critical: data.summary.critical,
            high: data.summary.high,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const getBadgeColor = () => {
    if (!actionSummary || actionSummary.total === 0) return ''
    if (actionSummary.critical > 0) return 'bg-red-500'
    if (actionSummary.high > 0) return 'bg-orange-500'
    return 'bg-yellow-500'
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="palm tree">🌴</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Jungle Driving School</h1>
            <p className="text-xs text-gray-400">Franchise OS</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.path
            const isActionItems = item.path === '/actions'
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                {isActionItems && actionSummary && actionSummary.total > 0 && (
                  <span className={cn(
                    'ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white',
                    getBadgeColor()
                  )}>
                    {actionSummary.total}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <div className="mt-8 px-3">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Locations
          </p>
          {locations.length > 0 ? (
            <div className="space-y-1">
              {locations.map(loc => {
                const isActive = pathname.startsWith(`/hub/${loc.id}`) || pathname.startsWith(`/leads/${loc.id}`) || pathname.startsWith(`/locations/${loc.id}`) || pathname.startsWith(`/automations/${loc.id}`)
                return (
                  <Link
                    key={loc.id}
                    href={`/hub/${loc.id}`}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    )}
                  >
                    <MapPin className="w-4 h-4" />
                    {loc.name}
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="px-3 space-y-2">
              <p className="text-xs text-gray-500">No locations yet</p>
              <Link href="/manage" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add your first location
              </Link>
            </div>
          )}
        </div>

        {/* Manage & Admin links */}
        <div className="mt-6 px-3 space-y-1">
          <Link
            href="/manage"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/manage'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            )}
          >
            <Settings className="w-4 h-4" />
            Manage Locations
          </Link>
          <Link
            href="/admin/fields"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/admin/fields'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            )}
          >
            <Wrench className="w-4 h-4" />
            Field Manager
          </Link>
        </div>
      </nav>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 z-50 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <span className="text-lg" role="img" aria-label="palm tree">🌴</span>
          <span className="text-sm font-bold text-white">Jungle Driving School</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full bg-gray-900 text-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white flex-col z-50">
        {sidebarContent}
      </aside>
    </>
  )
}
