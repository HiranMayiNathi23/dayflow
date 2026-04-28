'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Todo } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2 } from 'lucide-react'

interface TodoDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  todo?: Todo
  defaultDate?: string
}

export function TodoDialog({ open, onClose, onSave, todo, defaultDate }: TodoDialogProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState(defaultDate ?? '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (todo) {
      setTitle(todo.title)
      setNotes(todo.notes ?? '')
      setDueDate(todo.due_date ?? '')
      setPriority(todo.priority)
    } else {
      setTitle('')
      setNotes('')
      setDueDate(defaultDate ?? '')
      setPriority('medium')
    }
  }, [todo, open, defaultDate])

  async function handleSave() {
    if (!user || !title.trim()) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      priority,
      is_done: todo?.is_done ?? false,
    }

    if (todo) {
      await supabase.from('todos').update(payload).eq('id', todo.id)
    } else {
      await supabase.from('todos').insert(payload)
    }

    setSaving(false)
    onSave()
  }

  async function handleDelete() {
    if (!todo) return
    await supabase.from('todos').delete().eq('id', todo.id)
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{todo ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details…"
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {todo && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
