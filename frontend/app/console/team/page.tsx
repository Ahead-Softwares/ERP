"use client"

import * as React from "react"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate } from "@/lib/format"
import type { ConsoleMember, ConsoleRole } from "@/lib/console"

const SCOPE_TEXT = { all: "all clients", team: "team's clients", own: "own clients", branch: "own clients" } as const

function AddDialog({ open, onOpenChange, roles, members, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; roles: ConsoleRole[]; members: ConsoleMember[]; onSaved: () => void }) {
  const { me } = useAuth()
  const [form, setForm] = React.useState({ email: "", name: "", mobile: "", roleKey: "console_sales_executive", reportsTo: "" })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const assignable = roles.filter((r) => r.key !== "super_admin" || me?.console?.role.key === "super_admin")
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const r = await api.post<{ newUser: boolean }>("/console/members", {
        email: form.email,
        name: form.name || undefined,
        mobile: form.mobile || undefined,
        roleKey: form.roleKey,
        reportsTo: form.reportsTo || null,
      })
      toast.success(r.newUser ? "Added — they sign in with mobile OTP or “Forgot password”" : "Added to the Console")
      onOpenChange(false)
      setForm({ email: "", name: "", mobile: "", roleKey: "console_sales_executive", reportsTo: "" })
      onSaved()
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fields, form: errorMessage(err) } : { form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add a Console user</DialogTitle>
            <DialogDescription>An existing account is added by email. For someone new, also give their name and mobile.</DialogDescription>
          </DialogHeader>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (new users)" error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile (new users)" error={errors.mobile}>
              <Input inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="98765 43210" />
            </Field>
            <Field label="Role" error={errors.roleKey}>
              <NativeSelect value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
                {assignable.map((r) => (
                  <option key={r.key} value={r.key}>{r.name}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reports to" error={errors.reportsTo} hint="Builds the Sales Manager's team">
              <NativeSelect value={form.reportsTo} onChange={(e) => setForm({ ...form, reportsTo: e.target.value })}>
                <option value="">Nobody</option>
                {members.filter((m) => m.status === "active").map((m) => (
                  <option key={m.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <FormError message={errors.form} />
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ConsoleTeamPage() {
  const { me, canConsole } = useAuth()
  const members = useApi<{ data: ConsoleMember[] }>("/console/members")
  const roles = useApi<{ data: ConsoleRole[] }>("/console/roles")
  const [open, setOpen] = React.useState(false)
  const canEdit = canConsole("platform.member.edit")
  const isSuper = me?.console?.role.key === "super_admin"

  async function patch(m: ConsoleMember, body: Record<string, unknown>) {
    try {
      await api.patch(`/console/members/${m.id}`, body)
      toast.success("Console user updated")
      await members.reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (members.error) return <p className="text-sm text-destructive">{members.error.message}</p>
  if (!members.data || !roles.data) return <Skeleton className="h-96 rounded-4xl" />
  const all = members.data.data

  return (
    <>
      <PageHeader
        title="Console users"
        description="The AHEAD team. Roles decide what each person can do; “Reports to” decides whose clients a Sales Manager sees."
        actions={
          canConsole("platform.member.create") && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus /> Add user
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Reports to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((m) => {
                const self = m.user.id === me?.user.id
                const locked = !canEdit || (m.role.key === "super_admin" && !isSuper)
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">
                        {m.user.name} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.user.email}</div>
                    </TableCell>
                    <TableCell>
                      {locked || self ? (
                        m.role.name
                      ) : (
                        <NativeSelect className="h-8 w-48" value={m.role.key} onChange={(e) => patch(m, { roleKey: e.target.value })} aria-label={`Role for ${m.user.name}`}>
                          {roles.data!.data.filter((r) => r.key !== "super_admin" || isSuper).map((r) => (
                            <option key={r.key} value={r.key}>{r.name}</option>
                          ))}
                        </NativeSelect>
                      )}
                    </TableCell>
                    <TableCell>
                      {locked ? (
                        m.reportsTo?.name ?? "—"
                      ) : (
                        <NativeSelect className="h-8 w-44" value={m.reportsTo?.userId ?? ""} onChange={(e) => patch(m, { reportsTo: e.target.value || null })} aria-label={`Manager of ${m.user.name}`}>
                          <option value="">Nobody</option>
                          {all.filter((o) => o.id !== m.id && o.status === "active").map((o) => (
                            <option key={o.id} value={o.user.id}>{o.user.name}</option>
                          ))}
                        </NativeSelect>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status}</Badge>
                        {!locked && !self && (
                          <Button size="sm" variant="ghost" onClick={() => patch(m, { status: m.status === "active" ? "deactivated" : "active" })}>
                            {m.status === "active" ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-sm text-muted-foreground">{m.user.lastLoginAt ? formatDate(m.user.lastLoginAt) : "Never"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Roles</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.data.data.map((r) => {
          const keys = Object.entries(r.permissions)
          const scopes = [...new Set(keys.filter(([k]) => k === "platform.tenant.view").map(([, s]) => s))]
          return (
            <Card key={r.key}>
              <CardHeader>
                <CardTitle>{r.name}</CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {r.members} active · {keys.length} permissions{scopes[0] ? ` · sees ${SCOPE_TEXT[scopes[0]]}` : ""}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AddDialog open={open} onOpenChange={setOpen} roles={roles.data.data} members={all} onSaved={members.reload} />
    </>
  )
}
