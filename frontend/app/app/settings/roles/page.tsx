"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { MODULE_NAV } from "@/lib/nav"
import type { Role, Scope } from "@/lib/types"

interface Permission {
  key: string
  moduleKey: string
  resource: string
  action: string
  description: string
}

const SCOPE_LABEL: Record<Scope, string> = { own: "Own", team: "Team", branch: "Branch", all: "All" }
const MODULE_LABEL: Record<string, string> = { tenant: "Business settings", ...Object.fromEntries(MODULE_NAV.map((m) => [m.key, m.label])) }

function RoleDetail({ role, permissions, onClose }: { role: Role; permissions: Permission[]; onClose: () => void }) {
  const { data } = useApi<Role & { permissions: Record<string, Scope> }>(`/roles/${role.id}`)
  const grouped = React.useMemo(() => {
    const g = new Map<string, { p: Permission; scope: Scope }[]>()
    for (const p of permissions) {
      const scope = data?.permissions[p.key]
      if (!scope) continue
      g.set(p.moduleKey, [...(g.get(p.moduleKey) ?? []), { p, scope }])
    }
    return [...g.entries()]
  }, [data, permissions])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role.name}</DialogTitle>
          <DialogDescription>{role.description}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-40" />
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No permissions in your current modules.</p>
        ) : (
          <div className="grid gap-4">
            {grouped.map(([module, rows]) => (
              <div key={module}>
                <h3 className="mb-1.5 text-sm font-medium">{MODULE_LABEL[module] ?? module}</h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {rows.map(({ p, scope }) => (
                    <li key={p.key} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-1.5 text-xs">
                      <span>{p.description}</span>
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {SCOPE_LABEL[scope]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function RolesPage() {
  const { term } = useAuth()
  const roles = useApi<{ data: Role[] }>("/roles")
  const permissions = useApi<{ data: Permission[] }>("/permissions")
  const [selected, setSelected] = React.useState<Role | null>(null)

  if (!roles.data) return <Skeleton className="h-64 rounded-4xl" />
  const display = (r: Role) => (r.key === "service_provider" ? { ...r, name: term("role.service_provider", r.name) } : r)
  const core = roles.data.data.filter((r) => r.requiredModules.length === 0).map(display)
  const moduleRoles = roles.data.data.filter((r) => r.requiredModules.length > 0).map(display)

  const RoleCard = ({ r }: { r: Role }) => (
    <button onClick={() => setSelected(r)} className="rounded-3xl border p-4 text-left transition-colors hover:bg-muted">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{r.name}</span>
        <span className="text-xs text-muted-foreground">
          {r.memberCount} user{r.memberCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
      {r.requiredModules.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.requiredModules.map((m) => (
            <Badge key={m} variant="secondary" className="h-5 text-[10px]">
              {MODULE_LABEL[m] ?? m}
            </Badge>
          ))}
        </div>
      )}
    </button>
  )

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Core roles</CardTitle>
          <CardDescription>Available on every plan. One role per user.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {core.map((r) => (
            <RoleCard key={r.id} r={r} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Module roles</CardTitle>
          <CardDescription>Shown only when their module is active in your plan. Custom roles (clone & edit) come with paid plans.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {moduleRoles.length ? moduleRoles.map((r) => <RoleCard key={r.id} r={r} />) : <p className="text-sm text-muted-foreground">Upgrade to unlock module roles such as Cashier, HR Manager and Warehouse Manager.</p>}
        </CardContent>
      </Card>
      {selected && <RoleDetail role={selected} permissions={permissions.data?.data ?? []} onClose={() => setSelected(null)} />}
    </div>
  )
}
