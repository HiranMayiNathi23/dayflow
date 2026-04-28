'use client'
import { useState, useEffect } from 'react'
import { DndContext, closestCenter, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Habit } from '@/types'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { HabitDialog } from '@/components/habits/HabitDialog'
import { SortableHabit } from '@/components/habits/SortableHabit'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Repeat } from 'lucide-react'

function HabitsContent() {
  const { user } = useAuth()
  const [habits,       setHabits]       = useState<Habit[]>([])
  const [loading,      setLoading]      = useState(true)
  const [editHabit,    setEditHabit]    = useState<Habit | undefined>()
  const [showDialog,   setShowDialog]   = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => { if (!user) return; load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('habits').select('*').eq('user_id', user!.id).order('sort_order')
    setHabits(data ?? [])
    setLoading(false)
  }

  async function toggleArchive(habit: Habit) {
    await supabase.from('habits').update({ is_archived: !habit.is_archived }).eq('id', habit.id)
    load()
  }

  async function deleteHabit(habit: Habit) {
    await supabase.from('habit_logs').delete().eq('habit_id', habit.id)
    await supabase.from('habits').delete().eq('id', habit.id)
    setDeleteTarget(null)
    load()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeHabits = habits.filter((h) => !h.is_archived)
    const oldIdx = activeHabits.findIndex((h) => h.id === active.id)
    const newIdx = activeHabits.findIndex((h) => h.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(activeHabits, oldIdx, newIdx)

    // Update local state immediately
    const archived = habits.filter((h) => h.is_archived)
    setHabits([...reordered, ...archived])

    // Persist new order to Supabase
    await Promise.all(
      reordered.map((h, i) => supabase.from('habits').update({ sort_order: i + 1 }).eq('id', h.id))
    )
  }

  const active   = habits.filter((h) => !h.is_archived)
  const archived = habits.filter((h) => h.is_archived)
  const shown    = showArchived ? archived : active

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-4 pb-24 sm:px-6 sm:pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-md">
              <Repeat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-800 dark:text-gray-100">Habits</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{active.length} active habit{active.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button onClick={() => { setEditHabit(undefined); setShowDialog(true) }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm gap-2">
            <Plus className="h-4 w-4" /> New habit
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 dark:bg-gray-800 rounded-xl p-1 mb-5 max-w-xs">
          <button onClick={() => setShowArchived(false)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
              !showArchived ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}>
            Active ({active.length})
          </button>
          <button onClick={() => setShowArchived(true)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
              showArchived ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}>
            Archived ({archived.length})
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 py-12 text-center">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 text-center border border-emerald-100 dark:border-emerald-900 shadow-sm">
            <Repeat className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">{showArchived ? 'No archived habits' : 'No habits yet — start building your routine!'}</p>
            {!showArchived && (
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => { setEditHabit(undefined); setShowDialog(true) }}>
                <Plus className="h-4 w-4 mr-1.5" /> Create your first habit
              </Button>
            )}
          </div>
        ) : (
          <>
            {!showArchived && (
              <p className="text-xs text-gray-400 dark:text-gray-600 mb-2 flex items-center gap-1">
                ☰ Drag to reorder
              </p>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden w-full">
              {showArchived ? (
                archived.map((habit, i) => (
                  <SortableHabit key={habit.id} habit={habit} isArchived
                    onEdit={() => { setEditHabit(habit); setShowDialog(true) }}
                    onToggleArchive={() => toggleArchive(habit)}
                    onDelete={() => setDeleteTarget(habit)}
                    isLast={i === archived.length - 1} />
                ))
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={active.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                    {active.map((habit, i) => (
                      <SortableHabit key={habit.id} habit={habit} isArchived={false}
                        onEdit={() => { setEditHabit(habit); setShowDialog(true) }}
                        onToggleArchive={() => toggleArchive(habit)}
                        onDelete={() => setDeleteTarget(habit)}
                        isLast={i === active.length - 1} />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </>
        )}

        <HabitDialog open={showDialog}
          onClose={() => { setShowDialog(false); setEditHabit(undefined) }}
          onSave={() => { setShowDialog(false); setEditHabit(undefined); load() }}
          habit={editHabit} />

        <ConfirmDialog
          open={deleteTarget !== null}
          title="Delete habit permanently?"
          message={`"${deleteTarget?.name}" and all its history will be removed forever. This cannot be undone.`}
          confirmLabel="Yes, delete"
          onConfirm={() => deleteTarget && deleteHabit(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AppShell>
  )
}

export default function HabitsPage() {
  return <AuthGuard><HabitsContent /></AuthGuard>
}
