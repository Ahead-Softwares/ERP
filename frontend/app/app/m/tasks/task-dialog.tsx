"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, NativeSelect } from "@/components/form"
import { UserSelect } from "@/components/pickers"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export interface Task {
  id: string
  title: string
  description: string | null
  status: "todo" | "in_progress" | "done" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  dueAt: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdByName: string | null
  subtaskCount?: number
  version: number
}

export function TaskDialog({ parentId, onClose, onSaved }: { parentId?: string; onClose: () => void; onSaved: (t: Task) => void }) {
  const { me } = useAuth()
  const [form, setForm] = React.useState({ title: "", description: "", priority: "medium", due: "", assigneeId: me?.user.id ?? null as string | null })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const t = await api.post<Task>("/tasks", {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        dueAt: form.due ? new Date(form.due).toISOString() : null,
        assigneeId: form.assigneeId,
        parentId: parentId ?? null,
      })
      toast.success(parentId ? "Subtask added" : "Task created")
      onSaved(t)
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{parentId ? "New subtask" : "New task"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <Field label="Title" error={errors.title}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus /></Field>
          <Field label="Details"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assignee" error={errors.assigneeId}><UserSelect value={form.assigneeId} onChange={(v) => setForm({ ...form, assigneeId: v })} /></Field>
            <Field label="Priority">
              <NativeSelect value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Due" className="sm:col-span-2"><Input type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
          </div>
          <FormError message={error} />
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
