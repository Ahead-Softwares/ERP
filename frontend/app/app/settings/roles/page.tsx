"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { SENSITIVE_FIELDS, rolePermissionProblem } from "@contracts/account"
import { changeReason } from "@contracts/validation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FormError, NativeSelect } from "@/components/form"
import { ErrorState, NoAccess } from "@/components/page-states"
import { SettingsPage } from "@/components/settings-shell"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { MODULE_NAV } from "@/lib/nav"
import { useApi } from "@/lib/use-api"
import type { Role, Scope } from "@/lib/types"
import { cn } from "@/lib/utils"

// Settings › Roles & permissions (wireframe X4). Predefined roles are read-only; clone one to
// customise. The matrix has a row per resource and a column per action, with one scope per row.

interface Permission {
  key: string
  moduleKey: string
  resource: string
  action: string
  label: string
  description: string
}

interface RoleDetail extends Role {
  isCustom: boolean
  version: number
  clonedFromName: string | null
  permissions: Record<string, Scope>
  fieldAccess: Record<string, "hidden" | "read" | "write">
  members: { memberId: string; userId: string; name: string; email: string; status: string }[]
}

const ACTIONS = ["view", "create", "edit", "delete", "export", "approve"] as const
const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "branch", label: "Branch" },
  { key: "team", label: "Team" },
  { key: "own", label: "Own" },
]
const MODULE_LABEL: Record<string, string> = { tenant: "Business", ...Object.fromEntries(MODULE_NAV.map((m) => [m.key, m.label])) }

interface Row {
  id: string
  module: string
  label: string
  keys: Partial<Record<(typeof ACTIONS)[number], string>>
}

export default function RolesPage() {
  const { can, me } = useAuth()
  const roles = useApi<{ data: Role[] }>(can("tenant.role.view") ? "/roles" : null)
  const perms = useApi<{ data: Permission[] }>(can("tenant.role.view") ? "/permissions" : null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState<{ from: Role | null } | null>(null)
  if (!can("tenant.role.view")) return <NoAccess what="Roles & permissions" />
  const error = roles.error ?? perms.error
  if (error && !roles.data) return <ErrorState error={error} onRetry={roles.reload} />

  const list = roles.data?.data ?? []
  const predefined = list.filter((r) => r.isPredefined)
  const custom = list.filter((r) => !r.isPredefined)
  const current = list.find((r) => r.id === selected) ?? custom[0] ?? predefined.find((r) => r.key !== "owner") ?? list[0]
  const freePlan = me?.subscription?.status === "free"
  const canCreate = can("tenant.role.create") && !freePlan

  return (
    <SettingsPage
      title="Roles & permissions"
      crumb
      className="max-w-none"
      actions={
        <Button variant="outline" disabled={!canCreate} title={freePlan ? "Custom roles need a paid plan" : undefined} onClick={() => setCreating({ from: null })}>
          + New role from scratch
        </Button>
      }
    >
      {freePlan && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Custom roles need a paid plan. Predefined roles keep working.{" "}
          {can("tenant.billing.view") && (
            <Link href="/app/billing" className="font-semibold underline">
              See plans
            </Link>
          )}
        </p>
      )}
      <div className="flex flex-col gap-4 lg:flex-row">
        <nav aria-label="Roles" className="flex shrink-0 flex-col gap-0.5 rounded-xl border bg-card p-2.5 lg:w-[250px]">
          {!roles.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <p className="px-2.5 py-1 text-[11px] font-bold tracking-[.06em] text-muted-foreground uppercase">Predefined</p>
              {predefined.map((r) => (
                <RoleItem key={r.id} role={r} active={current?.id === r.id} onClick={() => setSelected(r.id)} />
              ))}
              <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-bold tracking-[.06em] text-muted-foreground uppercase">Custom</p>
              {custom.length ? custom.map((r) => <RoleItem key={r.id} role={r} active={current?.id === r.id} onClick={() => setSelected(r.id)} />) : <p className="px-2.5 py-1 text-xs text-muted-foreground">None yet</p>}
              <p className="mt-auto px-2.5 pt-3 text-xs leading-relaxed text-muted-foreground">Predefined roles can&apos;t be edited — clone one to customise it.</p>
            </>
          )}
        </nav>
        <div className="min-w-0 flex-1">
          {current && perms.data ? (
            <RoleEditor
              key={current.id}
              roleId={current.id}
              permissions={perms.data.data}
              canCreate={canCreate}
              onClone={(r) => setCreating({ from: r })}
              onChanged={async (id) => {
                await roles.reload()
                if (id !== undefined) setSelected(id)
              }}
            />
          ) : (
            <Skeleton className="h-[480px] rounded-xl" />
          )}
        </div>
      </div>
      <NewRoleDialog
        open={!!creating}
        from={creating?.from ?? null}
        roles={list}
        onClose={() => setCreating(null)}
        onCreated={async (id) => {
          setCreating(null)
          await roles.reload()
          setSelected(id)
        }}
      />
    </SettingsPage>
  )
}

