"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, CheckCircle2, Circle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { MODULE_NAV } from "@/lib/nav"
import { formatDate } from "@/lib/format"
import { DashboardWidgets } from "./dashboard-widgets"

const STEP_LINKS: Record<string, string> = {
  profile: "/app/settings",
  logo: "/app/settings",
  first_customer: "/app/m/crm",
  first_item: "/app/m/catalog",
  first_invoice: "/app/m/billing/new",
  invite_team: "/app/settings/team",
}

function Checklist() {
  const { data } = useApi<{ steps: { key: string; label: string; done: boolean }[] }>("/tenant/onboarding")
  if (!data) return <Skeleton className="h-64 rounded-4xl" />
  const done = data.steps.filter((s) => s.done).length
  if (done === data.steps.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Get set up</CardTitle>
        <CardDescription>
          {done} of {data.steps.length} done — most businesses send their first invoice in under 15 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={data.steps.length}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / data.steps.length) * 100}%` }} />
        </div>
        <ul className="grid gap-1">
          {data.steps.map((s) => (
            <li key={s.key}>
              <Link href={STEP_LINKS[s.key] ?? "/app"} className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm hover:bg-muted">
                {s.done ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />}
                <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                {!s.done && <ArrowRight className="ml-auto size-4 text-muted-foreground" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const { me, can, canView, term } = useAuth()
  const welcome = useSearchParams().get("welcome")
  const sub = me?.subscription
  const recommended = me?.tenant?.onboarding?.recommendedModules ?? []
  const modules = MODULE_NAV.filter((m) => canView(m.key)).sort((a, b) => {
    const ia = recommended.indexOf(a.key)
    const ib = recommended.indexOf(b.key)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }))
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <>
      <PageHeader
        title={welcome ? `Welcome to AHEAD, ${me?.user.name.split(" ")[0]}!` : `${greeting}, ${me?.user.name.split(" ")[0]}`}
        description={welcome ? "Your workspace is ready. Here's how to get going." : me?.tenant?.name}
      />

      {can("reports.dashboard.view") && (
        <div className="mb-6">
          <DashboardWidgets />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          {can("tenant.settings.edit") && <Checklist />}

          <Card>
            <CardHeader>
              <CardTitle>Your modules</CardTitle>
              <CardDescription>Ordered for your industry. Locked modules unlock with a paid plan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {modules.map((m) => {
                const ent = me?.modules?.[m.key]
                return (
                  <Link key={m.key} href={`/app/m/${m.key}`} className="flex items-start gap-3 rounded-3xl border p-3 transition-colors hover:bg-muted">
                    <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-muted">
                      <m.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {m.termKey ? term(m.termKey, m.label) : m.label}
                        {ent?.status === "read_only" && <Badge variant="outline">Read-only</Badge>}
                        {ent?.status === "active" && ent.tier === "basic" && <Badge variant="secondary">Free</Badge>}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
              <CardDescription>
                {sub?.status === "trialing" && sub.trialEndsAt
                  ? `Free trial · ends ${formatDate(sub.trialEndsAt)}`
                  : sub?.status === "free"
                    ? "Free plan"
                    : `${sub?.planKey?.replace("_", " ")} plan`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {sub?.status === "trialing" && (
                <p className="text-muted-foreground">
                  All 12 modules are unlocked during your trial. If you don&apos;t upgrade, you move to the Free plan and keep all your data.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Users</dt>
                <dd className="text-right">{me?.limits?.users}</dd>
                <dt className="text-muted-foreground">Branches</dt>
                <dd className="text-right">{me?.limits?.branches}</dd>
                <dt className="text-muted-foreground">AI credits</dt>
                <dd className="text-right">{me?.limits?.aiCredits}</dd>
              </dl>
              {can("tenant.billing.view") && (
                <Link href="/app/billing" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                  Compare plans
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default function DashboardPage() {
  return (
    <React.Suspense>
      <Dashboard />
    </React.Suspense>
  )
}
