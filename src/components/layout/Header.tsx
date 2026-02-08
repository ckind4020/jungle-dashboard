'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Corporate Dashboard',
  '/ranker': 'Franchise Rankings',
  '/marketing': 'Marketing Dashboard',
  '/compliance': 'Compliance Overview',
  '/actions': 'Action Items',
}

export default function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || (pathname.startsWith('/locations/') ? 'Location Detail' : 'Dashboard')

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center px-8">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    </header>
  )
}
