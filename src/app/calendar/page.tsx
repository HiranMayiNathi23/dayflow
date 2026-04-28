'use client'
import { useState, useEffect, useMemo } from 'react'
import { addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getDaysInMonth } from 'date-fns'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { isHabitActiveOnDate } from '@/lib/utils'
import type { Habit } from '@/types'

// ── Three-ring SVG per day ─────────────────────────────────────────────────
function DayRings({
  habits, tasks, journal, size, isFuture,
}: {
  habits: number; tasks: number; journal: number
  size: number; isFuture: boolean
}) {
  const cx = size / 2, cy = size / 2
  const rings = [
    { r: size * 0.40, stroke: 3.5, pct: habits,  color: '#7C3AED', track: '#EDE9FE', alwaysTrack: true  },
    { r: size * 0.28, stroke: 3,   pct: tasks,   color: '#06B6D4', track: '#E0F7FA', alwaysTrack: true  },
    // Journal: only show the ring (including its background track) when a journal entry exists
    { r: size * 0.16, stroke: 2.5, pct: journal, color: '#F59E0B', track: '#FEF3C7', alwaysTrack: false },
  ]
  return (
    <svg width={size} height={size}>
      {rings.map((rg, i) => {
        const circ   = 2 * Math.PI * rg.r
        const offset = circ * (1 - (isFuture ? 0 : rg.pct))
        // Hide journal ring entirely if pct is 0 and it's not always shown
        if (!rg.alwaysTrack && rg.pct === 0 && !isFuture) return null
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={rg.r} fill="none"
              stroke={isFuture ? '#F0F0F5' : rg.track} strokeWidth={rg.stroke} />
            {!isFuture && rg.pct > 0 && (
              <circle cx={cx} cy={cy} r={rg.r} fill="none"
                stroke={rg.color} strokeWidth={rg.stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────
interface DayData { habits: number; tasks: number; journal: number }

// ── Calendar page ─────────────────────────────────────────────────────────
function CalendarContent() {
  const { user }  = useAuth()
  const router    = useRouter()
  const now       = new Date()

  const [month,    setMonth]    = useState(new Date())
  const [selected, setSelected] = useState(now.getDate())
  const [dayData,  setDayData]  = useState<Record<number, DayData>>({})
  const [ringSize, setRingSize] = useState(62)

  useEffect(() => {
    function updateSize() { setRingSize(window.innerWidth < 1024 ? 44 : 62) }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const isCurrentMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()
  const todayDay = now.getDate()

  useEffect(() => {
    if (!user) return
    loadMonth()
  }, [user, month])

  async function loadMonth() {
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end   = format(endOfMonth(month),   'yyyy-MM-dd')
    const mo    = month.getMonth()
    void mo

    const [journalRes, habitsRes, logsRes, todosRes] = await Promise.all([
      supabase.from('journal_entries').select('entry_date')
        .eq('user_id', user!.id).gte('entry_date', start).lte('entry_date', end)
        .neq('content', ''),  // only count entries where text was actually written
      supabase.from('habits').select('id, start_date, end_date, frequency, week_days, month_days')
        .eq('user_id', user!.id).eq('is_archived', false),
      supabase.from('habit_logs').select('log_date, habit_id')
        .eq('user_id', user!.id).eq('completed', true).gte('log_date', start).lte('log_date', end),
      supabase.from('todos').select('due_date, is_done')
        .eq('user_id', user!.id).gte('due_date', start).lte('due_date', end),
    ])

    const journalSet = new Set(journalRes.data?.map((r) => r.entry_date) ?? [])
    const habits     = (habitsRes.data ?? []) as Habit[]

    const habitDoneMap: Record<string, number> = {}
    logsRes.data?.forEach((l) => { habitDoneMap[l.log_date] = (habitDoneMap[l.log_date] ?? 0) + 1 })

    const taskDone:  Record<string, number> = {}
    const taskTotal: Record<string, number> = {}
    todosRes.data?.forEach((t) => {
      if (!t.due_date) return
      taskTotal[t.due_date] = (taskTotal[t.due_date] ?? 0) + 1
      if (t.is_done) taskDone[t.due_date] = (taskDone[t.due_date] ?? 0) + 1
    })

    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
    const map: Record<number, DayData> = {}

    days.forEach((day) => {
      const d   = format(day, 'yyyy-MM-dd')
      const num = day.getDate()
      const activeHabits = habits.filter((h) => {
        if (h.start_date > d) return false
        if (h.end_date && h.end_date < d) return false
        return isHabitActiveOnDate(h, d)
      }).length

      const hDone  = habitDoneMap[d] ?? 0
      const tDone  = taskDone[d]     ?? 0
      const tTotal = taskTotal[d]    ?? 0

      map[num] = {
        habits:  activeHabits > 0 ? Math.min(hDone / activeHabits, 1) : 0,
        tasks:   tTotal > 0       ? Math.min(tDone / tTotal, 1)       : 0,
        journal: journalSet.has(d) ? 1 : 0,
      }
    })

    setDayData(map)
  }

  // Build grid cells
  const cells = useMemo(() => {
    const firstDay    = getDay(startOfMonth(month))
    const total       = getDaysInMonth(month)
    const prevTotal   = getDaysInMonth(subMonths(month, 1))
    const list: { day: number; current: boolean }[] = []
    for (let i = 0; i < firstDay; i++) list.push({ day: prevTotal - firstDay + 1 + i, current: false })
    for (let d = 1; d <= total; d++) list.push({ day: d, current: true })
    while (list.length % 7 !== 0) list.push({ day: list.length - firstDay - total + 1, current: false })
    return list
  }, [month])

  const selData: DayData = dayData[selected] ?? { habits: 0, tasks: 0, journal: 0 }
  const dayScore = Math.round(((selData.habits + selData.tasks + selData.journal) / 3) * 100)

  // Month averages
  const monthAvg = useMemo(() => {
    const vals = Object.values(dayData)
    if (!vals.length) return { habits: 0, tasks: 0, journal: 0 }
    const avg = (arr: number[]) => Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100)
    return {
      habits:  avg(vals.map((v) => v.habits)),
      tasks:   avg(vals.map((v) => v.tasks)),
      journal: avg(vals.map((v) => v.journal)),
    }
  }, [dayData])

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <AppShell>
      <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: '#F5F6FA' }}>

        {/* Gradient header */}
        <div className="flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(120deg,#7C3AED 0%,#4F46E5 40%,#06B6D4 100%)', padding: '18px 32px' }}>
          <div className="absolute rounded-full pointer-events-none" style={{ top: -30, right: 80, width: 120, height: 120, background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute rounded-full pointer-events-none" style={{ bottom: -20, right: 200, width: 80, height: 80, background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex items-center justify-between">
            <button onClick={() => setMonth((m) => subMonths(m, 1))}
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', width: 32, height: 32, borderRadius: 10, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 2 }}>📅 CALENDAR</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 800, color: 'white', letterSpacing: -0.5 }}>
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </div>
            </div>
            <button onClick={() => setMonth((m) => addMonths(m, 1))}
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', width: 32, height: 32, borderRadius: 10, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-slate-950">

          {/* Calendar grid */}
          <div className="flex-1 flex flex-col p-5 overflow-hidden">

            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 8 }}>
              {DAYS.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, paddingBottom: 8 }}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flex: 1, gap: 4 }}>
              {cells.map((cell, idx) => {
                const isCurrentM = cell.current
                const isToday    = isCurrentM && cell.day === todayDay && isCurrentMonth
                const isFuture   = isCurrentM && isCurrentMonth && cell.day > todayDay
                const isSel      = isCurrentM && cell.day === selected
                const data       = dayData[cell.day] ?? { habits: 0, tasks: 0, journal: 0 }
                const size       = ringSize

                return (
                  <div key={idx}
                    onClick={() => { if (isCurrentM && !isFuture) { setSelected(cell.day); router.push(`/today?date=${format(new Date(month.getFullYear(), month.getMonth(), cell.day), 'yyyy-MM-dd')}`) }}}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 2, borderRadius: 14, padding: '4px 2px',
                      background: isSel ? 'linear-gradient(135deg,#7C3AED0F,#06B6D40F)' : 'transparent',
                      border: isSel ? '1.5px solid #7C3AED30' : isToday ? '1.5px solid #7C3AED' : '1.5px solid transparent',
                      cursor: isCurrentM && !isFuture ? 'pointer' : 'default',
                      opacity: isCurrentM ? 1 : 0.2,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ position: 'relative', width: size, height: size }}>
                      <DayRings
                        habits={data.habits} tasks={data.tasks} journal={data.journal}
                        size={size} isFuture={isFuture}
                      />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{
                          fontSize: isToday ? 13 : 12,
                          fontWeight: isToday || isSel ? 800 : 600,
                          color: isToday ? '#7C3AED' : isFuture ? '#C8C8D8' : isCurrentM ? '#374151' : '#C0C0C8',
                        }}>{cell.day}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-5 justify-center mt-3">
              {[{ color: '#7C3AED', label: 'Habits' }, { color: '#06B6D4', label: 'Tasks' }, { color: '#F59E0B', label: 'Journal' }].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right detail panel — hidden on mobile, visible on desktop */}
          <div className="hidden lg:flex dark:bg-slate-800 dark:border-slate-700" style={{ width: 240, flexShrink: 0, borderLeft: '1px solid #EDEEF2', background: 'white', flexDirection: 'column', padding: '24px 20px', gap: 20, overflowY: 'auto' }}>

            {/* Selected day */}
            <div>
              <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>SELECTED DAY</p>
              <h2 className="text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{selected}</h2>
              <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: 13 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
            </div>

            {/* Progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Habits',  pct: selData.habits,  color: '#7C3AED', bg: '#EDE9FE', icon: '🔁' },
                { label: 'Tasks',   pct: selData.tasks,   color: '#06B6D4', bg: '#E0F7FA', icon: '✅' },
                { label: 'Journal', pct: selData.journal, color: '#F59E0B', bg: '#FEF3C7', icon: '📖' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{Math.round(item.pct * 100)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: item.bg, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.pct * 100}%`, borderRadius: 6, background: item.color, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Day Score */}
            <div style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)', borderRadius: 16, padding: 16, textAlign: 'center', boxShadow: '0 4px 16px rgba(124,58,237,0.2)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.5, marginBottom: 6 }}>DAY SCORE</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1 }}>{dayScore}%</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>overall completion</p>
            </div>

            {/* Month at a Glance */}
            <div style={{ borderTop: '1px solid #F3F4F8', paddingTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 12 }}>MONTH AT A GLANCE</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Habits',  val: monthAvg.habits,  color: '#7C3AED' },
                  { label: 'Tasks',   val: monthAvg.tasks,   color: '#06B6D4' },
                  { label: 'Journal', val: monthAvg.journal, color: '#F59E0B' },
                ].map((s) => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', background: '#F9FAFB', borderRadius: 12, padding: '10px 4px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}%</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
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

export default function CalendarPage() {
  return <AuthGuard><CalendarContent /></AuthGuard>
}
