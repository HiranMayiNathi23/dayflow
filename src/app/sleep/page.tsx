'use client'
import { useState, useEffect } from 'react'
import { addMonths, subMonths, format, getDaysInMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Settings, Trash2 } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatMonthYear } from '@/lib/utils'
import { DayPickerDialog } from '@/components/trackers/DayPickerDialog'

const SLEEP_OPTIONS = [
  { label: '3h',  value: 3,  color: '#f87171' },
  { label: '4h',  value: 4,  color: '#fbbf24' },
  { label: '5h',  value: 5,  color: '#fbbf24' },
  { label: '6h',  value: 6,  color: '#6ee7b7' },
  { label: '7h',  value: 7,  color: '#34d399' },
  { label: '8h',  value: 8,  color: '#a78bfa' },
  { label: '9h',  value: 9,  color: '#7c3aed' },
  { label: '10h', value: 10, color: '#6366f1' },
]

// App-palette: red (too little) → amber → emerald (optimal) → violet (great) → indigo (too much)
const SLEEP_CONFIG = [
  { hours: 0,  label: 'No data',     color: '#f1f5f9', stroke: '#e2e8f0' },
  { hours: 3,  label: '< 4 Hours',   color: '#fecaca', stroke: '#f87171' },
  { hours: 5,  label: '4–6 Hours',   color: '#fde68a', stroke: '#fbbf24' },
  { hours: 7,  label: '6–8 Hours',   color: '#6ee7b7', stroke: '#34d399' },
  { hours: 9,  label: '8–10 Hours',  color: '#a78bfa', stroke: '#7c3aed' },
  { hours: 11, label: '10–12 Hours', color: '#818cf8', stroke: '#6366f1' },
  { hours: 13, label: '12+ Hours',   color: '#5b21b6', stroke: '#4c1d95' },
]

// ── SVG helpers ────────────────────────────────────────────────────────────
function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arc(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number, gap = 1.4) {
  const s = a1 + gap, e = a2 - gap
  const p1 = pt(cx, cy, r1, s), p2 = pt(cx, cy, r2, s)
  const p3 = pt(cx, cy, r2, e), p4 = pt(cx, cy, r1, e)
  const lg = (e - s) > 180 ? 1 : 0
  return `M${p1.x},${p1.y}L${p2.x},${p2.y}A${r2},${r2} 0 ${lg} 1 ${p3.x},${p3.y}L${p4.x},${p4.y}A${r1},${r1} 0 ${lg} 0 ${p1.x},${p1.y}Z`
}

