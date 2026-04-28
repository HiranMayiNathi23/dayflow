'use client'
import { Suspense, useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, addDays, subDays, parseISO, isToday as dfIsToday } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { JournalEditor } from '@/components/journal/JournalEditor'
import { HabitList } from '@/components/habits/HabitList'
import { TodoList } from '@/components/todos/TodoList'
import { useAuth } from '@/contexts/AuthContext'
import { todayStr } from '@/lib/utils'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'

// ── Helpers ────────────────────────────────────────────────────────────────
const QUOTES = [
  'Small steps every day lead to big changes.',
  'The secret of getting ahead is getting started.',
  'Your only limit is your mind.',
  'Believe you can and you\'re halfway there.',
  'Make each day your masterpiece.',
  'Progress, not perfection.',
  'One day at a time.',
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', icon: '☀️' }
  if (h < 17) return { text: 'Good afternoon', icon: '⛅' }
  return { text: 'Good evening', icon: '🌙' }
}

// Big gradient progress ring for greeting card
function BigRing({ pct }: { pct: number }) {
  const size = 90, stroke = 7, r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F8" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#pg)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(pct, 1))}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold text-gray-900">{Math.round(pct * 100)}%</span>
        <span className="text-[9px] text-gray-400 font-semibold">done</span>
      </div>
    </div>
  )
}

// ── Main content ───────────────────────────────────────────────────────────
function TodayContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  useAuth()

  const dateParam   = searchParams.get('date') || todayStr()
  const currentDate = parseISO(dateParam)
  const isToday     = dfIsToday(currentDate)
  const isFuture    = dateParam > todayStr()

  const goTo = (d: Date) => router.push(`/today?date=${format(d, 'yyyy-MM-dd')}`)

  // Track counts from children for greeting ring + summary card
  const [habitCount, setHabitCount]   = useState({ done: 0, total: 0 })
  const [taskCount,  setTaskCount]    = useState({ done: 0, total: 0 })
  const [moodEmoji, setMoodEmoji]     = useState('😐')
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('dayflow-onboarded')
  })

  const overallPct = useMemo(() => {
    const total = habitCount.total + taskCount.total
    if (!total) return 0
    return (habitCount.done + taskCount.done) / total
  }, [habitCount, taskCount])

  const greeting = getGreeting()
  const quote    = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])

  return (
    <AppShell>
      {showOnboarding && (
        <OnboardingModal onComplete={() => {
          localStorage.setItem('dayflow-onboarded', '1')
          setShowOnboarding(false)
        }} />
      )}
      <style>{`
        @keyframes checkPop { 0%{transform:scale(1)} 50%{transform:scale(1.35)} 100%{transform:scale(1)} }
        .check-pop { animation: checkPop 0.22s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fu0{animation:fadeUp 0.4s ease 0s both}
        .fu1{animation:fadeUp 0.4s ease 0.08s both}
        .fu2{animation:fadeUp 0.4s ease 0.16s both}
        .fu3{animation:fadeUp 0.4s ease 0.24s both}
      `}</style>

      <div className="flex flex-col min-h-screen bg-[#F5F6FA] dark:bg-slate-950">

        {/* ── Gradient date header — sticky so it stays visible when scrolling ── */}
        <div className="sticky top-0 z-20 flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(120deg,#7C3AED 0%,#4F46E5 40%,#06B6D4 100%)', padding: '18px 32px' }}>
          <div className="absolute -top-8 right-20 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute -bottom-5 right-52 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

          <div className="flex items-center justify-between">
            <button onClick={() => goTo(subDays(currentDate, 1))}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: 16 }}>
              ‹
            </button>

            <div className="text-center">
              <div className="text-[11px] font-semibold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: 2 }}>
                {isToday ? '✦ TODAY' : format(currentDate, 'EEEE').toUpperCase()}
              </div>
              <label className="text-2xl font-extrabold text-white cursor-pointer flex items-center gap-2 justify-center" style={{ fontFamily: 'Georgia, serif', letterSpacing: -0.5 }}>
                {format(currentDate, 'MMMM d, yyyy')}
                <input type="date" value={dateParam}
                  onChange={(e) => e.target.value && router.push(`/today?date=${e.target.value}`)}
                  className="sr-only" />
                <CalendarDays className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </label>
              {!isToday && (
                <button onClick={() => router.push('/today')}
                  className="text-xs mt-1 transition-colors" style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ← Back to today
                </button>
              )}
            </div>

            <button onClick={() => goTo(addDays(currentDate, 1))}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: 16 }}>
              ›
            </button>
          </div>
        </div>

        {/* ── Body — stacks on mobile, side-by-side on desktop ── */}
        <div className="flex flex-col lg:flex-row gap-4 p-4 pb-24 sm:p-5 sm:pb-8 items-start">

          {/* ── Left column — grows with content ── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* Greeting + progress ring */}
            <div className="fu0 bg-white dark:bg-slate-800 rounded-2xl p-5 flex items-center gap-5" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{greeting.icon}</span>
                  <span className="font-semibold text-gray-400" style={{ fontSize: 15 }}>{greeting.text}</span>
                </div>
                <h2 className="font-extrabold text-gray-900 dark:text-gray-100 leading-tight" style={{ fontSize: 26, fontFamily: 'Georgia,serif' }}>
                  Ready to make today count?
                </h2>
                <p className="text-gray-400 mt-1.5 italic" style={{ fontSize: 14 }}>&ldquo;{quote}&rdquo;</p>
              </div>
              <BigRing pct={overallPct} />
            </div>

            {/* Journal editor */}
            <div className="fu2">
              <JournalEditor date={dateParam} isFuture={isFuture} onMoodChange={setMoodEmoji} />
            </div>
          </div>

          {/* ── Right column — full width on mobile, fixed 300px on desktop ── */}
          <div className="w-full lg:w-[300px] lg:flex-shrink-0 flex flex-col gap-4">

            {/* Habits */}
            <div className="fu0">
              <HabitList date={dateParam} isFuture={isFuture} onCountChange={(d, t) => setHabitCount({ done: d, total: t })} />
            </div>

            {/* Tasks */}
            <div className="fu1">
              <TodoList date={dateParam} isFuture={isFuture} onCountChange={(d, t) => setTaskCount({ done: d, total: t })} />
            </div>

            {/* Summary gradient card */}
            <div className="fu3 rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5,#06B6D4)', boxShadow: '0 4px 20px rgba(124,58,237,0.25)' }}>
              <div className="absolute -top-5 -right-3 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <p className="font-bold tracking-widest mb-3" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>TODAY&apos;S SUMMARY</p>
              <div className="flex gap-3">
                {[
                  { val: `${habitCount.done}/${habitCount.total}`, label: 'Habits' },
                  { val: `${taskCount.done}/${taskCount.total}`,   label: 'Tasks'  },
                  { val: moodEmoji,                                label: 'Mood'   },
                ].map((s) => (
                  <div key={s.label} className="flex-1 text-center">
                    <div className="font-extrabold text-white leading-tight" style={{ fontSize: 22 }}>{s.val}</div>
                    <div className="font-medium mt-1" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function TodayPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      }>
        <TodayContent />
      </Suspense>
    </AuthGuard>
  )
}
