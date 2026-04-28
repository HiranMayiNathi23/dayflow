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

const SCREEN_OPTIONS = [
  { label: '1h',  value: 1, color: '#34d399' },
  { label: '2h',  value: 2, color: '#6ee7b7' },
  { label: '3h',  value: 3, color: '#fbbf24' },
  { label: '4h',  value: 4, color: '#f59e0b' },
  { label: '5h',  value: 5, color: '#f97316' },
  { label: '6h',  value: 6, color: '#ef4444' },
  { label: '7h',  value: 7, color: '#dc2626' },
  { label: '8h',  value: 8, color: '#991b1b' },
]

const HOURS_CONFIG = [
  { hours: 0, label: 'No data',  color: '#f1f5f9', stroke: '#e2e8f0' },
  { hours: 1, label: '1 Hour',   color: '#d1fae5', stroke: '#6ee7b7' },
  { hours: 2, label: '2 Hours',  color: '#6ee7b7', stroke: '#34d399' },
  { hours: 3, label: '3 Hours',  color: '#fde68a', stroke: '#fbbf24' },
  { hours: 4, label: '4 Hours',  color: '#fbbf24', stroke: '#f59e0b' },
  { hours: 5, label: '5 Hours',  color: '#fb923c', stroke: '#f97316' },
  { hours: 6, label: '6 Hours',  color: '#f87171', stroke: '#ef4444' },
  { hours: 7, label: '7 Hours',  color: '#ef4444', stroke: '#dc2626' },
  { hours: 8, label: '8+ Hours', color: '#dc2626', stroke: '#991b1b' },
]

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

function PhoneCenter({ cx, cy }: { cx: number; cy: number }) {
  const pw = 70, ph = 116, px = cx - pw / 2, py = cy - ph / 2
  return (
    <g>
      <rect x={px + 3} y={py + 5} width={pw} height={ph} rx={15} fill="rgba(0,0,0,0.04)" />
      <rect x={px} y={py} width={pw} height={ph} rx={15} fill="white" stroke="#fed7aa" strokeWidth={2.5} />
      <rect x={px + 7} y={py + 14} width={pw - 14} height={ph - 28} rx={5} fill="#fff7ed" />
      <rect x={px + 20} y={py + 5} width={30} height={6} rx={3} fill="#fed7aa" />
      <rect x={px + 20} y={py + ph - 10} width={30} height={5} rx={2.5} fill="#fed7aa" />
      <g transform={`translate(${cx - 76}, ${cy - 40})`}>
        <circle cx={19} cy={19} r={19} fill="#7c3aed" />
        <path d="M19 25C19 25 10 17 10 12.5C10 9 12.5 7 15.5 7C17.5 7 19 8.5 19 8.5C19 8.5 20.5 7 22.5 7C25.5 7 28 9 28 12.5C28 17 19 25 19 25Z" fill="white"/>
        <polygon points="15,34 19,27 23,34 17,38" fill="#7c3aed" />
      </g>
      <g transform={`translate(${cx + 36}, ${cy - 52})`}>
        <circle cx={19} cy={19} r={19} fill="#10b981" />
        <rect x={8} y={12} width={22} height={14} rx={2} fill="white" />
        <polyline points="8,12 19,21 30,12" fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinecap="round"/>
        <polygon points="15,34 19,28 23,34 17,38" fill="#10b981" />
      </g>
      <g transform={`translate(${cx + 32}, ${cy + 20})`}>
        <circle cx={19} cy={19} r={19} fill="#f59e0b" />
        <path d="M12 13.5C12 12.5 13 11.5 14 11.5H16C17 11.5 17.5 12.3 17.5 13L17.5 14.5C17.5 15.2 17 15.7 16.5 16C16.5 16 17 17.5 18.5 19C20 20.5 21.5 21 21.5 21C21.8 20.5 22.3 20 23 20H24.5C25.2 20 26 20.5 26 21.5V23.5C26 24.5 25 25.5 24 25.5C18 25.5 12 19.5 12 13.5Z" fill="white"/>
        <polygon points="15,34 19,28 23,34 17,38" fill="#f59e0b" />
      </g>
    </g>
  )
}

