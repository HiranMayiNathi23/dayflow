'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { HABIT_COLORS } from '@/types'
import { format } from 'date-fns'

interface OnboardingModalProps {
  onComplete: () => void
}

const STEPS = ['welcome', 'habit', 'done'] as const
type Step = typeof STEPS[number]

const SUGGESTED_HABITS = [
  { name: 'Drink 2L of water',       color: '#48DBFB' },
  { name: 'Exercise 20 mins',         color: '#FF6B6B' },
  { name: 'Read for 15 mins',         color: '#6AB04C' },
  { name: 'Meditate for 5 mins',      color: '#686DE0' },
  { name: 'Sleep before midnight',    color: '#7C3AED' },
]

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { user } = useAuth()
  const [step, setStep]         = useState<Step>('welcome')
  const [habitName, setHabitName] = useState('')
  const [habitColor, setHabitColor] = useState(HABIT_COLORS[5])
  const [saving, setSaving]     = useState(false)

  async function saveHabit() {
    if (!user || !habitName.trim()) { setStep('done'); return }
    setSaving(true)
    await supabase.from('habits').insert({
      user_id: user.id,
      name: habitName.trim(),
      color: habitColor,
      is_archived: false,
      sort_order: 1,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      frequency: 'daily',
    })
    setSaving(false)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* Progress dots */}
        <div className="flex gap-2 justify-center pt-6 pb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="w-2 h-2 rounded-full transition-all"
              style={{ background: STEPS.indexOf(step) >= i ? '#7C3AED' : '#E5E7EB' }} />
          ))}
        </div>

        <div className="px-8 py-6">

          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="text-6xl">👋</div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100">Welcome to Dayflow!</h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Your personal space to track habits, journal your thoughts, and reach your goals — all in one place.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Let&apos;s set things up in 2 quick steps.</p>
              <button onClick={() => setStep('habit')}
                className="w-full py-3 rounded-2xl font-bold text-white text-base transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}>
                Get started →
              </button>
            </div>
          )}

          {/* Step 2: First habit */}
          {step === 'habit' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-2">🔁</div>
                <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-gray-100">Add your first habit</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Start small — even one habit builds momentum.</p>
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_HABITS.map((h) => (
                  <button key={h.name} onClick={() => { setHabitName(h.name); setHabitColor(h.color) }}
                    className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                    style={{
                      borderColor: habitName === h.name ? h.color : '#E5E7EB',
                      background: habitName === h.name ? `${h.color}15` : 'white',
                      color: habitName === h.name ? h.color : '#6B7280',
                    }}>
                    {h.name}
                  </button>
                ))}
              </div>

              <input value={habitName} onChange={(e) => setHabitName(e.target.value)}
                placeholder="Or type your own habit…"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-base outline-none focus:border-violet-400"
              />

              {/* Color picker */}
              <div className="flex gap-2 flex-wrap">
                {HABIT_COLORS.map((c) => (
                  <button key={c} onClick={() => setHabitColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${habitColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('done')}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                  Skip for now
                </button>
                <button onClick={saveHabit} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}>
                  {saving ? 'Saving…' : 'Add habit →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100">You&apos;re all set!</h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Dayflow is ready. Start by writing in your journal, checking off habits, or setting a goal.
              </p>
              <button onClick={onComplete}
                className="w-full py-3 rounded-2xl font-bold text-white text-base hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}>
                Open Dayflow ✨
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
