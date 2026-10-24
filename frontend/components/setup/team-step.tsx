"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { cleanMobile, email as emailRule, mobileIN } from "@contracts/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/form"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import type { Role } from "@/lib/types"
import { StepFooter, StepHeader, useStepSave, type StepProps } from "./wizard"

interface Members {
  members: { status: string; user: { email: string; mobile: string } }[]
  invitations: { email: string | null; mobile: string | null; expired: boolean }[]
}
interface Branch {
  id: string
  name: string
}
interface InviteRow {
  id: number
  contact: string
  roleId: string
  branchId: string
  error?: string | null
  sent?: boolean
}

const key = (contact: string) => (contact.includes("@") ? contact.trim().toLowerCase() : `+91${cleanMobile(contact)}`)

export function TeamStep({ complete, back }: StepProps) {
  const { me } = useAuth()
  const roles = useApi<{ data: Role[] }>("/roles")
  const branches = useApi<Branch[] | { data: Branch[] }>("/branches")
  const members = useApi<Members>("/members")
  const [rows, setRows] = React.useState<InviteRow[]>([{ id: 1, contact: "", roleId: "", branchId: "" }])
  const [touched, setTouched] = React.useState(false)
  const { saving, error, run, setError } = useStepSave()

  const assignable = (roles.data?.data ?? []).filter((r) => r.key !== "owner")
  const branchList = Array.isArray(branches.data) ? branches.data : (branches.data?.data ?? [])
  const used = (members.data?.members.filter((m) => m.status === "active").length ?? 1) + (members.data?.invitations.filter((i) => !i.expired).length ?? 0)
  const limit = me?.limits?.users ?? null
  const seatsLeft = limit === null ? Infinity : Math.max(0, limit - used)
  const existing = new Set([...(members.data?.members ?? []).flatMap((m) => [m.user.email, m.user.mobile]), ...(members.data?.invitations ?? []).flatMap((i) => [i.email, i.mobile])].filter(Boolean) as string[])
  const mine = new Set([me?.user.email, me?.user.mobile].filter(Boolean) as string[])
  const filled = rows.filter((r) => r.contact.trim() && !r.sent)

  const problem = (r: InviteRow, i: number): string | null => {
    const c = r.contact.trim()
    if (!c) return r.roleId ? "Add an email or mobile" : null
    const fmt = c.includes("@") ? emailRule(c) : mobileIN(c)
    if (fmt) return c.includes("@") ? fmt : "Enter an email, or a 10-digit mobile"
    const k = key(c)
    if (mine.has(k)) return "That's you — you're already the owner"
    if (existing.has(k)) return "Already in your team or invited"
    if (rows.slice(0, i).some((x) => x.contact.trim() && key(x.contact) === k)) return "Added twice"
    if (!r.roleId) return "Choose a role"
    return null
  }
  const errors = rows.map((r, i) => (touched ? (r.error ?? problem(r, i)) : r.error ?? null))
  const set = (id: number, patch: Partial<InviteRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, error: null } : r)))
  const overLimit = filled.length > seatsLeft

  const send = () =>
    run(async () => {
      setTouched(true)
      if (!filled.length) return complete("skipped")
      if (rows.some((r, i) => !r.sent && problem(r, i)) || overLimit) return
      let failed = false
      for (const r of filled) {
        try {
          const c = r.contact.trim()
          await api.post("/invitations", { ...(c.includes("@") ? { email: c } : { mobile: cleanMobile(c) }), roleId: r.roleId, branchIds: r.branchId ? [r.branchId] : [] })
          setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, sent: true } : x)))
        } catch (e) {
          failed = true
          setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, error: e instanceof ApiError ? (Object.values(e.fields)[0] ?? e.message) : "Couldn't send" } : x)))
        }
      }
      if (failed) setError("Some invites weren't sent — check the rows marked in red.")
      else await complete("done")
    })

  return (
    <form
      className="flex min-h-full flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <StepHeader title="Invite your team" description="They get a link by email or SMS and see only what their role allows." />
        {limit !== null && (
          <div className="text-right text-sm">
            <p className="font-medium">
              {used} of {limit} users
            </p>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="hidden grid-cols-[2fr_1.4fr_1.2fr_2.5rem] gap-3 text-xs font-medium text-muted-foreground sm:grid">
          <span>Email or mobile</span>
          <span>Role</span>
          <span>Branch</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={r.id} className="grid gap-2 sm:grid-cols-[2fr_1.4fr_1.2fr_2.5rem] sm:gap-3">
            <div>
              <Input value={r.contact} onChange={(e) => set(r.id, { contact: e.target.value })} onBlur={() => setTouched(true)} placeholder="name@email.com or 98765 43210" aria-label={`Email or mobile, row ${i + 1}`} aria-invalid={!!errors[i] || undefined} disabled={r.sent} />
              {errors[i] && <p className="mt-1 text-xs text-destructive">{errors[i]}</p>}
              {r.sent && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Invite sent</p>}
            </div>
            <NativeSelect value={r.roleId} onChange={(e) => set(r.id, { roleId: e.target.value })} aria-label={`Role, row ${i + 1}`} disabled={r.sent}>
              <option value="">Choose role</option>
              {assignable.map((role) => (
                <option key={role.id} value={role.id} title={role.description ?? undefined}>
                  {role.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={r.branchId} onChange={(e) => set(r.id, { branchId: e.target.value })} aria-label={`Branch, row ${i + 1}`} disabled={r.sent}>
              <option value="">All branches</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [{ id: Date.now(), contact: "", roleId: "", branchId: "" }]))} disabled={r.sent}>
              <X />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" className="border-dashed" disabled={rows.length >= seatsLeft + rows.filter((r) => r.sent).length} onClick={() => setRows((rs) => [...rs, { id: Date.now(), contact: "", roleId: rs[rs.length - 1]?.roleId ?? "", branchId: "" }])}>
            <Plus /> Add another
          </Button>
        </div>
        {overLimit && <p className="text-sm text-destructive">Your plan has {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left. Remove a row, or add users from Plan & billing.</p>}
      </div>

      {assignable.length > 0 && (
        <div className="rounded-3xl border bg-muted/30 p-4 text-sm leading-relaxed">
          <p className="mb-1 font-medium">Roles</p>
          <ul className="grid gap-1 text-muted-foreground">
            {assignable.slice(0, 5).map((r) => (
              <li key={r.id}>
                <span className="font-medium text-foreground">{r.name}</span>
                {r.description ? ` — ${r.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Invites stay valid for 7 days. Resend or cancel them in Settings › Team.</p>
      <StepFooter back={back} onSkip={() => void complete("skipped")} saving={saving} error={error} saveLabel={filled.length ? `Send ${filled.length} invite${filled.length > 1 ? "s" : ""} & continue` : "Continue"} />
    </form>
  )
}
