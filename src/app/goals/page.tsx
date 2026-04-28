'use client'
import { useState, useEffect } from 'react'
import { format, parseISO, differenceInDays, startOfWeek, eachDayOfInterval, endOfWeek, subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Goal, Habit } from '@/types'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { GoalDialog } from '@/components/goals/GoalDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Target, Link2, X, Flame, Calendar, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { isHabitActiveOnDate } from '@/lib/utils'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  active: 'default', completed: 'success', archived: 'secondary',
}

// ── Per-goal progress stats ────────────────────────────────────────────────
interface GoalProgress {
  scheduledThisWeek: number
  doneThisWeek: number
  streak: number           // consecutive days ALL linked habits done
  daysToTarget: number | null
}

function computeProgress(
  linkedHabits: Habit[],
  logs: { habit_id: string; log_date: string; completed: boolean }[],
  goal: Goal
): GoalProgress {
  if (!linkedHabits.length) return { scheduledThisWeek: 0, doneThisWeek: 0, streak: 0, daysToTarget: null }

  const today     = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(today,   { weekStartsOn: 1 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter((d) => d <= today)  // only past/today

  // This-week sessions
  let scheduled = 0, done = 0
  weekDays.forEach((day) => {
    const d = format(day, 'yyyy-MM-dd')
    linkedHabits.forEach((h) => {
      if (h.start_date > d) return
      if (h.end_date && h.end_date < d) return
      if (!isHabitActiveOnDate(h, d)) return
      scheduled++
      if (logs.some((l) => l.habit_id === h.id && l.log_date === d && l.completed)) done++
    })
  })

  // Streak — consecutive days where ALL linked & scheduled habits were done
  let streak = 0
  let cur    = new Date(today)
  for (let i = 0; i < 365; i++) {
    const d = format(cur, 'yyyy-MM-dd')
    const activeToday = linkedHabits.filter((h) => {
      if (h.start_date > d) return false
      if (h.end_date && h.end_date < d) return false
      return isHabitActiveOnDate(h, d)
    })
    if (activeToday.length === 0) { cur = new Date(cur.setDate(cur.getDate() - 1)); continue }
    const allDone = activeToday.every((h) =>
      logs.some((l) => l.habit_id === h.id && l.log_date === d && l.completed)
    )
    if (allDone) {
      streak++
      cur = subDays(cur, 1)   // date-fns subDays — no mutation
    } else if (d === format(today, 'yyyy-MM-dd')) {
      cur = subDays(cur, 1)
    } else {
      break
    }
  }

  // Days to target
  const daysToTarget = goal.target_date
    ? differenceInDays(parseISO(goal.target_date), today)
    : null

  return { scheduledThisWeek: scheduled, doneThisWeek: done, streak, daysToTarget }
}

// ── Goals page ─────────────────────────────────────────────────────────────
function GoalsContent() {
  const { user } = useAuth()
  const [goals,       setGoals]       = useState<Goal[]>([])
  const [habits,      setHabits]      = useState<Habit[]>([])
  const [goalHabits,  setGoalHabits]  = useState<Record<string, string[]>>({})
  const [logs,        setLogs]        = useState<{ habit_id: string; log_date: string; completed: boolean }[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editGoal,     setEditGoal]     = useState<Goal | undefined>()
  const [showDialog,   setShowDialog]   = useState(false)
  const [linkingGoal,  setLinkingGoal]  = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const [filter,       setFilter]       = useState<'active' | 'completed' | 'archived'>('active')

  useEffect(() => { if (!user) return; load() }, [user])

  async function load() {
    setLoading(true)

    // Fetch 90 days of logs for streak calculation
    const ninetyAgo = format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd')

    // Fetch goals first so we can filter goal_habits by user-owned goal IDs
    const goalsRes = await supabase
      .from('goals').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })

    const goalIds = (goalsRes.data ?? []).map((g: { id: string }) => g.id)

    const [habitsRes, linksRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user!.id).eq('is_archived', false).order('sort_order'),
      goalIds.length > 0
        ? supabase.from('goal_habits').select('goal_id, habit_id').in('goal_id', goalIds)
        : Promise.resolve({ data: [] }),
      supabase.from('habit_logs').select('habit_id, log_date, completed')
        .eq('user_id', user!.id).gte('log_date', ninetyAgo),
    ])

    setGoals(goalsRes.data ?? [])
    setHabits(habitsRes.data ?? [])
    setLogs(logsRes.data ?? [])

    const map: Record<string, string[]> = {}
    linksRes.data?.forEach((l) => {
      if (!map[l.goal_id]) map[l.goal_id] = []
      map[l.goal_id].push(l.habit_id)
    })
    setGoalHabits(map)
    setLoading(false)
  }

  async function deleteGoal(goal: Goal) {
    await supabase.from('goal_habits').delete().eq('goal_id', goal.id)
    await supabase.from('goals').delete().eq('id', goal.id)
    setDeleteTarget(null)
    load()
  }

  async function toggleHabitLink(goalId: string, habitId: string) {
    const current = goalHabits[goalId] ?? []
    if (current.includes(habitId)) {
      await supabase.from('goal_habits').delete().eq('goal_id', goalId).eq('habit_id', habitId)
      setGoalHabits((p) => ({ ...p, [goalId]: current.filter((id) => id !== habitId) }))
    } else {
      await supabase.from('goal_habits').insert({ goal_id: goalId, habit_id: habitId })
      setGoalHabits((p) => ({ ...p, [goalId]: [...current, habitId] }))
    }
  }

  const filtered = goals.filter((g) => g.status === filter)

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 px-4 pt-4 pb-24 sm:px-6 sm:pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-md">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-800">Goals</h1>
              <p className="text-sm text-gray-500">Track what matters most</p>
            </div>
          </div>
          <Button onClick={() => { setEditGoal(undefined); setShowDialog(true) }}
            className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> New goal
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1 mb-5 max-w-xs">
          {(['active', 'completed', 'archived'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg capitalize transition-all ${
                filter === s ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* Goals list */}
        {loading ? (
          <div className="text-gray-400 py-12 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-amber-100 shadow-sm">
            <Target className="h-10 w-10 text-amber-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No {filter} goals yet</p>
            {filter === 'active' && (
              <Button className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => { setEditGoal(undefined); setShowDialog(true) }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add your first goal
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {filtered.map((goal) => {
              const linkedIds     = goalHabits[goal.id] ?? []
              const linkedHabits  = linkedIds.map((hid) => habits.find((h) => h.id === hid)).filter(Boolean) as Habit[]
              const isLinking     = linkingGoal === goal.id
              const progress      = computeProgress(linkedHabits, logs, goal)
              const weekPct       = progress.scheduledThisWeek > 0
                ? progress.doneThisWeek / progress.scheduledThisWeek
                : 0
              const isOnTrack     = weekPct >= 0.7

              return (
                <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Goal info — no longer clickable to edit, use buttons instead */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-gray-800">{goal.title}</p>
                        {goal.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{goal.description}</p>
                        )}
                        {goal.target_date && (
                          <p className="text-sm text-amber-600 mt-1 font-medium">
                            Target: {format(parseISO(goal.target_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant={STATUS_VARIANT[goal.status]} className="capitalize text-xs">{goal.status}</Badge>
                        {/* Edit */}
                        <button onClick={() => { setEditGoal(goal); setShowDialog(true) }}
                          title="Edit goal"
                          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-amber-50 transition-colors">
                          <Pencil className="h-4 w-4 text-amber-500" />
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeleteTarget(goal)}
                          title="Delete goal permanently"
                          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Progress section (only when habits are linked) ── */}
                  {linkedHabits.length > 0 && (
                    <div className="px-5 pb-4 border-t border-gray-50">

                      {/* Stats row */}
                      <div className="flex items-center gap-4 py-3">

                        {/* This week bar */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                              This week
                            </span>
                            <span className="text-xs font-bold" style={{ color: isOnTrack ? '#6AB04C' : '#FF6B6B' }}>
                              {progress.doneThisWeek}/{progress.scheduledThisWeek} sessions
                              {progress.scheduledThisWeek > 0 && ` (${Math.round(weekPct * 100)}%)`}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${weekPct * 100}%`,
                                background: isOnTrack
                                  ? 'linear-gradient(90deg,#6AB04C,#34d399)'
                                  : 'linear-gradient(90deg,#FF6B6B,#fbbf24)',
                              }} />
                          </div>
                          <p className="text-xs mt-1" style={{ color: isOnTrack ? '#6AB04C' : '#FF6B6B' }}>
                            {progress.scheduledThisWeek === 0
                              ? 'No habits scheduled yet this week'
                              : isOnTrack
                                ? '✓ On track'
                                : 'Behind — keep going!'}
                          </p>
                        </div>

                        {/* Streak */}
                        <div className="flex-shrink-0 text-center bg-amber-50 rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-1 justify-center">
                            <Flame className="h-4 w-4 text-orange-400" />
                            <span className="text-xl font-extrabold text-orange-500">{progress.streak}</span>
                          </div>
                          <p className="text-[10px] font-bold text-orange-300 uppercase tracking-wide mt-0.5">day streak</p>
                        </div>

                        {/* Days to target */}
                        {progress.daysToTarget !== null && (
                          <div className="flex-shrink-0 text-center bg-violet-50 rounded-xl px-4 py-2.5">
                            <div className="flex items-center gap-1 justify-center">
                              <Calendar className="h-4 w-4 text-violet-400" />
                              <span className="text-xl font-extrabold text-violet-600">
                                {progress.daysToTarget < 0 ? 'Past' : progress.daysToTarget}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wide mt-0.5">
                              {progress.daysToTarget < 0 ? 'overdue' : 'days left'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Linked habits section ── */}
                  <div className={`px-5 pb-4 ${linkedHabits.length > 0 ? '' : 'border-t border-gray-50 pt-3'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Linked Habits</p>
                      </div>
                      <button onClick={() => setLinkingGoal(isLinking ? null : goal.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-700 transition-colors">
                        {isLinking ? <><X className="h-3 w-3" /> Done</> : <><Link2 className="h-3 w-3" /> Link habit</>}
                      </button>
                    </div>

                    {/* Linked habit pills */}
                    {linkedHabits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {linkedHabits.map((h) => (
                          <div key={h.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: `${h.color}15`, color: h.color, border: `1px solid ${h.color}30` }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                            {h.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Habit picker when linking */}
                    {isLinking && (
                      <div className="flex flex-wrap gap-1.5 mt-2 p-3 bg-gray-50 rounded-xl">
                        <p className="w-full text-xs text-gray-400 mb-1">Tap to link/unlink habits:</p>
                        {habits.map((h) => {
                          const isLinked = linkedIds.includes(h.id)
                          return (
                            <button key={h.id} onClick={() => toggleHabitLink(goal.id, h.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                              style={{
                                background: isLinked ? `${h.color}20` : 'white',
                                color: isLinked ? h.color : '#6B7280',
                                border: `1.5px solid ${isLinked ? h.color : '#E5E7EB'}`,
                              }}>
                              <div className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                              {h.name} {isLinked && '✓'}
                            </button>
                          )
                        })}
                        {habits.length === 0 && (
                          <p className="text-xs text-gray-400">No habits yet — add some on the Habits page</p>
                        )}
                      </div>
                    )}

                    {linkedHabits.length === 0 && !isLinking && (
                      <p className="text-xs text-gray-300">
                        Link habits to track progress toward this goal automatically
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <GoalDialog open={showDialog}
          onClose={() => { setShowDialog(false); setEditGoal(undefined) }}
          onSave={() => { setShowDialog(false); setEditGoal(undefined); load() }}
          goal={editGoal} />

        <ConfirmDialog
          open={deleteTarget !== null}
          title="Delete goal permanently?"
          message={`"${deleteTarget?.title}" and all its linked habits will be removed forever. This cannot be undone.`}
          confirmLabel="Yes, delete"
          onConfirm={() => deleteTarget && deleteGoal(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AppShell>
  )
}

export default function GoalsPage() {
  return <AuthGuard><GoalsContent /></AuthGuard>
}
