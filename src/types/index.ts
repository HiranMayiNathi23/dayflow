export interface JournalEntry {
  id: string
  user_id: string
  entry_date: string
  content: string
  mood: number
  created_at: string
  updated_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  color: string
  is_archived: boolean
  sort_order: number
  start_date: string
  end_date: string | null
  frequency: 'daily' | 'weekly' | 'monthly'
  week_days: string[] | null   // ['monday','wednesday','friday']
  month_days: string[] | null  // ['5','15'] or ['last']
  created_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  log_date: string
  completed: boolean
}

export interface Todo {
  id: string
  user_id: string
  title: string
  notes: string | null
  due_date: string | null
  is_done: boolean
  priority: 'low' | 'medium' | 'high'
  sort_order: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  target_date: string | null
  status: 'active' | 'completed' | 'archived'
  created_at: string
}

export const HABIT_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
  '#92400E',
]
