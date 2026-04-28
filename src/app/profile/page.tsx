'use client'
import { useState, useEffect } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { LogOut, Download, Loader2, Bell, BellOff } from 'lucide-react'
import { exportAllData } from '@/lib/export'

function ProfileContent() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [exporting,   setExporting]   = useState(false)
  const [exported,    setExported]    = useState(false)
  const [notifStatus, setNotifStatus] = useState<'default' | 'granted' | 'denied'>('default')
  const [reminderTime, setReminderTime] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('dayflow-reminder-time') || '20:00' : '20:00'
  )

  useEffect(() => {
    if ('Notification' in window) setNotifStatus(Notification.permission as 'default' | 'granted' | 'denied')
  }, [])

  async function requestNotifications() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifStatus(perm as 'granted' | 'denied' | 'default')
  }

  function scheduleReminder(time: string) {
    setReminderTime(time)
    localStorage.setItem('dayflow-reminder-time', time)
    if (notifStatus !== 'granted' || !('serviceWorker' in navigator)) return
    const [h, m] = time.split(':').map(Number)
    const now  = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const delayMs = next.getTime() - now.getTime()
    navigator.serviceWorker.ready.then((sw) => {
      sw.active?.postMessage({ type: 'SCHEDULE_NOTIFICATION', title: 'Dayflow Reminder 🌟', body: 'Time to log your habits and journal for today!', delayMs })
    })
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  async function handleExport() {
    if (!user) return
    setExporting(true)
    await exportAllData(user.id)
    setExporting(false)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 px-4 pt-4 pb-24 sm:px-6 sm:pt-6">
        <h1 className="text-2xl font-serif font-bold text-gray-800 mb-6">Profile</h1>

        <div className="max-w-lg space-y-4">

          {/* Account */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-teal-400 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-base">{user?.email}</p>
                <p className="text-sm text-gray-400">
                  Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-1">Reminders</h2>
            <p className="text-sm text-gray-400 mb-4">Get a daily nudge to log your habits and journal.</p>
            {notifStatus === 'granted' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-violet-500" />
                  <span className="text-sm font-medium text-gray-700 flex-1">Daily reminder at</span>
                  <input type="time" value={reminderTime}
                    onChange={(e) => scheduleReminder(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:border-violet-400" />
                </div>
                <p className="text-xs text-emerald-500 font-medium">✓ Notifications enabled</p>
              </div>
            ) : notifStatus === 'denied' ? (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <BellOff className="h-4 w-4" />
                Notifications blocked — enable them in browser settings
              </div>
            ) : (
              <Button onClick={requestNotifications} variant="outline" className="w-full gap-2">
                <Bell className="h-4 w-4" /> Enable reminders
              </Button>
            )}
          </div>

          {/* Export */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-1">Export Data</h2>
            <p className="text-sm text-gray-400 mb-4">
              Download all your data as CSV files — journal, habits, tasks, goals, sleep and screen time.
            </p>
            <Button onClick={handleExport} disabled={exporting}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              {exporting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing download…</>
                : exported
                  ? '✓ Downloaded successfully'
                  : <><Download className="h-4 w-4" /> Export all data as CSV</>}
            </Button>
          </div>

          {/* Sign out */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <Button variant="outline"
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100 gap-2"
              onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>

        </div>
      </div>
    </AppShell>
  )
}

export default function ProfilePage() {
  return <AuthGuard><ProfileContent /></AuthGuard>
}
