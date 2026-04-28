'use client'
import { useState, useEffect, KeyboardEvent } from 'react'
import { DndContext, closestCenter, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Todo } from '@/types'
import { Ring } from '@/components/ui/ring'
import { TodoDialog } from './TodoDialog'
import { GripVertical } from 'lucide-react'

interface TodoListProps {
  date: string
  isFuture?: boolean
  onCountChange?: (done: number, total: number) => void
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low:    { bg: '#E8F5E9', text: '#388E3C' },
  medium: { bg: '#FFF3E0', text: '#E65100' },
  high:   { bg: '#FFEBEE', text: '#C62828' },
}

// ── Sortable todo row ──────────────────────────────────────────────────────
function SortableTodoRow({
  todo, isFuture, onToggle, onEdit,
}: {
  todo: Todo
  isFuture: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const pc = PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS.medium

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 py-2.5 px-3 min-h-[48px] rounded-xl -mx-1"
      style={{
        background: '#FAFBFD', border: '1.5px solid #F0F0F5', marginBottom: 4,
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto',
      }}
    >
      {/* Drag handle */}
      {!isFuture && (
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none flex-shrink-0 p-0.5">
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          background: todo.is_done ? '#06B6D4' : 'white',
          border: `2px solid ${todo.is_done ? '#06B6D4' : '#D1D5DB'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isFuture ? 'not-allowed' : 'pointer', transition: 'all 0.18s',
        }}>
        {todo.is_done && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
      </div>

      {/* Title + notes */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div style={{ fontSize: 15, fontWeight: 500, color: todo.is_done ? '#9CA3AF' : '#374151', textDecoration: todo.is_done ? 'line-through' : 'none' }}>
          {todo.title}
        </div>
        {todo.notes && (
          <div style={{ fontSize: 13, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {todo.notes}
          </div>
        )}
      </div>

      {/* Priority badge */}
      <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: pc.bg, color: pc.text, flexShrink: 0 }}>
        {todo.priority}
      </span>
    </div>
  )
}

// ── Main TodoList ──────────────────────────────────────────────────────────
export function TodoList({ date, isFuture = false, onCountChange }: TodoListProps) {
  const { user } = useAuth()
  const [todos,      setTodos]      = useState<Todo[]>([])
  const [quickAdd,   setQuickAdd]   = useState('')
  const [loading,    setLoading]    = useState(true)
  const [editTodo,   setEditTodo]   = useState<Todo | undefined>()
  const [showDialog, setShowDialog] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => { if (!user) return; load() }, [user, date])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('todos').select('*')
      .eq('user_id', user!.id).eq('due_date', date)
      .order('sort_order').order('created_at')
    setTodos(data ?? [])
    setLoading(false)
    const rows = data ?? []
    onCountChange?.(rows.filter((t) => t.is_done).length, rows.length)
  }

  async function toggleDone(todo: Todo) {
    if (isFuture) return
    const next    = !todo.is_done
    const updated = todos.map((t) => t.id === todo.id ? { ...t, is_done: next } : t)
    setTodos(updated)
    onCountChange?.(updated.filter((t) => t.is_done).length, updated.length)
    await supabase.from('todos').update({ is_done: next }).eq('id', todo.id)
  }

  async function addQuick() {
    if (!user || !quickAdd.trim()) return
    const title = quickAdd.trim()
    setQuickAdd('')
    const maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0)
    const { data: row } = await supabase.from('todos')
      .insert({ user_id: user.id, title, due_date: date, is_done: false, priority: 'medium', sort_order: maxOrder + 1 })
      .select().single()
    if (row) {
      const updated = [...todos, row]
      setTodos(updated)
      onCountChange?.(updated.filter((t) => t.is_done).length, updated.length)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = todos.findIndex((t) => t.id === active.id)
    const newIdx = todos.findIndex((t) => t.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(todos, oldIdx, newIdx)
    setTodos(reordered)
    onCountChange?.(reordered.filter((t) => t.is_done).length, reordered.length)

    // Save new order
    await Promise.all(
      reordered.map((t, i) => supabase.from('todos').update({ sort_order: i + 1 }).eq('id', t.id))
    )
  }

  const done  = todos.filter((t) => t.is_done).length
  const total = todos.length
  const pct   = total ? done / total : 0

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <Ring pct={pct} color="#06B6D4" size={32} stroke={3} />
        <div>
          <div className="font-bold text-gray-900" style={{ fontSize: 17 }}>Tasks</div>
          <div className="text-gray-400" style={{ fontSize: 13 }}>{done}/{total} done</div>
        </div>
        <button onClick={() => { setEditTodo(undefined); setShowDialog(true) }}
          style={{
            marginLeft: 'auto', width: 28, height: 28, border: 'none',
            background: 'linear-gradient(135deg,#06B6D4,#0891B2)',
            borderRadius: 8, color: 'white', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}>+</button>
      </div>

      {/* Future banner */}
      {isFuture && (
        <div className="mx-4 my-2 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2"
          style={{ background: '#FFF6EE', border: '1px solid #FBBF24', color: '#D97706' }}>
          <span>📅</span> You can schedule tasks but cannot mark them done yet
        </div>
      )}

      {/* Quick add */}
      <div className="px-4 py-3 border-b flex gap-2" style={{ borderColor: '#F3F4F8' }}>
        <input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addQuick()}
          placeholder="Quick add task…"
          disabled={isFuture}
          style={{
            flex: 1, border: '1.5px solid #EEE', borderRadius: 10,
            padding: '8px 12px', fontSize: 13, outline: 'none',
            background: '#FAFBFD', opacity: isFuture ? 0.5 : 1,
          }} />
        <button onClick={addQuick} disabled={!quickAdd.trim() || isFuture}
          style={{
            background: 'linear-gradient(135deg,#06B6D4,#0891B2)', border: 'none',
            borderRadius: 10, padding: '8px 14px', color: 'white',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
            opacity: !quickAdd.trim() || isFuture ? 0.6 : 1,
          }}>Add</button>
      </div>

      {/* Hint */}
      {todos.length > 1 && !isFuture && (
        <p className="text-xs text-gray-300 text-center pt-2 pb-0">
          ☰ Drag to reorder
        </p>
      )}

      {/* Todo rows with drag */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="text-sm text-gray-400 py-2">Loading…</div>
        ) : todos.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4">No tasks yet!</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {todos.map((todo) => (
                <SortableTodoRow
                  key={todo.id}
                  todo={todo}
                  isFuture={isFuture}
                  onToggle={() => toggleDone(todo)}
                  onEdit={() => { setEditTodo(todo); setShowDialog(true) }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <TodoDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditTodo(undefined) }}
        onSave={() => { setShowDialog(false); setEditTodo(undefined); load() }}
        todo={editTodo}
        defaultDate={date}
      />
    </div>
  )
}
