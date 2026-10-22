"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckSquare, Circle, CircleCheck, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/app-shell"
import { EmptyState, LoadMore, SearchInput, Spinner, StatusBadge } from "@/components/common"
import { NativeSelect } from "@/components/form"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useDebounced, useList } from "@/lib/use-list"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TaskDialog, type Task } from "./task-dialog"

export default function TasksPage() {
  const { can } = useAuth()
  const [status, setStatus] = React.useState("open")
  const [mine, setMine] = React.useState("true")
  const [due, setDue] = React.useState("")
  const [search, setSearch] = React.useState("")
  const q = useDebounced(search)
  const list = useList<Task>("/tasks", { status, mine, due, q })
  const [creating, setCreating] = React.useState(false)
  const [now] = React.useState(() => Date.now())

  async function toggle(t: Task) {
    try {
      await api.patch(`/tasks/${t.id}`, { status: t.status === "done" ? "todo" : "done", version: t.version })
      await list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Tasks" description="Assign work, set due dates and track it to done." actions={can("tasks.task.create") && <Button onClick={() => setCreating(true)}><Plus /> New task</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm" role="tablist">
          {[["true", "My tasks"], ["false", "All I can see"]].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={mine === v} onClick={() => setMine(v)} className={cn("rounded-full px-3 py-1", mine === v && "bg-background font-medium shadow-sm")}>{l}</button>
          ))}
        </div>
        <NativeSelect className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">Open</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </NativeSelect>
        <NativeSelect className="w-36" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due">
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </NativeSelect>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks" className="w-full sm:w-56" />
      </div>
      <Card>
        <CardContent className="p-0">
          {list.loading ? (
            <div className="grid place-items-center py-14"><Spinner /></div>
          ) : list.rows.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Nothing here" description="Create a task and assign it to yourself or a teammate." />
          ) : (
            <ul className="divide-y">
              {list.rows.map((t) => {
                const overdue = t.dueAt && t.status !== "done" && new Date(t.dueAt).getTime() < now
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <button onClick={() => toggle(t)} disabled={!can("tasks.task.edit")} aria-label={t.status === "done" ? "Mark not done" : "Mark done"} className="text-muted-foreground hover:text-foreground">
                      {t.status === "done" ? <CircleCheck className="size-5 text-primary" /> : <Circle className="size-5" />}
                    </button>
                    <Link href={`/app/m/tasks/${t.id}`} className="min-w-0 flex-1">
                      <p className={cn("truncate font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.assigneeName ?? "Unassigned"}
                        {t.subtaskCount ? ` · ${t.subtaskCount} subtask${t.subtaskCount === 1 ? "" : "s"}` : ""}
                        {t.dueAt && <span className={overdue ? "font-medium text-destructive" : ""}> · due {formatDateTime(t.dueAt)}</span>}
                      </p>
                    </Link>
                    {t.priority !== "medium" && <StatusBadge status={t.priority} />}
                    {t.status === "in_progress" && <StatusBadge status="in_progress" />}
                  </li>
                )
              })}
            </ul>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </CardContent>
      </Card>
      {creating && <TaskDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void list.reload() }} />}
    </>
  )
}