function RoleItem({ role, active, onClick }: { role: Role; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined} className={cn("flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted", active && "bg-accent font-bold text-accent-foreground")}>
      <span className="truncate">
        {role.name}
        {!role.isPredefined && " (custom)"}
      </span>
      <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
        {role.memberCount}
        {role.key === "owner" ? " · fixed" : ""}
      </span>
    </button>
  )
}

function buildRows(permissions: Permission[]): Row[] {
  const rows = new Map<string, Row>()
  for (const p of permissions) {
    const id = `${p.moduleKey}.${p.resource}`
    const row = rows.get(id) ?? { id, module: p.moduleKey, label: p.label, keys: {} }
    if ((ACTIONS as readonly string[]).includes(p.action)) row.keys[p.action as (typeof ACTIONS)[number]] = p.key
    rows.set(id, row)
  }
  return [...rows.values()]
}

function RoleEditor({ roleId, permissions, canCreate, onClone, onChanged }: { roleId: string; permissions: Permission[]; canCreate: boolean; onClone: (r: Role) => void; onChanged: (selectId?: string | null) => Promise<void> }) {
  const { can } = useAuth()
  const { data, error, reload } = useApi<RoleDetail>(`/roles/${roleId}`)
  const [tab, setTab] = React.useState<"permissions" | "fields" | "people">("permissions")
  const [draft, setDraft] = React.useState<Record<string, Scope> | null>(null)
  const [fields, setFields] = React.useState<Record<string, "hidden" | "read" | "write"> | null>(null)
  const [note, setNote] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [touched, setTouched] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const rows = React.useMemo(() => buildRows(permissions), [permissions])
  const catalog = React.useMemo(() => permissions.map((p) => p.key), [permissions])

  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Skeleton className="h-[480px] rounded-xl" />

  const editable = data.isCustom && can("tenant.role.edit")
  const perms = draft ?? data.permissions
  const fa = fields ?? data.fieldAccess
  const dirty = !!draft || !!fields
  const people = data.members.length
  const problem = rolePermissionProblem(Object.keys(perms), catalog)

  const toggle = (row: Row, action: (typeof ACTIONS)[number], on: boolean) => {
    const next = { ...perms }
    const scope = rowScope(row)
    const key = row.keys[action]!
    setNote(null)
    if (on) {
      next[key] = scope
      // View comes first; Delete needs Edit
      if (action !== "view" && row.keys.view) next[row.keys.view] = scope
      if (action === "delete" && row.keys.edit) next[row.keys.edit] = scope
    } else {
      delete next[key]
      if (action === "view") {
        // Turning View off clears the row
        const cleared = Object.values(row.keys).filter((k) => k && next[k])
        for (const k of Object.values(row.keys)) if (k) delete next[k]
        if (cleared.length) setNote(`${row.label}: View off cleared the row`)
      }
      if (action === "edit" && row.keys.delete && next[row.keys.delete]) {
        delete next[row.keys.delete]
        setNote(`${row.label}: Delete needs Edit, so it was cleared too`)
      }
    }
    setDraft(next)
  }
  const rowScope = (row: Row): Scope => {
    const k = Object.values(row.keys).find((x) => x && perms[x])
    return (k && perms[k]) || "all"
  }
  const setScope = (row: Row, scope: Scope) => {
    const next = { ...perms }
    for (const k of Object.values(row.keys)) if (k && next[k]) next[k] = scope
    setDraft(next)
  }
  const discard = () => {
    setDraft(null)
    setFields(null)
    setNote(null)
    setConfirming(false)
    setReason("")
    setTouched(false)
    setFormError(null)
  }

  const save = async () => {
    setTouched(true)
    if (people > 0 && changeReason(reason)) return
    setSaving(true)
    setFormError(null)
    try {
      await api.patch(`/roles/${roleId}`, { version: data.version, ...(draft ? { permissions: draft } : {}), ...(fields ? { fieldAccess: fields } : {}), ...(people > 0 ? { reason: reason.trim() } : {}) })
      toast.success(`${data.name} saved${people ? ` — applies to ${people} ${people === 1 ? "person" : "people"} from their next action` : ""}`)
      discard()
      await reload()
      await onChanged()
    } catch (e) {
      if (e instanceof ApiError && e.code === "VERSION_CONFLICT") setFormError("Someone else changed this role. Reload to see their changes — yours aren't saved.")
      else setFormError(e instanceof ApiError && Object.keys(e.fields).length ? Object.values(e.fields)[0] : errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const visibleFields = SENSITIVE_FIELDS.filter((f) => permissions.some((p) => p.moduleKey === f.module))
  const tabs = [
    ["permissions", "Permissions"],
    ["fields", "Field access"],
    ["people", `People (${people})`],
  ] as const

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border bg-card px-[18px] py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold">{data.name}</h2>
          <p className="text-xs text-muted-foreground">
            {data.isCustom ? (data.clonedFromName ? `Cloned from ${data.clonedFromName}` : "Custom role") : "Predefined · read-only"} · used by {people} {people === 1 ? "person" : "people"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.key !== "owner" && (
            <Button variant="outline" size="sm" disabled={!canCreate} onClick={() => onClone(data)}>
              Clone
            </Button>
          )}
          {data.isCustom && can("tenant.role.delete") && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          )}
          {editable && (
            <Button size="sm" disabled={!dirty || !!problem} onClick={() => (people > 0 ? setConfirming(true) : void save())}>
              Save changes
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-5 border-b" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("-mb-px border-b-2 border-transparent px-0.5 py-2 text-[13px] font-semibold text-muted-foreground", tab === key && "border-primary text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "permissions" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2.5 py-2 font-semibold">Module</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-2 text-center font-semibold capitalize">
                      {a}
                    </th>
                  ))}
                  <th className="min-w-[160px] px-2.5 py-2 font-semibold">Scope</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const showModule = i === 0 || rows[i - 1].module !== row.module
                  const viewOff = !!row.keys.view && !perms[row.keys.view]
                  const any = Object.values(row.keys).some((k) => k && perms[k])
                  return (
                    <React.Fragment key={row.id}>
                      {showModule && (
                        <tr>
                          <td colSpan={ACTIONS.length + 2} className="px-2.5 pt-3 pb-1 text-[11px] font-bold tracking-[.06em] text-muted-foreground uppercase">
                            {MODULE_LABEL[row.module] ?? row.module}
                          </td>
                        </tr>
                      )}
                      <tr className={cn("border-b border-border/60", note?.startsWith(row.label) && "bg-amber-50 dark:bg-amber-950/30")}>
                        <td className="px-2.5 py-2 font-semibold">{row.label}</td>
                        {ACTIONS.map((a) => {
                          const key = row.keys[a]
                          if (!key) return <td key={a} className="px-2 py-2 text-center text-input">—</td>
                          const disabled = !editable || (a !== "view" && viewOff) || (a === "delete" && !!row.keys.edit && !perms[row.keys.edit])
                          return (
                            <td key={a} className="px-2 py-2 text-center">
                              <input type="checkbox" className="size-4 accent-primary disabled:opacity-40" aria-label={`${row.label} ${a}`} checked={!!perms[key]} disabled={disabled} onChange={(e) => toggle(row, a, e.target.checked)} />
                            </td>
                          )
                        })}
                        <td className="px-2.5 py-2">
                          {note?.startsWith(row.label) ? (
                            <span className="text-[11px] text-amber-800 dark:text-amber-200">{note.slice(row.label.length + 2)}</span>
                          ) : row.module === "tenant" || !any ? (
                            <span className="text-input">—</span>
                          ) : (
                            <NativeSelect className="h-7 w-24 text-xs" aria-label={`${row.label} scope`} value={rowScope(row)} disabled={!editable} onChange={(e) => setScope(row, e.target.value as Scope)}>
                              {SCOPES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Delete needs Edit · issued invoices can never be deleted (cancel or credit note instead) · Scope: Own = records they created, Team = their team&apos;s, Branch = their branches&apos;.</p>
          {problem && <FormError message={problem} />}
        </>
      )}

      {tab === "fields" && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">Sensitive fields. Hidden fields don&apos;t appear on screens, prints or exports for this role.</p>
          <table className="w-full max-w-xl text-[13px]">
            <tbody>
              {visibleFields.map((f) => {
                const key = `${f.entity}.${f.field}`
                return (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <td className="py-2">
                      <div className="font-semibold">{f.label}</div>
                      <div className="text-xs text-muted-foreground">{f.hint}</div>
                    </td>
                    <td className="py-2 text-right">
                      <NativeSelect className="h-8 w-28 text-xs" aria-label={`${f.label} access`} value={fa[key] ?? "hidden"} disabled={!editable} onChange={(e) => setFields({ ...fa, [key]: e.target.value as "hidden" | "read" | "write" })}>
                        <option value="hidden">Hidden</option>
                        <option value="read">Read</option>
                        <option value="write">Edit</option>
                      </NativeSelect>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "people" && (
        <div className="grid gap-1.5">
          {data.members.length ? (
            data.members.map((m) => (
              <div key={m.memberId} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-[13px] last:border-0">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{m.status}</span>
              </div>
            ))
          ) : (
            <p className="py-2 text-[13px] text-muted-foreground">Nobody has this role yet.</p>
          )}
          <Link href="/app/settings/team" className="text-xs font-semibold text-primary hover:underline">
            Change someone&apos;s role in Team
          </Link>
        </div>
      )}

      {confirming && dirty && (
        <div className="mt-1 grid gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3.5 py-3 text-[13px] dark:border-amber-800 dark:bg-amber-950/40">
          <p>
            <strong>Save changes?</strong> This affects {people} {people === 1 ? "person" : "people"} ({data.members.slice(0, 3).map((m) => m.name).join(", ")}
            {people > 3 ? ` and ${people - 3} more` : ""}) from their next action. A reason is kept in the audit log.
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-[240px] flex-1">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} placeholder="Reason (10–500 characters)" aria-label="Reason for the change" aria-invalid={touched && !!changeReason(reason)} autoFocus />
              {touched && changeReason(reason) && <p className="mt-1 text-xs text-destructive">{changeReason(reason)}</p>}
            </div>
            <Button variant="ghost" onClick={discard} disabled={saving}>
              Discard
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      )}
      {dirty && !confirming && editable && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          Unsaved changes
          <Button variant="ghost" size="sm" onClick={discard}>
            Discard
          </Button>
        </div>
      )}
      <FormError message={formError} />

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {data.name}?</DialogTitle>
            <DialogDescription>{people ? `${people} ${people === 1 ? "person has" : "people have"} this role. Give them another role in Team first.` : "This can't be undone."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={people > 0}
              onClick={async () => {
                try {
                  await api.delete(`/roles/${roleId}`)
                  toast.success(`${data.name} deleted`)
                  setDeleting(false)
                  await onChanged(null)
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              }}
            >
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function NewRoleDialog({ open, from, roles, onClose, onCreated }: { open: boolean; from: Role | null; roles: Role[]; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = React.useState("")
  const [source, setSource] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      setName(from ? `${from.name} (copy)` : "")
      setSource(from?.id ?? "")
      setError(null)
    })
    return () => clearTimeout(t)
  }, [open, from])
  const submit = async () => {
    const n = name.trim()
    if (n.length < 2 || n.length > 40) return setError("Use 2–40 characters")
    if (roles.some((r) => r.name.toLowerCase() === n.toLowerCase())) return setError("A role with this name already exists")
    setBusy(true)
    try {
      const created = await api.post<{ id: string }>("/roles", { name: n, fromRoleId: source || null })
      toast.success(`${n} created`)
      await onCreated(created.id)
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields.name ?? e.message) : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{from ? `Clone ${from.name}` : "New role"}</DialogTitle>
          <DialogDescription>Starts with the permissions of the role you pick. You can change everything after.</DialogDescription>
        </DialogHeader>
        <Field label="Role name" required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus maxLength={40} />
        </Field>
        <Field label="Start from">
          <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Nothing — no permissions</option>
            {roles
              .filter((r) => r.key !== "owner")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
