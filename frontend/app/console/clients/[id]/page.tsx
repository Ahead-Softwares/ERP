"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, CalendarPlus, UserCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/app-shell"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatDateTime } from "@/lib/format"
import { ACQUIRER_LABEL, METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL, type AcquiredByType, type AcquisitionMethod, type ClientDetail, type ConsoleMember } from "@/lib/console"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function ExtendDialog({ client, open, onOpenChange, onDone }: { client: ClientDetail; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [days, setDays] = React.useState("7")
  const [reason, setReason] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const trial = client.status === "trialing"
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await api.post(`/console/tenants/${client.id}/extend`, { days: Number(days), reason })
      toast.success(trial ? "Trial extended" : "Grace extended")
      onOpenChange(false)
      setReason("")
      onDone()
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fields, form: errorMessage(err) } : { form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{trial ? "Extend the trial" : "Extend the payment grace"}</DialogTitle>
            <DialogDescription>Days are added to the later of today and the current end date. The reason is kept in the audit log.</DialogDescription>
          </DialogHeader>
          <Field label="Extra days" error={errors.days}>
            <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} required />
          </Field>
          <Field label="Reason" error={errors.reason}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Owner was travelling, asked for one more week" required />
          </Field>
          <FormError message={errors.form} />
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add days"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AcquisitionDialog({ client, open, onOpenChange, onDone }: { client: ClientDetail; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { canConsole } = useAuth()
  const members = useApi<{ data: ConsoleMember[] }>(open && canConsole("platform.member.view") ? "/console/members" : null)
  const a = client.acquisition
  const [form, setForm] = React.useState({ byType: (a?.byType ?? "self") as AcquiredByType, byUserId: a?.by?.id ?? "", method: (a?.method ?? "signup") as AcquisitionMethod, referralCode: a?.referralCode ?? "", couponCode: a?.couponCode ?? "", reason: "" })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const people = (members.data?.data ?? []).filter((m) => m.status === "active")
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await api.patch(`/console/tenants/${client.id}/acquisition`, {
        byType: form.byType,
        byUserId: form.byType === "self" ? null : form.byUserId || null,
        method: form.method,
        referralCode: form.referralCode || null,
        couponCode: form.couponCode || null,
        reason: form.reason,
      })
      toast.success("Updated who brought this client in")
      onOpenChange(false)
      onDone()
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fields, form: errorMessage(err) } : { form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Who brought this client in</DialogTitle>
            <DialogDescription>Locked at signup. Change it only with proof — commission reports follow this record. The client never sees it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brought in by" error={errors.byType}>
              <NativeSelect value={form.byType} onChange={(e) => setForm({ ...form, byType: e.target.value as AcquiredByType })}>
                {(Object.keys(ACQUIRER_LABEL) as AcquiredByType[]).filter((k) => k !== "partner_user").map((k) => (
                  <option key={k} value={k}>{ACQUIRER_LABEL[k]}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="How" error={errors.method}>
              <NativeSelect value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as AcquisitionMethod })}>
                {(Object.keys(METHOD_LABEL) as AcquisitionMethod[]).map((k) => (
                  <option key={k} value={k}>{METHOD_LABEL[k]}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {form.byType !== "self" && (
            <Field label="Person" error={errors.byUserId} hint={people.length ? undefined : "Console users load here when you can view them."}>
              <NativeSelect value={form.byUserId} onChange={(e) => setForm({ ...form, byUserId: e.target.value })} required>
                <option value="">Choose…</option>
                {a?.by && !people.some((p) => p.user.id === a.by!.id) && <option value={a.by.id}>{a.by.name}</option>}
                {people.map((p) => (
                  <option key={p.id} value={p.user.id}>{p.user.name} · {p.role.name}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Referral code" error={errors.referralCode}>
              <Input value={form.referralCode} onChange={(e) => setForm({ ...form, referralCode: e.target.value })} />
            </Field>
            <Field label="Coupon code" error={errors.couponCode}>
              <Input value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason for the change" error={errors.reason}>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </Field>
          <FormError message={errors.form} />
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const { canConsole } = useAuth()
  const { data: c, error, reload } = useApi<ClientDetail>(`/console/tenants/${id}`)
  const [extendOpen, setExtendOpen] = React.useState(false)
  const [acqOpen, setAcqOpen] = React.useState(false)

  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!c) return <Skeleton className="h-96 rounded-4xl" />
  const sub = c.subscription
  const canExtend = canConsole("platform.grace.create") && (c.status === "trialing" || c.status === "past_due")

  return (
    <>
      <Link href="/console/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <PageHeader
        title={c.name}
        description={`${c.industryKey} · joined ${formatDate(c.createdAt)}${c.isInternal ? " · AHEAD's own workspace" : ""}`}
        actions={
          <>
            {canExtend && (
              <Button variant="outline" onClick={() => setExtendOpen(true)}>
                <CalendarPlus /> {c.status === "trialing" ? "Extend trial" : "Extend grace"}
              </Button>
            )}
            {canConsole("platform.tenant.edit") && (
              <Button variant="outline" onClick={() => setAcqOpen(true)}>
                <UserCog /> Change source
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              <Badge variant={c.status === "past_due" ? "destructive" : "secondary"}>{STATUS_LABEL[c.status]}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Plan">{sub?.plan?.name ?? "—"}</Row>
            <Row label="Billing">{sub?.cycle === "yearly" ? "Yearly" : "Monthly"}</Row>
            {sub?.trialEndsAt && c.status === "trialing" && <Row label="Trial ends">{formatDate(sub.trialEndsAt)}</Row>}
            {sub?.currentPeriodEnd && <Row label="Renews">{formatDate(sub.currentPeriodEnd)}</Row>}
            {sub?.graceEndsAt && <Row label="Grace ends">{formatDate(sub.graceEndsAt)}</Row>}
            <Row label="Onboarding">{c.onboardingType === "trial" ? "Free trial" : "Paid up front"}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Owner and business identity</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Owner">{c.owner?.name ?? "—"}</Row>
            <Row label="Email">
              {c.owner?.email}
              {c.owner && !c.owner.emailVerified && <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">unverified</Badge>}
            </Row>
            <Row label="Mobile">{c.owner?.mobile ?? "—"}</Row>
            <Row label="Last sign-in">{c.owner?.lastLoginAt ? formatDateTime(c.owner.lastLoginAt) : "Never"}</Row>
            <Row label="GSTIN">{c.gstin ?? "—"}</Row>
            <Row label="Legal name">{c.legalName ?? "—"}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <CardDescription>{SOURCE_LABEL[c.source]} — never shown to the client</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Brought in by">{c.acquisition ? (c.acquisition.by ? c.acquisition.by.name : ACQUIRER_LABEL[c.acquisition.byType]) : "—"}</Row>
            <Row label="How">{c.acquisition ? METHOD_LABEL[c.acquisition.method] : "—"}</Row>
            {c.acquisition?.referralCode && <Row label="Referral code">{c.acquisition.referralCode}</Row>}
            {c.acquisition?.couponCode && <Row label="Coupon">{c.acquisition.couponCode}</Row>}
            {c.acquisition?.changeReason && <Row label="Last changed">{`${c.acquisition.changedBy ?? "Someone"}: ${c.acquisition.changeReason}`}</Row>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Counts only</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Active users">{`${c.usage.activeUsers}${sub?.plan ? ` / ${sub.plan.limits.users}` : ""}`}</Row>
            <Row label="Branches">{c.usage.branches}</Row>
            {Object.entries(c.usage.thisMonth).map(([metric, used]) => (
              <Row key={metric} label={`${metric} this month`}>{used}</Row>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {c.modules.map((m) => (
              <Badge key={m.key} variant={m.status === "active" ? "secondary" : "outline"} className={m.status === "inactive" ? "opacity-60" : undefined}>
                {m.key}
                {m.status === "read_only" ? " · read-only" : m.status === "active" && m.tier === "basic" ? " · basic" : ""}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Extra days and changes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {!c.extensions.length && !c.history.length && <p className="text-muted-foreground">Nothing yet.</p>}
            {c.extensions.map((e) => (
              <p key={e.id}>
                <span className="text-muted-foreground">{formatDateTime(e.createdAt)}</span> · {e.grantedBy ?? "Someone"} gave {e.days} extra {e.kind} day{e.days === 1 ? "" : "s"} (to {formatDate(e.newEndAt)}): {e.reason}
              </p>
            ))}
            {c.history.map((h) => (
              <p key={h.id}>
                <span className="text-muted-foreground">{formatDateTime(h.at)}</span> · {h.actor ?? "System"} · {h.action}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <ExtendDialog client={c} open={extendOpen} onOpenChange={setExtendOpen} onDone={reload} />
      {acqOpen && <AcquisitionDialog client={c} open={acqOpen} onOpenChange={setAcqOpen} onDone={reload} />}
    </>
  )
}
