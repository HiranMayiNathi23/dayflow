'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { format, parseISO } from 'date-fns'

interface JournalEditorProps {
  date: string
  isFuture?: boolean
  onMoodChange?: (emoji: string) => void
}

const MOODS = [
  { id: 'rough', emoji: '😣', label: 'Rough', color: '#FF6B6B', bg: '#FFF0F0', num: 1, quote: "It's okay to have hard days. Rest and reset." },
  { id: 'meh',   emoji: '😕', label: 'Meh',   color: '#FF9F43', bg: '#FFF6EE', num: 2, quote: 'A meh day still moves you forward. Keep going.' },
  { id: 'okay',  emoji: '😐', label: 'Okay',  color: '#F9CA24', bg: '#FFFBEE', num: 3, quote: 'Feeling okay is a solid foundation to build on.' },
  { id: 'good',  emoji: '🙂', label: 'Good',  color: '#6AB04C', bg: '#F0FFF0', num: 4, quote: 'Good energy today! Channel it into what matters.' },
  { id: 'great', emoji: '😄', label: 'Great', color: '#686DE0', bg: '#F2F0FF', num: 5, quote: 'You\'re thriving — make the most of this momentum.' },
]

export function JournalEditor({ date, isFuture = false, onMoodChange }: JournalEditorProps) {
  const { user } = useAuth()
  const [content, setContent]     = useState('')
  const [moodId,  setMoodId]      = useState('okay')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moodRef     = useRef(moodId)

  useEffect(() => { moodRef.current = moodId }, [moodId])

  useEffect(() => {
    if (!user) return
    supabase.from('journal_entries').select('content, mood').eq('user_id', user.id).eq('entry_date', date).maybeSingle()
      .then(({ data }) => {
        setContent(data?.content ?? '')
        const m = MOODS.find((x) => x.num === (data?.mood ?? 3)) ?? MOODS[2]
        setMoodId(m.id)
        onMoodChange?.(m.emoji)
      })
  }, [user, date])

  const save = useCallback(async (newContent: string, newMoodId: string) => {
    if (!user || isFuture) return
    const mood = MOODS.find((m) => m.id === newMoodId)?.num ?? 3
    setSaveStatus('saving')
    await supabase.from('journal_entries').upsert(
      { user_id: user.id, entry_date: date, content: newContent, mood, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,entry_date' }
    )
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, date, isFuture])

  const CHAR_LIMIT = 3000

  function handleContentChange(val: string) {
    if (isFuture) return
    if (val.length > CHAR_LIMIT) return   // hard stop at limit
    setContent(val)
    setSaveStatus('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(val, moodRef.current), 1500)
  }

  function handleMoodChange(id: string) {
    if (isFuture) return
    setMoodId(id)
    const m = MOODS.find((x) => x.id === id)!
    onMoodChange?.(m.emoji)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    save(content, id)
  }

  const moodCfg = MOODS.find((m) => m.id === moodId) ?? MOODS[2]
  const displayDate = format(parseISO(date), 'MMMM d, yyyy')

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl flex flex-col overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
          style={{ background: 'linear-gradient(135deg,#7C3AED22,#06B6D422)' }}>📖</div>
        <span className="font-bold text-gray-900 dark:text-gray-100" style={{ fontSize: 17 }}>Journal</span>
        <span className="ml-auto text-gray-400 dark:text-gray-500" style={{ fontSize: 13 }}>{displayDate}</span>
      </div>

      <div className="flex flex-col px-5 py-4 gap-4">

        {/* Future lock banner */}
        {isFuture && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
            style={{ background: '#FFF6EE', border: '1px solid #FBBF24', color: '#D97706' }}>
            <span>📅</span> You cannot write journal entries for future dates
          </div>
        )}

        {/* Mood picker */}
        <div>
          <p className="font-bold tracking-widest text-gray-400 mb-3" style={{ fontSize: 13, letterSpacing: '0.1em' }}>
            HOW ARE YOU FEELING TODAY?
          </p>
          <div className={`flex gap-2 ${isFuture ? 'opacity-40 pointer-events-none' : ''}`}>
            {MOODS.map((m) => {
              const sel = moodId === m.id
              return (
                <button key={m.id} onClick={() => handleMoodChange(m.id)}
                  disabled={isFuture}
                  style={{
                    flex: 1, padding: '10px 4px 8px',
                    border: `2px solid ${sel ? m.color : '#F0F0F5'}`,
                    borderRadius: 14, background: sel ? m.bg : 'white',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    cursor: 'pointer', transition: 'all 0.18s',
                    transform: sel ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: sel ? `0 6px 20px ${m.color}30` : 'none',
                    position: 'relative', zIndex: sel ? 2 : 1,
                  }}>
                  <span style={{ fontSize: 28 }}>{m.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sel ? m.color : '#9CA3AF', letterSpacing: 0.5 }}>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Mood quote pill */}
          {!isFuture && (
            <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl"
              style={{ background: moodCfg.bg, borderLeft: `3px solid ${moodCfg.color}` }}>
              <span style={{ fontSize: 20 }}>{moodCfg.emoji}</span>
              <p className="font-medium italic" style={{ color: moodCfg.color, fontSize: 14 }}>&ldquo;{moodCfg.quote}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="flex flex-col">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            maxLength={CHAR_LIMIT}
            readOnly={isFuture}
            placeholder={isFuture ? 'Journal entries cannot be written for future dates' : "What's on your mind today? Thoughts, gratitude, reflections..."}
            style={{
              flex: 1, width: '100%', minHeight: 280,
              border: '1.5px solid #F0F0F5', borderRadius: 14,
              padding: '14px 16px', fontSize: 16, color: '#374151',
              background: 'transparent',
              outline: 'none', lineHeight: 1.75, resize: 'none',
              transition: 'border-color 0.15s',
              opacity: isFuture ? 0.6 : 1,
              cursor: isFuture ? 'not-allowed' : 'text',
            }}
            onFocus={(e) => { if (!isFuture) e.target.style.borderColor = '#7C3AED40' }}
            onBlur={(e) => { e.target.style.borderColor = '#F0F0F5' }}
          />

          {/* Footer — auto-save status only */}
          {!isFuture && (
            <div className="flex justify-between items-center mt-2.5">
              <span className={`text-sm font-medium ${
                content.length >= CHAR_LIMIT        ? 'text-red-500' :
                content.length >= CHAR_LIMIT * 0.9  ? 'text-amber-500' :
                'text-gray-400'
              }`}>
                {content.length}/{CHAR_LIMIT}
                {content.length >= CHAR_LIMIT && ' — limit reached'}
              </span>
              <span className="text-sm font-medium">
                {saveStatus === 'saving' && <span className="text-amber-500">Saving…</span>}
                {saveStatus === 'saved'  && <span className="text-emerald-500">Auto saved ✓</span>}
                {saveStatus === 'idle' && content.length > 0 && <span className="text-gray-300">Auto saved</span>}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
