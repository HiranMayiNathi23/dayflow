'use client'
import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Habit } from '@/types'
import { Ring } from '@/components/ui/ring'
import { HabitDialog } from './HabitDialog'
import { isHabitActiveOnDate } from '@/lib/utils'

interface HabitListProps {
  date: string
  isFuture?: boolean
  onCountChange?: (done: number, total: number) => void
}

// Count consecutive days a habit was completed going backwards from today
// Skips days the habit wasn't scheduled (frequency/weekday aware)
// Doesn't penalise if today isn't checked yet
function calculateStreak(habit: Habit, completedDates: Set<string>): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  let streak = 0
  let current = new Date()

  for (let i = 0; i < 365; i++) {
    const dateStr = format(current, 'yyyy-MM-dd')

    if (dateStr < habit.start_date) break
    if (habit.end_date && dateStr > habit.end_date) { current = subDays(current, 1); continue }
    if (!isHabitActiveOnDate(habit, dateStr))        { current = subDays(current, 1); continue }

    if (completedDates.has(dateStr)) {
      streak++
    } else if (dateStr === todayStr) {
      // Today not done yet — don't break the chain
    } else {
      break
    }
    current = subDays(current, 1)
  }
  return streak
}

export function HabitList({ date, isFuture = false, onCountChange }: HabitListProps) {
  const { user } = useAuth()
  const [habits,     setHabits]     = useState<Habit[]>([])
  const [logs,       setLogs]       = useState<Record<string, boolean>>({})
  const [streaks,    setStreaks]     = useState<Record<string, number>>({})
  const [showDialog, setShowDialog] = useState(false)
  const [animId,     setAnimId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!user) return
    load()
  }, [user, date])

  async function load() {
    setLoading(true)
    const ninetyAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd')

    const [habitsRes, logsRes, streakLogsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user!.id).eq('is_archived', false)
        .lte('start_date', date).or(`end_date.is.null,end_date.gte.${date}`).order('sort_order'),
      supabase.from('habit_logs').select('habit_id, completed').eq('user_id', user!.id).eq('log_date', date),
      // Fetch last 90 days of completed logs for streak calculation
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user!.id)
        .eq('completed', true).gte('log_date', ninetyAgo),
    ])

    const all      = (habitsRes.data ?? []) as Habit[]
    const filtered = all.filter((h) => isHabitActiveOnDate(h, date))
    setHabits(filtered)

    // Today's completion map
    const logMap: Record<string, boolean> = {}
    logsRes.data?.forEach((l) => { logMap[l.habit_id] = l.completed })
    setLogs(logMap)
    onCountChange?.(filtered.filter((h) => logMap[h.id]).length, filtered.length)

    // Build per-habit set of completed dates, then compute streak
    const completedByHabit: Record<string, Set<string>> = {}
    streakLogsRes.data?.forEach((l) => {
      if (!completedByHabit[l.habit_id]) completedByHabit[l.habit_id] = new Set()
      completedByHabit[l.habit_id].add(l.log_date)
    })
    const streakMap: Record<string, number> = {}
    filtered.forEach((h) => {
      streakMap[h.id] = calculateStreak(h, completedByHabit[h.id] ?? new Set())
    })
    setStreaks(streakMap)
    setLoading(false)
  }

  async function toggle(habitId: string) {
    if (isFuture) return
    const next = !logs[habitId]
    setAnimId(habitId)
    setTimeout(() => setAnimId(null), 300)
    // Build new state first, then call both setters outside render phase
    const newLogs = { ...logs, [habitId]: next }
    setLogs(newLogs)
    onCountChange?.(habits.filter((h) => newLogs[h.id]).length, habits.length)
    await supabase.from('habit_logs').upsert(
      { user_id: user!.id, habit_id: habitId, log_date: date, completed: next },
      { onConflict: 'habit_id,log_date' }
    )
    // Recalculate streak for this habit after toggle
    const ninetyAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd')
    const { data: sl } = await supabase.from('habit_logs').select('log_date')
      .eq('user_id', user!.id).eq('habit_id', habitId).eq('completed', true).gte('log_date', ninetyAgo)
    const completedSet = new Set((sl ?? []).map((r) => r.log_date))
    const habit = habits.find((h) => h.id === habitId)
    if (habit) setStreaks((p) => ({ ...p, [habitId]: calculateStreak(habit, completedSet) }))
  }

  const done  = habits.filter((h) => logs[h.id]).length
  const total = habits.length
  const pct   = total ? done / total : 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>

      {/* Header — no + button (use Habits page to manage habits) */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-slate-700">
        <Ring pct={pct} color="#7C3AED" size={32} stroke={3} />
        <div>
          <div className="font-bold text-gray-900 dark:text-gray-100" style={{ fontSize: 17 }}>Habits</div>
          <div className="text-gray-400 dark:text-gray-500" style={{ fontSize: 13 }}>{done}/{total} done</div>
        </div>
      </div>

      {/* Future banner */}
      {isFuture && habits.length > 0 && (
        <div className="mx-4 my-2 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
          style={{ background: '#FFF6EE', border: '1px solid #FBBF24', color: '#D97706' }}>
          <span>📅</span> Come back on this day to mark habits as done
        </div>
      )}

      {/* Habit rows */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {loading ? (
          <div className="text-sm text-gray-400 py-2">Loading…</div>
        ) : habits.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-1">{isFuture ? 'No habits scheduled' : 'No habits yet'}</p>
            <p className="text-xs text-gray-300">Go to the Habits page to add habits</p>
          </div>
        ) : habits.map((habit) => {
          const isDone  = !!logs[habit.id]
          const streak  = streaks[habit.id] ?? 0
          return (
            <div key={habit.id} onClick={() => toggle(habit.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12,
                cursor: isFuture ? 'not-allowed' : 'pointer',
                background: isDone ? `${habit.color}15` : 'var(--row-bg, #FAFBFD)',
                border: `1.5px solid ${isDone ? `${habit.color}40` : 'var(--row-border, #F0F0F5)'}`,
                opacity: isFuture ? 0.7 : 1,
                transition: 'all 0.18s',
              }}>

              {/* Animated checkbox */}
              <div className={animId === habit.id ? 'check-pop' : ''}
                style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  background: isDone ? habit.color : 'white',
                  border: `2px solid ${isDone ? habit.color : '#D1D5DB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s',
                }}>
                {isDone && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>

              {/* Color bar */}
              <div style={{ width: 3, height: 26, borderRadius: 3, background: habit.color, flexShrink: 0 }} />

              {/* Habit name */}
              <span style={{ fontSize: 15, fontWeight: 500, color: isDone ? '#9CA3AF' : 'var(--habit-text, #374151)', textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}>
                {habit.name}
              </span>

              {/* Streak badge — only shown when streak > 0 */}
              {streak > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: isDone ? `${habit.color}20` : '#FFF7ED',
                  border: `1px solid ${isDone ? `${habit.color}40` : '#FED7AA'}`,
                  borderRadius: 20, padding: '3px 8px', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13 }}>🔥</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isDone ? habit.color : '#EA580C' }}>
                    {streak}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hidden dialog still needed for Habits page usage */}
      <HabitDialog open={showDialog} onClose={() => setShowDialog(false)}
        onSave={() => { setShowDialog(false); load() }} startDate={date} />
    </div>
  )
}
