import { supabase } from './supabase'

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines   = rows.map((r) =>
    headers.map((h) => {
      const val = r[h] ?? ''
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    }).join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export async function exportAllData(userId: string) {
  const [journals, habits, habitLogs, todos, goals, sleep, screen] = await Promise.all([
    supabase.from('journal_entries').select('*').eq('user_id', userId).order('entry_date'),
    supabase.from('habits').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('habit_logs').select('*').eq('user_id', userId).order('log_date'),
    supabase.from('todos').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('sleep_logs').select('*').eq('user_id', userId).order('log_date'),
    supabase.from('screen_time_logs').select('*').eq('user_id', userId).order('log_date'),
  ])

  const date = new Date().toISOString().slice(0, 10)

  if (journals.data?.length)  downloadCSV(toCSV(journals.data),  `dayflow-journal-${date}.csv`)
  if (habits.data?.length)    downloadCSV(toCSV(habits.data),    `dayflow-habits-${date}.csv`)
  if (habitLogs.data?.length) downloadCSV(toCSV(habitLogs.data), `dayflow-habit-logs-${date}.csv`)
  if (todos.data?.length)     downloadCSV(toCSV(todos.data),     `dayflow-tasks-${date}.csv`)
  if (goals.data?.length)     downloadCSV(toCSV(goals.data),     `dayflow-goals-${date}.csv`)
  if (sleep.data?.length)     downloadCSV(toCSV(sleep.data),     `dayflow-sleep-${date}.csv`)
  if (screen.data?.length)    downloadCSV(toCSV(screen.data),    `dayflow-screen-time-${date}.csv`)
}
