'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Habit, HABIT_COLORS } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'

interface HabitDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  habit?: Habit
  startDate?: string
}

const today = () => format(new Date(), 'yyyy-MM-dd')

const WEEK_DAYS = [
  { key: 'monday',    label: 'Mon' },
  { key: 'tuesday',   label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday',  label: 'Thu' },
  { key: 'friday',    label: 'Fri' },
  { key: 'saturday',  label: 'Sat' },
  { key: 'sunday',    label: 'Sun' },
]

const MONTH_NUMS = Array.from({ length: 31 }, (_, i) => String(i + 1))

type Frequency = 'daily' | 'weekly' | 'monthly'

export function HabitDialog({ open, onClose, onSave, habit, startDate }: HabitDialogProps) {
  const { user } = useAuth()
  const [name, setName]                 = useState('')
  const [color, setColor]               = useState(HABIT_COLORS[5])
  const [habitStartDate, setStartDate]  = useState(startDate || today())
  const [habitEndDate, setEndDate]      = useState('')
  const [frequency, setFrequency]       = useState<Frequency>('daily')
  const [weekDays, setWeekDays]         = useState<string[]>([])
  const [monthDays, setMonthDays]       = useState<string[]>([])
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    if (!open) return
    if (habit) {
      setName(habit.name)
      setColor(habit.color)
      setStartDate(habit.start_date || today())
      setEndDate(habit.end_date ?? '')
      setFrequency((habit.frequency as Frequency) || 'daily')
      setWeekDays(habit.week_days ?? [])
      setMonthDays(habit.month_days ?? [])
    } else {
      setName('')
      setColor(HABIT_COLORS[5])
      setStartDate(startDate || today())
      setEndDate('')
      setFrequency('daily')
      setWeekDays([])
      setMonthDays([])
    }
  }, [habit, open, startDate])

  function toggleWeekDay(day: string) {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function toggleMonthDay(day: string) {
    setMonthDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function handleSave() {
    if (!user || !name.trim() || !habitStartDate) return

    // Validate frequency selections
    if (frequency === 'weekly' && weekDays.length === 0) return
    if (frequency === 'monthly' && monthDays.length === 0) return

    setSaving(true)

    const payload = {
      name:        name.trim(),
      color,
      start_date:  habitStartDate,
      end_date:    habitEndDate || null,
      frequency,
      week_days:   frequency === 'weekly'  ? weekDays  : null,
      month_days:  frequency === 'monthly' ? monthDays : null,
    }

    if (habit) {
      await supabase.from('habits').update(payload).eq('id', habit.id)
    } else {
      const { data: existing } = await supabase
        .from('habits')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      await supabase.from('habits').insert({
        ...payload,
        user_id:    user.id,
        is_archived: false,
        sort_order: (existing?.sort_order ?? 0) + 1,
      })
    }

    setSaving(false)
    onSave()
  }

  const canSave =
    name.trim() &&
    habitStartDate &&
    (frequency === 'daily' ||
     (frequency === 'weekly' && weekDays.length > 0) ||
     (frequency === 'monthly' && monthDays.length > 0))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{habit ? 'Edit Habit' : 'New Habit'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Habit name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gym, Read 25 mins, Pay bills…"
              autoFocus
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <Label>Start date <span className="text-red-400">*</span></Label>
            <Input
              type="date"
              value={habitStartDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End date — editing only */}
          {habit && (
            <div className="space-y-1.5">
              <Label>
                End date{' '}
                <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <Input
                type="date"
                value={habitEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={habitStartDate}
              />
              {habitEndDate ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-amber-600 font-medium">Stops after {habitEndDate}</p>
                  <button onClick={() => setEndDate('')} className="text-xs text-gray-400 hover:text-red-500 underline">
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-xs text-emerald-600">Ongoing — no end date</p>
              )}
            </div>
          )}

          {/* Frequency */}
          <div className="space-y-3">
            <Label>Frequency</Label>

            {/* Frequency tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { key: 'daily',   label: 'Every day' },
                { key: 'weekly',  label: 'Weekdays'  },
                { key: 'monthly', label: 'Monthly'   },
              ] as { key: Frequency; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFrequency(key)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    frequency === key
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Weekly day picker */}
            {frequency === 'weekly' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Select which days this habit runs:</p>
                <div className="flex gap-1.5">
                  {WEEK_DAYS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleWeekDay(key)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                        weekDays.includes(key)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {weekDays.length === 0 && (
                  <p className="text-xs text-red-400">Please select at least one day</p>
                )}
              </div>
            )}

            {/* Monthly day picker */}
            {frequency === 'monthly' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Select which dates of the month:</p>
                <div className="grid grid-cols-7 gap-1">
                  {MONTH_NUMS.map((num) => (
                    <button
                      key={num}
                      onClick={() => toggleMonthDay(num)}
                      className={`aspect-square text-xs font-bold rounded-lg transition-colors ${
                        monthDays.includes(num)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => toggleMonthDay('last')}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                    monthDays.includes('last')
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Last day of the month
                </button>
                {monthDays.length === 0 && (
                  <p className="text-xs text-red-400">Please select at least one date</p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