function ScreenTimeContent() {
  const { user } = useAuth()
  const [month, setMonth]   = useState(new Date())
  const [data, setData]     = useState<Record<number, number>>({})
  const [hovered, setHovered] = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedDay,  setSelectedDay]  = useState<number | null>(null)

  const now = new Date()
  const isCurrentMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()
  const todayDay = now.getDate()
  const daysInMonth = getDaysInMonth(month)

  useEffect(() => {
    if (!user) return
    load()
  }, [user, month])

  async function load() {
    const start = format(new Date(month.getFullYear(), month.getMonth(), 1), 'yyyy-MM-dd')
    const end   = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), 'yyyy-MM-dd')
    const { data: rows } = await supabase
      .from('screen_time_logs').select('log_date, hours')
      .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end)
    const map: Record<number, number> = {}
    rows?.forEach((r) => {
      const h   = parseFloat(r.hours)
      const day = parseInt(r.log_date.split('-')[2])   // reliable — avoids timezone shifts
      map[day]  = Math.min(Math.round(h), 8)
    })
    setData(map)
  }

  async function handleDialogSave(day: number, hours: number | null) {
    const logDate = format(new Date(month.getFullYear(), month.getMonth(), day), 'yyyy-MM-dd')
    setSelectedDay(null)
    if (hours === null) {
      setData((p) => { const n = { ...p }; delete n[day]; return n })
      await supabase.from('screen_time_logs').delete().eq('user_id', user!.id).eq('log_date', logDate)
    } else {
      const idx = Math.min(Math.round(hours), 8)
      setData((p) => ({ ...p, [day]: idx }))
      await supabase.from('screen_time_logs').upsert(
        { user_id: user!.id, log_date: logDate, hours },
        { onConflict: 'user_id,log_date' }
      )
    }
  }

  async function resetMonth() {
    if (!confirm('Reset all screen time data for this month?')) return
    setSaving(true)
    const start = format(new Date(month.getFullYear(), month.getMonth(), 1), 'yyyy-MM-dd')
    const end   = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), 'yyyy-MM-dd')
    await supabase.from('screen_time_logs').delete()
      .eq('user_id', user!.id).gte('log_date', start).lte('log_date', end)
    setData({})
    setSaving(false)
  }

  const loggedEntries = Object.entries(data).filter(([, v]) => v > 0)
  const totalLogged   = loggedEntries.length
  const avgHours      = totalLogged > 0
    ? (loggedEntries.reduce((s, [, v]) => s + HOURS_CONFIG[v].hours, 0) / totalLogged).toFixed(1)
    : null
  const highDays = loggedEntries.filter(([, v]) => v >= 5).length

  const CX = 260, CY = 255, R1 = 118, R2 = 200, LR = 222

  return (
    <AppShell>
      {/* Full-screen layout */}
      <div className="flex flex-col h-[100dvh] overflow-hidden p-3 sm:p-5 pb-20 sm:pb-4 bg-gray-50 dark:bg-slate-950">

        {/* Compact header */}
        <div className="flex-shrink-0 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              <span className="text-xl">📱</span>
            </div>
            <h1 className="text-xl font-serif font-bold text-gray-800">Screen Time</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400 hidden sm:block">Tap a day to log screen time</p>
            {/* Settings gear — reveals Reset */}
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

        {/* Danger zone — only visible when settings open */}
        {showSettings && (
          <div className="flex-shrink-0 mb-2 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-600">Reset this month</p>
              <p className="text-xs text-red-400">Permanently deletes all screen time data for {formatMonthYear(month)}</p>
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

        {/* Main card — fills remaining space */}
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-orange-100 dark:border-slate-700 overflow-hidden flex flex-col lg:flex-row">

          {/* Top accent bar */}
          <div className="h-1.5 w-full lg:hidden bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-400 to-red-500 flex-shrink-0" />
          <div className="hidden lg:block w-1.5 h-full bg-gradient-to-b from-emerald-400 via-amber-400 via-orange-400 to-red-500 flex-shrink-0" />

          {/* Chart column — takes all available space */}
          <div className="flex-1 flex flex-col min-h-0 px-3 pt-2 pb-1 sm:px-4">

            {/* Month nav */}
            <div className="flex-shrink-0 flex items-center justify-center gap-3 mb-1">
              <Button variant="ghost" size="icon"
                className="h-8 w-8 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100"
                onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                {formatMonthYear(month)}
              </span>
              <Button variant="ghost" size="icon"
                className="h-8 w-8 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100"
                onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* SVG chart — expands to fill column */}
            <svg viewBox="0 0 520 510" className="w-full flex-1" style={{ minHeight: 0 }}>
              <circle cx={CX} cy={CY} r={R2 + 14} fill="#fff7ed" stroke="#fed7aa" strokeWidth={1} />

              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1
                const a1 = (i / 31) * 360
                const a2 = ((i + 1) / 31) * 360
                const mid = (a1 + a2) / 2
                const lp = pt(CX, CY, LR, mid)
                const idx = data[day] ?? 0
                const cfg = HOURS_CONFIG[idx]
                const isActive = day <= daysInMonth
                const isFuture = isCurrentMonth && day > todayDay
                const isHov = hovered === day
                const isToday = isCurrentMonth && day === todayDay
                const fill = !isActive ? 'transparent' : isFuture ? '#f1f5f9' : cfg.color

                return (
                  <g key={day}
                    onClick={() => { if (isActive && !isFuture) setSelectedDay(day) }}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: isActive && !isFuture ? 'pointer' : 'default' }}
                  >
                    <path d={arc(CX, CY, R1, R2, a1, a2)} fill={fill}
                      stroke={isHov && !isFuture ? '#f97316' : cfg.stroke}
                      strokeWidth={isHov && !isFuture ? 1.5 : 0.8}
                      opacity={isHov && !isFuture ? 0.85 : 1}
                      style={{ transition: 'all 0.1s' }}
                    />
                    {isToday && (
                      <circle cx={pt(CX, CY, R2 + 7, mid).x} cy={pt(CX, CY, R2 + 7, mid).y}
                        r={4} fill="#f97316" />
                    )}
                    {isActive && (
                      <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
                        fontSize={day <= 9 ? 9.5 : 8.5} fontWeight={isToday ? '800' : '700'}
                        fill={isHov && !isFuture ? '#f97316' : isToday ? '#7c3aed' : '#b0a0c0'}
                        transform={`rotate(${mid},${lp.x},${lp.y})`}
                        style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.1s' }}
                      >{day}</text>
                    )}
                  </g>
                )
              })}

              <circle cx={CX} cy={CY} r={R1} fill="white" stroke="#fed7aa" strokeWidth={1.5} />
              <PhoneCenter cx={CX} cy={CY} />

              {hovered !== null && (
                <g>
                  <rect x={CX - 90} y={CY + 82} width={180} height={30} rx={10} fill="#1f2937" opacity={0.85} />
                  <text x={CX} y={CY + 97} textAnchor="middle" dominantBaseline="central"
                    fontSize={11} fill="white" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    {isCurrentMonth && hovered > todayDay
                      ? `Day ${hovered} · Future date`
                      : (data[hovered] ?? 0) === 0
                        ? `Day ${hovered} · Click to log`
                        : `Day ${hovered} · ${HOURS_CONFIG[data[hovered]].label}`}
                  </text>
                </g>
              )}
            </svg>

            <p className="flex-shrink-0 text-center text-[10px] text-gray-300 font-semibold mb-1 lg:hidden">
              Tap any past day to log your screen time
            </p>
          </div>

          {/* Right info panel — desktop sidebar */}
          <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700 flex-shrink-0 flex lg:flex-col gap-5 p-5 overflow-x-auto lg:overflow-y-auto">

            {/* Stats */}
            <div className="flex lg:flex-col gap-3 flex-shrink-0 w-full">
              <p className="hidden lg:block text-xs font-bold tracking-widest text-gray-300 uppercase">Stats</p>

              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Days Logged</p>
                  <p className="text-sm text-emerald-400 mt-0.5">this month</p>
                </div>
                <span className="text-4xl font-bold text-emerald-600">{totalLogged}</span>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">Daily Average</p>
                  <p className="text-sm text-orange-300 mt-0.5">hours per day</p>
                </div>
                <span className="text-4xl font-bold text-orange-500">{avgHours ? `${avgHours}h` : '—'}</span>
              </div>

              <div className="bg-red-50 dark:bg-red-900/30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 min-w-[140px] lg:min-w-0">
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wide">High Days</p>
                  <p className="text-sm text-red-300 mt-0.5">5+ hours</p>
                </div>
                <span className="text-4xl font-bold text-red-500">{highDays}</span>
              </div>
            </div>

            {/* Legend — desktop */}
            <div className="hidden lg:block space-y-3 flex-shrink-0">
              <p className="text-xs font-bold tracking-widest text-gray-300 uppercase">Colour Key</p>
              {HOURS_CONFIG.slice(1).map((cfg) => (
                <div key={cfg.hours} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 border-2"
                    style={{ backgroundColor: cfg.color, borderColor: cfg.stroke }} />
                  <span className="text-base font-semibold text-gray-600">{cfg.label}</span>
                </div>
              ))}
            </div>

            {/* Legend — mobile horizontal */}
            <div className="flex lg:hidden flex-wrap gap-x-4 gap-y-2 flex-shrink-0">
              {HOURS_CONFIG.slice(1).map((cfg) => (
                <div key={cfg.hours} className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                    style={{ backgroundColor: cfg.color, borderColor: cfg.stroke }} />
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">{cfg.label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      <DayPickerDialog
        open={selectedDay !== null}
        day={selectedDay ?? 0}
        month={formatMonthYear(month)}
        currentValue={selectedDay !== null ? (data[selectedDay] ?? 0) : 0}
        unit="hours on screen"
        options={SCREEN_OPTIONS}
        maxValue={14}
        onSave={(hours) => selectedDay !== null && handleDialogSave(selectedDay, hours)}
        onClose={() => setSelectedDay(null)}
      />
    </AppShell>
  )
}

export default function ScreenTimePage() {
  return <AuthGuard><ScreenTimeContent /></AuthGuard>
}
