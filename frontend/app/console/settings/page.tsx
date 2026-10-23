"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-shell"
import { Field, NativeSelect } from "@/components/form"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import type { Catalog, SettingRow } from "@/lib/console"
import type { PlanLimits } from "@/lib/types"

type Announcement = { text: string; tone: "info" | "warning"; until: string | null } | null

const ROLE_LABEL: Record<string, string> = { console_sales_executive: "Sales Executive", console_sales_manager: "Sales Manager", vendor: "Vendor" }
const LIMITS: { key: keyof PlanLimits; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "branches", label: "Branches" },
  { key: "contacts", label: "Contacts" },
  { key: "items", label: "Items" },
  { key: "invoicesPerMonth", label: "Invoices / month" },
  { key: "storageMb", label: "Storage (MB)" },
  { key: "aiCredits", label: "AI credits" },
]

/** One card = a group of settings saved together; values are kept as the JSON the API expects. */
function SettingCard({
  title,
  description,
  keys,
  rows,
  canEdit,
  onSaved,
  children,
}: {
  title: string
  description: string
  keys: string[]
  rows: SettingRow[]
  canEdit: boolean
  onSaved: () => void
  children: (draft: Record<string, unknown>, set: (key: string, value: unknown) => void) => React.ReactNode
}) {
  const initial = React.useMemo(() => Object.fromEntries(keys.map((k) => [k, rows.find((r) => r.key === k)?.value])), [keys, rows])
  const [draft, setDraft] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)
  const dirty = keys.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(initial[k]))
  const overridden = rows.filter((r) => keys.includes(r.key) && r.overridden)

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(message)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={!canEdit || busy} className="grid gap-4">
          {children(draft, (key, value) => setDraft((d) => ({ ...d, [key]: value })))}
        </fieldset>
      </CardContent>
      {canEdit && (
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {overridden.length > 0 && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => Promise.all(overridden.map((r) => api.delete(`/console/settings/${r.key}`))), "Back to defaults")}
            >
              Use defaults
            </Button>
          )}
          <Button disabled={busy || !dirty.length} onClick={() => run(() => Promise.all(dirty.map((k) => api.put(`/console/settings/${k}`, { value: draft[k] }))), "Settings saved")}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

const num = (v: string) => (v === "" ? 0 : Number(v))

export default function ConsoleSettingsPage() {
  const { canConsole } = useAuth()
  const settings = useApi<{ data: SettingRow[] }>("/console/settings")
  const catalog = useApi<Catalog>(canConsole("platform.plan.view") ? "/console/catalog" : null)
  const canEdit = canConsole("platform.setting.edit")

  if (settings.error) return <p className="text-sm text-destructive">{settings.error.message}</p>
  if (!settings.data) return <Skeleton className="h-96 rounded-4xl" />
  const rows = settings.data.data
  // Re-mount cards after a save so drafts restart from the stored values
  const v = rows.map((r) => r.version).join("-")
  const common = { rows, canEdit, onSaved: settings.reload }

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide rules. Changes apply within a minute and are kept in the audit log." />
      <div className="grid gap-4 lg:grid-cols-2">
        <SettingCard key={`trial-${v}`} title="Trial and grace" description="New signups and failed renewals" keys={["trial.days", "trial.plan_key", "grace.days_monthly", "grace.days_yearly"]} {...common}>
          {(d, set) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trial length (days)">
                <Input type="number" min={1} max={90} value={String(d["trial.days"])} onChange={(e) => set("trial.days", num(e.target.value))} />
              </Field>
              <Field label="Trial plan" hint="Plan a new trial is attached to">
                {catalog.data ? (
                  <NativeSelect value={String(d["trial.plan_key"])} onChange={(e) => set("trial.plan_key", e.target.value)}>
                    {catalog.data.plans.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input value={String(d["trial.plan_key"])} onChange={(e) => set("trial.plan_key", e.target.value)} />
                )}
              </Field>
              <Field label="Grace after failed monthly renewal (days)">
                <Input type="number" min={0} max={60} value={String(d["grace.days_monthly"])} onChange={(e) => set("grace.days_monthly", num(e.target.value))} />
              </Field>
              <Field label="Grace after failed yearly renewal (days)">
                <Input type="number" min={0} max={90} value={String(d["grace.days_yearly"])} onChange={(e) => set("grace.days_yearly", num(e.target.value))} />
              </Field>
            </div>
          )}
        </SettingCard>

        <SettingCard key={`limits-${v}`} title="Trial limits" description="What a trial client can use (empty = unlimited)" keys={["trial.limits"]} {...common}>
          {(d, set) => {
            const limits = d["trial.limits"] as PlanLimits
            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LIMITS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type="number"
                      min={0}
                      value={limits[f.key] === null ? "" : String(limits[f.key])}
                      onChange={(e) => set("trial.limits", { ...limits, [f.key]: e.target.value === "" && ["contacts", "items", "invoicesPerMonth"].includes(f.key) ? null : num(e.target.value) })}
                    />
                  </Field>
                ))}
              </div>
            )
          }}
        </SettingCard>

        <SettingCard key={`discount-${v}`} title="Discount limits" description="Highest discount each role may give without Super Admin approval (used in new-client checkout)" keys={["sales.discount_limits"]} {...common}>
          {(d, set) => {
            const limits = d["sales.discount_limits"] as Record<string, number>
            return (
              <div className="grid gap-4 sm:grid-cols-3">
                {Object.keys(ROLE_LABEL).map((role) => (
                  <Field key={role} label={`${ROLE_LABEL[role]} (%)`}>
                    <Input type="number" min={0} max={100} value={String(limits[role] ?? 0)} onChange={(e) => set("sales.discount_limits", { ...limits, [role]: num(e.target.value) })} />
                  </Field>
                ))}
              </div>
            )
          }}
        </SettingCard>

        <SettingCard key={`banner-${v}`} title="Announcement" description="One line on top of every client workspace — e.g. planned maintenance" keys={["announcement.banner"]} {...common}>
          {(d, set) => {
            const a = d["announcement.banner"] as Announcement
            const value = a ?? { text: "", tone: "info" as const, until: null }
            const update = (patch: Partial<NonNullable<Announcement>>) => {
              const next = { ...value, ...patch }
              set("announcement.banner", next.text.trim() ? next : null)
            }
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Text" className="sm:col-span-2" hint="Leave empty to show nothing">
                  <Input maxLength={200} value={value.text} onChange={(e) => update({ text: e.target.value })} />
                </Field>
                <Field label="Style">
                  <NativeSelect value={value.tone} onChange={(e) => update({ tone: e.target.value as "info" | "warning" })}>
                    <option value="info">Information</option>
                    <option value="warning">Warning</option>
                  </NativeSelect>
                </Field>
                <Field label="Show until" hint="Empty = until removed">
                  <Input
                    type="date"
                    value={value.until ? value.until.slice(0, 10) : ""}
                    onChange={(e) => update({ until: e.target.value ? new Date(`${e.target.value}T23:59:59+05:30`).toISOString() : null })}
                  />
                </Field>
              </div>
            )
          }}
        </SettingCard>
      </div>
    </>
  )
}
