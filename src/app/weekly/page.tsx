'use client'
import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO } from 'date-fns'
import { todayStr } from '@/lib/utils'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isHabitActiveOnDate } from '@/lib/utils'
import type { Habit } from '@/types'

const MOODS       = ['😞','😕','😐','🙂','😄']
const MOOD_LABELS = ['Rough','Meh','Okay','Good','Great']
const MOOD_COLORS = ['#FF6B6B','#FF9F43','#F9CA24','#6AB04C','#686DE0']

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const isEmpty = value === '—'
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">{label}</p>
      {isEmpty
        ? <p className="text-base font-semibold text-gray-300">Not logged yet</p>
        : <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
      }
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function WeeklyContent() {
  const { user } = useAuth()
  const [week, setWeek]           = useState(new Date())
  const [loading, setLoading]     = useState(true)
  const [hoveredMood, setHoveredMood] = useState<number | null>(null)
  const [stats, setStats] = useState({
    habitPct: 0, taskPct: 0, journalDays: 0,
    avgSleep: 0, avgScreen: 0,
    moodCounts: [0, 0, 0, 0, 0],
    moodDays:   [[], [], [], [], []] as string[][], // which day names had each mood
    habitBreakdown: [] as { name: string; color: string; pct: number }[],
    journalDates:   new Set<string>(),
    dailyHabitPct:  {} as Record<string, number>,
    dailyTaskPct:   {} as Record<string, number>,
  })

  const weekStart      = startOfWeek(week, { weekStartsOn: 1 })
  const weekEnd        = endOfWeek(week,   { weekStartsOn: 1 })
  const days           = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const isCurrentWeek  = format(weekStart, 'yyyy-MM-dd') === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  useEffect(() => { if (!user) return; load() }, [user, week])

  async function load() {
    setLoading(true)
    const start = format(weekStart, 'yyyy-MM-dd')
    const end   = format(weekEnd,   'yyyy-MM-dd')

    const [habitsRes, logsRes, todosRes, journalTextRes, moodRes, sleepRes, screenRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user!.id).eq('is_archived', false),
      supabase.from('habit_logs').select('habit_id, log_date, completed')
        .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end),
      supabase.from('todos').select('due_date, is_done')
        .eq('user_id', user!.id).gte('due_date', start).lte('due_date', end),
      // Only entries where text was actually written — for journal day count & amber dot
      supabase.from('journal_entries').select('entry_date')
        .eq('user_id', user!.id).gte('entry_date', start).lte('entry_date', end)
        .neq('content', ''),
      // All entries regardless of text — mood is saved even without writing
      supabase.from('journal_entries').select('entry_date, mood')
        .eq('user_id', user!.id).gte('entry_date', start).lte('entry_date', end),
      supabase.from('sleep_logs').select('log_date, hours')
        .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end),
      supabase.from('screen_time_logs').select('log_date, hours')
        .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end),
    ])

    const habits      = (habitsRes.data ?? []) as Habit[]
    const logs        = logsRes.data ?? []
    const todos       = todosRes.data ?? []
    const journalText = journalTextRes.data ?? []   // entries with written text
    const moodEntries = moodRes.data ?? []           // all entries (for mood)
    const sleep       = sleepRes.data ?? []
    const screen      = screenRes.data ?? []

    // ── Habit breakdown ──
    let totalScheduled = 0, totalDone = 0
    const habitBreakdown: { name: string; color: string; pct: number }[] = []
    const today = todayStr()
    habits.forEach((h) => {
      let sched = 0, done = 0
      days.forEach((day) => {
        const d = format(day, 'yyyy-MM-dd')
        if (d > today) return
        if (h.start_date > d) return
        if (h.end_date && h.end_date < d) return
        if (!isHabitActiveOnDate(h, d)) return
        sched++
        if (logs.some((l) => l.habit_id === h.id && l.log_date === d && l.completed)) done++
      })
      totalScheduled += sched
      totalDone      += done
      if (sched > 0) habitBreakdown.push({ name: h.name, color: h.color, pct: done / sched })
    })

    // ── Tasks ──
    const tasksDone  = todos.filter((t) => t.is_done).length
    const tasksTotal = todos.length

    // ── Journal (text written) ──
    const journalDays  = journalText.length
    const journalDates = new Set(journalText.map((j) => j.entry_date))

    // ── Mood (all entries, with or without text) ──
    const moodCounts: number[]    = [0, 0, 0, 0, 0]
    const moodDays:   string[][] = [[], [], [], [], []]
    moodEntries.forEach((j) => {
      if (j.mood >= 1 && j.mood <= 5) {
        moodCounts[j.mood - 1]++
        try {
          moodDays[j.mood - 1].push(format(parseISO(j.entry_date), 'EEEE'))
        } catch { /* ignore parse errors */ }
      }
    })

    // ── Daily completion % per day ──
    const dailyHabitPct: Record<string, number> = {}
    const dailyTaskPct:  Record<string, number> = {}
    days.forEach((day) => {
      const d = format(day, 'yyyy-MM-dd')
      if (d > today) return

      // Habits
      const activeOnDay = habits.filter((h) => {
        if (h.start_date > d) return false
        if (h.end_date && h.end_date < d) return false
        return isHabitActiveOnDate(h, d)
      })
      const doneOnDay = activeOnDay.filter((h) =>
        logs.some((l) => l.habit_id === h.id && l.log_date === d && l.completed)
      )
      dailyHabitPct[d] = activeOnDay.length > 0 ? doneOnDay.length / activeOnDay.length : 0

      // Tasks
      const dayTodos   = todos.filter((t) => t.due_date === d)
      dailyTaskPct[d]  = dayTodos.length > 0
        ? dayTodos.filter((t) => t.is_done).length / dayTodos.length
        : 0
    })

    // ── Sleep & Screen ──
    const avgSleep  = sleep.length  ? sleep.reduce((s, r)  => s + parseFloat(r.hours), 0)  / sleep.length  : 0
    const avgScreen = screen.length ? screen.reduce((s, r) => s + parseFloat(r.hours), 0) / screen.length : 0

    setStats({
      habitPct: totalScheduled > 0 ? totalDone / totalScheduled : 0,
      taskPct:  tasksTotal > 0     ? tasksDone / tasksTotal     : 0,
      journalDays, avgSleep, avgScreen, moodCounts, moodDays,
      habitBreakdown, journalDates, dailyHabitPct, dailyTaskPct,
    })
    setLoading(false)
  }

  const dominantMoodIdx = stats.moodCounts.indexOf(Math.max(...stats.moodCounts))

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 pb-24">

        {/* Header */}
        <div className="sticky top-0 z-20 relative overflow-hidden"
          style={{ background: 'linear-gradient(120deg,#7C3AED 0%,#4F46E5 40%,#06B6D4 100%)', padding: '18px 32px' }}>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20"
              onClick={() => setWeek((w) => subWeeks(w, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                📊 WEEKLY REVIEW
              </p>
              <p className="text-xl font-extrabold text-white" style={{ fontFamily: 'Georgia,serif' }}>
                {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
              </p>
              {isCurrentWeek && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>This week</p>}
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20"
              onClick={() => setWeek((w) => addWeeks(w, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-5 pt-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : (
            <>
              {/* Top stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Habits"  value={`${Math.round(stats.habitPct * 100)}%`} sub="completion rate" color="#7C3AED" />
                <StatCard label="Tasks"   value={`${Math.round(stats.taskPct  * 100)}%`} sub="completion rate" color="#06B6D4" />
                <StatCard label="Journal" value={`${stats.journalDays}/7`}               sub="days written"    color="#F59E0B" />
                <StatCard label="Mood"
                  value={stats.moodCounts.some((c) => c > 0) ? MOODS[dominantMoodIdx] : '—'}
                  sub={stats.moodCounts.some((c) => c > 0) ? `Mostly ${MOOD_LABELS[dominantMoodIdx]}` : 'No entries'}
                  color={MOOD_COLORS[dominantMoodIdx]} />
              </div>

              {/* Sleep & Screen */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Avg Sleep"       value={stats.avgSleep  > 0 ? `${stats.avgSleep.toFixed(1)}h`  : '—'} sub="per night" color="#5b21b6" />
                <StatCard label="Avg Screen Time" value={stats.avgScreen > 0 ? `${stats.avgScreen.toFixed(1)}h` : '—'} sub="per day"   color="#ea580c" />
              </div>

              {/* Habit breakdown */}
              {stats.habitBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-violet-500" />
                    <h2 className="font-bold text-gray-800" style={{ fontSize: 16 }}>Habit Breakdown</h2>
                  </div>
                  <div className="space-y-3">
                    {stats.habitBreakdown.sort((a, b) => b.pct - a.pct).map((h) => (
                      <div key={h.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                            <span className="text-sm font-medium text-gray-700">{h.name}</span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: h.color }}>{Math.round(h.pct * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${h.pct * 100}%`, backgroundColor: h.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Mood distribution with hover tooltip ── */}
              {stats.moodCounts.some((c) => c > 0) && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h2 className="font-bold text-gray-800 mb-1" style={{ fontSize: 16 }}>Mood This Week</h2>
                  <p className="text-xs text-gray-400 mb-4">Hover a bar to see which days</p>
                  <div className="flex gap-3">
                    {MOODS.map((emoji, i) => {
                      const isHovered = hoveredMood === i
                      const days_for_mood = stats.moodDays[i] ?? []
                      return (
                        <div key={i} className="flex-1 text-center relative"
                          onMouseEnter={() => setHoveredMood(i)}
                          onMouseLeave={() => setHoveredMood(null)}>

                          {/* Tooltip — only when hovered and has data */}
                          {isHovered && days_for_mood.length > 0 && (
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white text-xs font-semibold rounded-xl px-3 py-2 whitespace-nowrap shadow-lg pointer-events-none">
                              {days_for_mood.join(', ')}
                              {/* Arrow */}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                                style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #111827' }} />
                            </div>
                          )}

                          <div className="text-2xl mb-1">{emoji}</div>
                          <div className={`h-16 rounded-xl flex items-end justify-center overflow-hidden transition-all duration-200 cursor-pointer ${isHovered && stats.moodCounts[i] > 0 ? 'opacity-80 scale-105' : ''}`}
                            style={{ background: `${MOOD_COLORS[i]}15` }}>
                            <div className="w-full rounded-xl transition-all duration-500"
                              style={{
                                height: `${stats.moodCounts[i] > 0 ? (stats.moodCounts[i] / Math.max(...stats.moodCounts)) * 100 : 0}%`,
                                backgroundColor: MOOD_COLORS[i],
                              }} />
                          </div>
                          <p className="text-xs font-bold mt-1" style={{ color: MOOD_COLORS[i] }}>{stats.moodCounts[i]}x</p>
                          <p className="text-xs text-gray-400">{MOOD_LABELS[i]}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Daily Overview — bars for both habits and tasks ── */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800" style={{ fontSize: 16 }}>Daily Overview</h2>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 rounded-full inline-block bg-violet-500" />Habits
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 rounded-full inline-block bg-cyan-500" />Tasks
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block bg-amber-400" />Journal
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day) => {
                    const d          = format(day, 'yyyy-MM-dd')
                    const isFuture   = new Date(d) > new Date()
                    const habitPct   = stats.dailyHabitPct[d] ?? 0
                    const taskPct    = stats.dailyTaskPct[d]  ?? 0
                    const hasJournal = stats.journalDates.has(d)
                    const isToday    = d === format(new Date(), 'yyyy-MM-dd')

                    return (
                      <div key={d}
                        className={`text-center p-2 rounded-xl transition-all ${
                          isFuture ? 'opacity-25' : 'bg-gray-50'
                        } ${isToday ? 'ring-2 ring-violet-400' : ''}`}>
                        <p className="text-xs font-bold text-gray-400">{format(day, 'EEE')}</p>
                        <p className={`text-sm font-extrabold my-1 ${isToday ? 'text-violet-600' : 'text-gray-800'}`}>
                          {format(day, 'd')}
                        </p>

                        {!isFuture ? (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {/* Habit progress bar */}
                            <div title={`Habits: ${Math.round(habitPct * 100)}%`}>
                              <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                <div className="h-full rounded-full bg-violet-500 transition-all"
                                  style={{ width: `${habitPct * 100}%` }} />
                              </div>
                            </div>
                            {/* Task progress bar */}
                            <div title={`Tasks: ${Math.round(taskPct * 100)}%`}>
                              <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                <div className="h-full rounded-full bg-cyan-500 transition-all"
                                  style={{ width: `${taskPct * 100}%` }} />
                              </div>
                            </div>
                            {/* Journal dot */}
                            <div className="flex justify-center">
                              <div className="w-2 h-2 rounded-full"
                                style={{ background: hasJournal ? '#F59E0B' : '#E5E7EB' }} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 mt-1">
                            <div className="w-full h-1.5 rounded-full bg-gray-100" />
                            <div className="w-full h-1.5 rounded-full bg-gray-100" />
                            <div className="flex justify-center">
                              <div className="w-2 h-2 rounded-full bg-gray-100" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function WeeklyPage() {
  return <AuthGuard><WeeklyContent /></AuthGuard>
}
