'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Option { label: string; value: number; color: string }

interface DayPickerDialogProps {
  open: boolean
  day: number
  month: string        // e.g. "April 2026"
  currentValue: number // currently stored hours (0 = not set)
  unit: string         // e.g. "hours slept" or "hours on screen"
  options: Option[]    // quick-pick buttons
  maxValue?: number
  onSave: (hours: number | null) => void
  onClose: () => void
}

export function DayPickerDialog({
  open, day, month, currentValue, unit, options, maxValue = 24, onSave, onClose,
}: DayPickerDialogProps) {
  const [input, setInput] = useState('')

  useEffect(() => {
    if (open) setInput(currentValue > 0 ? String(currentValue) : '')
  }, [open, currentValue])

  function handleSave() {
    const val = parseFloat(input)
    if (!input || isNaN(val) || val <= 0) {
      onSave(null)
    } else {
      onSave(Math.min(val, maxValue))
    }
  }

  const parsedInput = parseFloat(input)
  const selectedOption = options.find((o) => o.value === parsedInput)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-gray-800">
            {month} — Day {day}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Number input */}
          <div className="flex flex-col items-center gap-1">
            <input
              type="number"
              min={0}
              max={maxValue}
              step={0.5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0"
              autoFocus
              className="text-5xl font-bold w-28 text-center border-2 border-violet-200 rounded-2xl p-3 outline-none focus:border-violet-500 text-gray-800"
            />
            <p className="text-sm text-gray-400">{unit}</p>
          </div>

          {/* Quick-pick buttons */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {options.map((opt) => {
              const isSelected = String(opt.value) === input || opt.value === parsedInput
              return (
                <button
                  key={opt.value}
                  onClick={() => setInput(String(opt.value))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2"
                  style={{
                    borderColor: isSelected ? opt.color : '#E5E7EB',
                    background: isSelected ? `${opt.color}15` : 'white',
                    color: isSelected ? opt.color : '#6B7280',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {currentValue > 0 && (
              <Button variant="outline" className="text-gray-400 text-sm"
                onClick={() => onSave(null)}>
                Clear
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave}
              style={{ background: selectedOption ? selectedOption.color : '#7C3AED' }}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
