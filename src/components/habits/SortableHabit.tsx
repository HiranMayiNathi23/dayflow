'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Habit } from '@/types'
import { Pencil, Trash2, RotateCcw, GripVertical, Archive } from 'lucide-react'

interface SortableHabitProps {
  habit: Habit
  isArchived: boolean
  onEdit: () => void
  onToggleArchive: () => void
  onDelete: () => void
  isLast: boolean
}

function getFrequencyLabel(habit: Habit): string {
  if (!habit.frequency || habit.frequency === 'daily') return 'Every day'
  if (habit.frequency === 'weekly' && habit.week_days?.length)
    return habit.week_days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
  if (habit.frequency === 'monthly' && habit.month_days?.length)
    return habit.month_days.map((d) => (d === 'last' ? 'Last day' : `Day ${d}`)).join(', ')
  return 'Every day'
}

function getFrequencyColor(habit: Habit): string {
  if (!habit.frequency || habit.frequency === 'daily') return '#F97316'
  if (habit.frequency === 'weekly') return '#06B6D4'
  return '#7C3AED'
}

export function SortableHabit({ habit, isArchived, onEdit, onToggleArchive, onDelete, isLast }: SortableHabitProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-4 px-5 py-4 bg-white dark:bg-gray-800 ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>

      {/* Drag handle — only for active habits */}
      {!isArchived && (
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 touch-none flex-shrink-0">
          <GripVertical className="h-5 w-5" />
        </button>
      )}

      {/* Color dot */}
      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100 leading-snug">{habit.name}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-sm text-gray-400 dark:text-gray-500">
            From {habit.start_date ?? '—'}{habit.end_date ? ` → Until ${habit.end_date}` : ' → Ongoing'}
          </span>
          <span className="text-sm font-semibold" style={{ color: getFrequencyColor(habit) }}>
            {getFrequencyLabel(habit)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        {!isArchived && (
          <>
            {/* Edit */}
            <button onClick={onEdit} title="Edit habit"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-all"
              style={{ background: '#F5F6FA' }}>
              <Pencil className="h-4 w-4 text-amber-500" />
            </button>
            {/* Archive */}
            <button onClick={onToggleArchive} title="Archive habit (hide temporarily)"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-all"
              style={{ background: '#F5F6FA' }}>
              <Archive className="h-4 w-4 text-gray-400" />
            </button>
          </>
        )}
        {isArchived && (
          <button onClick={onToggleArchive} title="Restore habit"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-all"
            style={{ background: '#F5F6FA' }}>
            <RotateCcw className="h-4 w-4 text-emerald-500" />
          </button>
        )}
        {/* Delete permanently */}
        <button onClick={onDelete} title="Delete permanently"
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-all hover:bg-red-50"
          style={{ background: '#F5F6FA' }}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>
    </div>
  )
}
