"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import type { Scope } from "@/lib/types"

interface ConsoleDashboard {
  scope: Scope
  clients: { total: number; trialing: number; active: number; pastDue: number; free: number; closed: number }
  trialsEndingIn7Days: number
  newLast7Days: number
}

const SCOPE_TEXT: Record<Scope, string> = {
  all: "All clients",
  team: "Clients brought in by you and your team",
  own: "Clients you brought in",
  branch: "Clients you brought in",
}

export default function ConsoleDashboardPage() {
  const { me } = useAuth()
  const { data, error } = useApi<ConsoleDashboard>("/console/dashboard")

  const tiles = data
    ? [
        { label: "Clients", value: data.clients.total, hint: "Excludes AHEAD's own workspace" },
        { label: "On trial", value: data.clients.trialing, hint: `${data.trialsEndingIn7Days} ending in the next 7 days` },
        { label: "Paying", value: data.clients.active, hint: `${data.clients.pastDue} with a failed payment` },
        { label: "Free plan", value: data.clients.free, hint: `${data.clients.closed} closed` },
        { label: "New this week", value: data.newLast7Days, hint: "Signed up in the last 7 days" },
      ]
    : []

  return (
    <>
      <PageHeader title={`Welcome, ${me?.user.name.split(" ")[0] ?? ""}`} description={data ? SCOPE_TEXT[data.scope] : "AHEAD Console"} />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!data && !error && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-32 rounded-4xl" />)}
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader>
              <CardDescription>{t.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{t.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{t.hint}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            Payments, AHEAD invoices and assisted onboarding arrive in the next step. The first Super Admin is added with
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">npm run console:member</code>
            in the backend.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}
