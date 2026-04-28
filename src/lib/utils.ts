import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, getDate, getDaysInMonth } from 'date-fns'
import type { Habit } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDisplayDate(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy')
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy')
}

// Returns true if a habit should appear on the given date string (YYYY-MM-DD)
// considering its frequency, week_days, and month_days settings
export function isHabitActiveOnDate(habit: Habit, date: string): boolean {
  if (!habit.frequency || habit.frequency === 'daily') return true

  const d = parseISO(date)

  if (habit.frequency === 'weekly') {
    if (!habit.week_days || habit.week_days.length === 0) return true
    const dayName = format(d, 'EEEE').toLowerCase() // 'monday', 'tuesday'...
    return habit.week_days.includes(dayName)
  }

  if (habit.frequency === 'monthly') {
    if (!habit.month_days || habit.month_days.length === 0) return true
    const dayNum   = getDate(d)              // 1–31
    const lastDay  = getDaysInMonth(d)       // total days in month
    const isLast   = dayNum === lastDay
    return habit.month_days.includes(String(dayNum)) ||
           (isLast && habit.month_days.includes('last'))
  }

  return true
}
