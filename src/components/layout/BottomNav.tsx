'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, CalendarDays, Target, Repeat, Moon, Smartphone, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const NAV_ITEMS = [
  { href: '/today',       label: 'Today',    icon: BookOpen,    color: 'text-violet-600', activeBg: 'bg-violet-100' },
  { href: '/calendar',    label: 'Calendar', icon: CalendarDays,color: 'text-pink-600',   activeBg: 'bg-pink-100'   },
  { href: '/habits',      label: 'Habits',   icon: Repeat,      color: 'text-emerald-600',activeBg: 'bg-emerald-100'},
  { href: '/weekly',      label: 'Review',   icon: BarChart2,   color: 'text-cyan-600',   activeBg: 'bg-cyan-100'   },
  { href: '/sleep',       label: 'Sleep',    icon: Moon,        color: 'text-indigo-600', activeBg: 'bg-indigo-100' },
  { href: '/screen-time', label: 'Screen',   icon: Smartphone,  color: 'text-orange-600', activeBg: 'bg-orange-100' },
  { href: '/goals',       label: 'Goals',    icon: Target,      color: 'text-amber-600',  activeBg: 'bg-amber-100'  },
]

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const router   = useRouter()

  const initial = user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <>
      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe sm:hidden">
        <div className="flex justify-around items-center h-16 overflow-x-auto px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, color, activeBg }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[52px] flex-shrink-0',
                  active ? `${activeBg} ${color}` : 'text-gray-400'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] font-semibold">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden sm:flex fixed left-0 top-0 bottom-0 w-60 flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-white/10 z-40 shadow-sm">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 flex items-center justify-center shadow-md">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-serif font-bold bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent">
              Dayflow
            </span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, color, activeBg }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-base font-semibold cursor-pointer',
                  active ? `${activeBg} ${color}` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? color : '')} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User avatar */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-teal-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{user?.email}</p>
              <p className="text-[10px] text-gray-400">Profile</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}