// ── Exact port of HTML BedIllustration — app colors on bed/moon ──────────
function BedCenter({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Crescent moon — top right, swaying */}
      <g style={{ transformOrigin: `${cx + 28}px ${cy - 58}px`, animation: 'sway 4s ease-in-out infinite' }}>
        <circle cx={cx + 28} cy={cy - 58} r={22} fill="#fde68a" />
        <circle cx={cx + 40} cy={cy - 68} r={16} fill="#f0eeff" />
        {/* Stars near moon */}
        <polygon
          points="30,-18 32,-12 38,-12 33,-8 35,-2 30,-6 25,-2 27,-8 22,-12 28,-12"
          fill="#fde68a"
          transform={`translate(${cx + 28} ${cy - 58}) scale(0.55)`}
        />
        <polygon
          points="-28,10 -27,14 -23,14 -26,16 -25,20 -28,18 -31,20 -30,16 -33,14 -29,14"
          fill="#a78bfa"
          transform={`translate(${cx + 28} ${cy - 58}) scale(0.6)`}
        />
      </g>

      {/* Bed base */}
      <rect x={cx - 54} y={cy + 22} width={108} height={36} rx={8} fill="#7c3aed" />
      {/* Mattress */}
      <rect x={cx - 50} y={cy + 4} width={100} height={28} rx={10} fill="#ede9fe" stroke="#a78bfa" strokeWidth={1.5} />
      {/* Pillow */}
      <rect x={cx - 44} y={cy + 6} width={36} height={20} rx={8} fill="white" stroke="#c4b5fd" strokeWidth={1.5} />
      {/* Blanket */}
      <rect x={cx - 8} y={cy + 6} width={56} height={22} rx={8} fill="#818cf8" stroke="#6366f1" strokeWidth={1.5} />
      {/* Blanket dots */}
      <circle cx={cx + 10} cy={cy + 17} r={2.5} fill="white" opacity={0.6} />
      <circle cx={cx + 22} cy={cy + 13} r={2}   fill="white" opacity={0.5} />
      <circle cx={cx + 34} cy={cy + 19} r={2.5} fill="white" opacity={0.6} />

      {/* Sleeping head on pillow — copied exactly from HTML */}
      <circle cx={cx - 26} cy={cy + 2} r={16} fill="#FDDBB4" stroke="#F0C090" strokeWidth={1.5} />

      {/* Sleeping eyes — arcs curve UP = peaceful closed-eye look */}
      <path d={`M ${cx-33} ${cy+0} Q ${cx-29} ${cy-5} ${cx-25} ${cy+0}`}
        fill="none" stroke="#C87840" strokeWidth={2} strokeLinecap="round" />
      <path d={`M ${cx-22} ${cy+0} Q ${cx-18} ${cy-5} ${cx-14} ${cy+0}`}
        fill="none" stroke="#C87840" strokeWidth={2} strokeLinecap="round" />

      {/* Smile */}
      <path d={`M ${cx-30} ${cy+8} Q ${cx-23} ${cy+13} ${cx-16} ${cy+8}`}
        fill="none" stroke="#C87840" strokeWidth={1.8} strokeLinecap="round" />

      {/* Rosy cheeks */}
      <circle cx={cx - 34} cy={cy + 6} r={4} fill="#FFB3C1" opacity={0.5} />
      <circle cx={cx - 14} cy={cy + 6} r={4} fill="#FFB3C1" opacity={0.5} />

      {/* Hair */}
      <path d={`M ${cx-40} ${cy-6} Q ${cx-30} ${cy-18} ${cx-12} ${cy-12}`}
        fill="none" stroke="#8B5E3C" strokeWidth={5} strokeLinecap="round" />

      {/* ZZZ animated */}
      <text className="zzz1" x={cx + 46} y={cy - 8}  fontSize={13} fontWeight="800" fill="#7c3aed" opacity={0}>Z</text>
      <text className="zzz2" x={cx + 54} y={cy - 20} fontSize={17} fontWeight="800" fill="#7c3aed" opacity={0}>Z</text>
      <text className="zzz3" x={cx + 64} y={cy - 34} fontSize={21} fontWeight="800" fill="#7c3aed" opacity={0}>Z</text>
    </g>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────
function SleepContent() {
  const { user } = useAuth()
  const [month, setMonth]             = useState(new Date())
  const [data, setData]               = useState<Record<number, number>>({})
  const [hovered,      setHovered]      = useState<number | null>(null)
  const [selectedDay,  setSelectedDay]  = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const now = new Date()
  const isCurrentMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()
  const todayDay    = now.getDate()
  const currentHour = now.getHours()
  const daysInMonth = getDaysInMonth(month)

  // Last day sleep can be logged:
  // After 6 AM → yesterday (you've woken up, know how long you slept)
  // Before 6 AM → 2 days ago (you might still be sleeping from last night)
  const lastLoggableDay = currentHour >= 6 ? todayDay - 1 : todayDay - 2

  useEffect(() => {
    if (!user) return
    load()
  }, [user, month])

  async function load() {
    const start = format(new Date(month.getFullYear(), month.getMonth(), 1), 'yyyy-MM-dd')
    const end   = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), 'yyyy-MM-dd')
    const { data: rows } = await supabase
      .from('sleep_logs').select('log_date, hours')
      .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end)

    const map: Record<number, number> = {}
    rows?.forEach((r) => {
      const h   = parseFloat(r.hours)
      const day = parseInt(r.log_date.split('-')[2])   // reliable — avoids timezone shifts
      const idx = h < 4 ? 1 : h < 6 ? 2 : h < 8 ? 3 : h < 10 ? 4 : h < 12 ? 5 : 6
      map[day]  = idx
    })
    setData(map)
  }

  async function handleDialogSave(day: number, hours: number | null) {
    const logDate = format(new Date(month.getFullYear(), month.getMonth(), day), 'yyyy-MM-dd')
    setSelectedDay(null)
    if (hours === null) {
      setData((p) => { const n = { ...p }; delete n[day]; return n })
      await supabase.from('sleep_logs').delete().eq('user_id', user!.id).eq('log_date', logDate)
    } else {
      const idx = hours < 4 ? 1 : hours < 6 ? 2 : hours < 8 ? 3 : hours < 10 ? 4 : hours < 12 ? 5 : 6
      setData((p) => ({ ...p, [day]: idx }))
      await supabase.from('sleep_logs').upsert(
        { user_id: user!.id, log_date: logDate, hours },
        { onConflict: 'user_id,log_date' }
      )
    }
  }

  async function resetMonth() {
    if (!confirm('Permanently delete all sleep data for this month?')) return
    setSaving(true)
    const start = format(new Date(month.getFullYear(), month.getMonth(), 1), 'yyyy-MM-dd')
    const end   = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), 'yyyy-MM-dd')
    await supabase.from('sleep_logs').delete()
      .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end)
    setData({})
    setSaving(false)
    setShowSettings(false)
  }

  const loggedEntries = Object.entries(data).filter(([, v]) => v > 0)
  const totalLogged   = loggedEntries.length
  const avgHours      = totalLogged > 0
    ? (loggedEntries.reduce((s, [, v]) => s + SLEEP_CONFIG[v].hours, 0) / totalLogged).toFixed(1)
    : null
  const goodNights = loggedEntries.filter(([, v]) => v === 3 || v === 4).length // 6-10 hrs

  const CX = 260, CY = 255, R1 = 118, R2 = 200, LR = 222

  return (
    <AppShell>
      {/* CSS animations for ZZZ and moon */}
      <style>{`
        @keyframes zzz {
          0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
          40%  { opacity: 1; transform: translate(4px,-8px) scale(1); }
          80%  { opacity: 0.4; transform: translate(9px,-18px) scale(1.2); }
          100% { opacity: 0; transform: translate(12px,-26px) scale(1.3); }
        }
        @keyframes sway {
          0%,100% { transform: rotate(-2deg); }
          50%     { transform: rotate(2deg); }
        }
        .zzz1 { animation: zzz 2.8s ease-in-out infinite; }
        .zzz2 { animation: zzz 2.8s ease-in-out infinite 0.9s; }
        .zzz3 { animation: zzz 2.8s ease-in-out infinite 1.8s; }
      `}</style>

      {/* Mobile: natural scroll. Desktop: fixed height */}
      <div className="flex flex-col min-h-screen lg:h-[100dvh] lg:overflow-hidden p-3 sm:p-4 pb-24 lg:pb-4 bg-gray-50">

        {/* Compact header */}
        <div className="flex-shrink-0 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-xl">🌙</span>
            </div>
            <h1 className="text-xl font-serif font-bold text-gray-800">Sleep Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400 hidden sm:block">Tap a day to log sleep</p>
            <button
              onClick={() => setShowSettings((s) => !s)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                showSettings ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Danger zone — hidden until gear clicked */}
        {showSettings && (
          <div className="flex-shrink-0 mb-2 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-600">Reset this month</p>
              <p className="text-xs text-red-400">Permanently deletes all sleep data for {formatMonthYear(month)}</p>
            </div>
            <button
              onClick={resetMonth}
              disabled={saving}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}

        {/* Main card */}
        <div className="lg:flex-1 lg:min-h-0 bg-white rounded-3xl shadow-md border border-violet-100 overflow-hidden flex flex-col lg:flex-row">

          {/* Accent bars */}
          <div className="h-1.5 w-full lg:hidden bg-gradient-to-r from-red-300 via-amber-300 via-emerald-400 via-violet-500 to-indigo-600 flex-shrink-0" />
          <div className="hidden lg:block w-1.5 h-full bg-gradient-to-b from-red-300 via-amber-300 via-emerald-400 via-violet-500 to-indigo-600 flex-shrink-0" />

          {/* Chart column */}
          <div className="flex-1 flex flex-col min-h-0 px-3 pt-2 pb-1 sm:px-4">

            {/* Month nav */}
            <div className="flex-shrink-0 flex items-center justify-center gap-3 mb-1">
              <Button variant="ghost" size="icon"
                className="h-8 w-8 rounded-full bg-violet-50 text-violet-500 hover:bg-violet-100"
                onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                {formatMonthYear(month)}
              </span>
              <Button variant="ghost" size="icon"
                className="h-8 w-8 rounded-full bg-violet-50 text-violet-500 hover:bg-violet-100"
                onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Radial chart */}
            <svg viewBox="0 0 520 510" className="w-full flex-1" style={{ minHeight: 0 }}>
              <circle cx={CX} cy={CY} r={R2 + 14} fill="#f5f3ff" stroke="#ede9fe" strokeWidth={1} />

              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1
                const a1  = (i / 31) * 360
                const a2  = ((i + 1) / 31) * 360
                const mid = (a1 + a2) / 2
                const lp  = pt(CX, CY, LR, mid)
                const idx = data[day] ?? 0
                const cfg = SLEEP_CONFIG[idx]
                const isActive = day <= daysInMonth
                // Locked if beyond the last loggable day (accounts for 6 AM cutoff)
                const isFuture = isCurrentMonth && day > lastLoggableDay
                const isHov    = hovered === day
                // Highlight the last loggable day (yesterday after 6 AM) instead of today
                const isLastLoggable = isCurrentMonth && day === lastLoggableDay
                const fill = !isActive ? 'transparent' : isFuture ? '#f4f4f8' : cfg.color

                return (
                  <g key={day}
                    onClick={() => { if (isActive && !isFuture) setSelectedDay(day) }}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: isActive && !isFuture ? 'pointer' : 'default' }}
                  >
                    <path d={arc(CX, CY, R1, R2, a1, a2)} fill={fill}
                      stroke={isFuture ? '#e4e4ec' : isHov ? '#7c3aed' : cfg.stroke}
                      strokeWidth={isHov && !isFuture ? 1.5 : 0.8}
                      opacity={isFuture ? 0.5 : isHov ? 0.85 : 1}
                      style={{ transition: 'all 0.12s' }}
                    />
                    {/* Dot on last loggable day (yesterday after 6 AM) */}
                    {isLastLoggable && (
                      <circle
                        cx={pt(CX, CY, R2 + 7, mid).x}
                        cy={pt(CX, CY, R2 + 7, mid).y}
                        r={4} fill="#7c3aed"
                      />
                    )}
                    {isActive && (
                      <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
                        fontSize={day <= 9 ? 9.5 : 8.5} fontWeight={isLastLoggable ? '800' : '700'}
                        fill={isFuture ? '#c8c8d8' : isHov ? '#5b21b6' : isLastLoggable ? '#7c3aed' : '#a8a8c8'}
                        transform={`rotate(${mid},${lp.x},${lp.y})`}
                        style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.12s' }}
                      >{day}</text>
                    )}
                  </g>
                )
              })}

              <circle cx={CX} cy={CY} r={R1} fill="white" stroke="#ede9fe" strokeWidth={2} />
              <BedCenter cx={CX} cy={CY} />

              {hovered !== null && (() => {
                const isLocked = isCurrentMonth && hovered > lastLoggableDay
                const line1 = `Day ${hovered}`
                const line2 = isLocked
                  ? currentHour < 6 && hovered === todayDay - 1
                    ? 'Available after 6 AM'
                    : hovered === todayDay
                      ? 'Log after 6 AM tomorrow'
                      : 'Future date'
                  : (data[hovered] ?? 0) === 0
                    ? 'Click to log sleep'
                    : SLEEP_CONFIG[data[hovered]].label
                return (
                  <g>
                    <rect x={CX - 90} y={CY + 78} width={180} height={44} rx={10} fill="#1e1b4b" opacity={0.92} />
                    <text x={CX} y={CY + 92} textAnchor="middle" dominantBaseline="central"
                      fontSize={11} fill="white" fontWeight="800" style={{ pointerEvents: 'none' }}>
                      {line1}
                    </text>
                    <text x={CX} y={CY + 108} textAnchor="middle" dominantBaseline="central"
                      fontSize={10} fill="rgba(255,255,255,0.75)" fontWeight="600" style={{ pointerEvents: 'none' }}>
                      {line2}
                    </text>
                  </g>
                )
              })()}
            </svg>

            <p className="flex-shrink-0 text-center text-[10px] text-gray-300 font-semibold mb-1 lg:hidden">
              Tap any past day to log your sleep
            </p>
          </div>

          {/* Right info panel */}
          <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700 flex-shrink-0 flex lg:flex-col gap-5 p-5 overflow-x-auto lg:overflow-y-auto">

            {/* Stats */}
            <div className="flex lg:flex-col gap-3 flex-shrink-0 w-full">
              <p className="hidden lg:block text-xs font-bold tracking-widest text-gray-300 uppercase">Stats</p>

              <div className="bg-violet-50 dark:bg-violet-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-violet-500 uppercase tracking-wide">Days Logged</p>
                  <p className="text-sm text-violet-300 mt-0.5">this month</p>
                </div>
                <span className="text-4xl font-bold text-violet-600">{totalLogged}</span>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Nightly Avg</p>
                  <p className="text-sm text-indigo-300 mt-0.5">hours per night</p>
                </div>
                <span className="text-4xl font-bold text-indigo-500">{avgHours ? `${avgHours}h` : '—'}</span>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Good Nights</p>
                  <p className="text-sm text-emerald-300 mt-0.5">6–10 hours</p>
                </div>
                <span className="text-4xl font-bold text-emerald-600">{goodNights}</span>
              </div>
            </div>

            {/* Legend — desktop */}
            <div className="hidden lg:block space-y-3 flex-shrink-0">
              <p className="text-xs font-bold tracking-widest text-gray-300 uppercase">Colour Key</p>
              {SLEEP_CONFIG.slice(1).map((cfg) => (
                <div key={cfg.label} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 border-2"
                    style={{ backgroundColor: cfg.color, borderColor: cfg.stroke }} />
                  <span className="text-base font-semibold text-gray-600">{cfg.label}</span>
                </div>
              ))}
            </div>

            {/* Legend — mobile horizontal */}
            <div className="flex lg:hidden flex-wrap gap-x-4 gap-y-2 flex-shrink-0">
              {SLEEP_CONFIG.slice(1).map((cfg) => (
                <div key={cfg.label} className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                    style={{ backgroundColor: cfg.color, borderColor: cfg.stroke }} />
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">{cfg.label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Day picker dialog */}
      <DayPickerDialog
        open={selectedDay !== null}
        day={selectedDay ?? 0}
        month={formatMonthYear(month)}
        currentValue={selectedDay !== null ? SLEEP_CONFIG[data[selectedDay] ?? 0]?.hours ?? 0 : 0}
        unit="hours slept"
        options={SLEEP_OPTIONS}
        maxValue={14}
        onSave={(hours) => selectedDay !== null && handleDialogSave(selectedDay, hours)}
        onClose={() => setSelectedDay(null)}
      />
    </AppShell>
  )
}

export default function SleepPage() {
  return <AuthGuard><SleepContent /></AuthGuard>
}
