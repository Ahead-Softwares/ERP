"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, CheckSquare, FilePlus2, Receipt, UserPlus, Wallet } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/common"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDateTime, formatPaise } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Summary {
  today: string
  sales?: {
    todayPaise: number
    todayCount: number
    monthPaise: number
    monthCount: number
    duesPaise: number
    duesCount: number
    overdueCount: number
    last7Days: { date: string; totalPaise: number }[]
    recent: { id: string; number: string; buyer: { name: string }; totalPaise: number; paidPaise: number; status: string }[]
  }
  collections?: { todayPaise: number; monthPaise: number }
  expenses?: { todayPaise: number; monthPaise: number }
  tasks?: { open: number; overdue: number; next: { id: string; title: string; dueAt: string | null; priority: string }[] }
  bookings?: { today: { id: string; title: string; startAt: string; status: string; kind: string }[] }
  followUps?: { due: number }
  crm?: { customers: number; openLeads: number }
}

function Stat({ label, value, sub, href, alert }: { label: string; value: string; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardContent className="grid gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {sub && <span className={cn("flex items-center gap-1 text-xs", alert ? "font-medium text-destructive" : "text-muted-foreground")}>{alert && <AlertTriangle className="size-3" />}{sub}</span>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

/** Single-series bar chart of daily sales; per-bar hover/focus tooltip, table view for screen readers. */
function SalesChart({ days }: { days: { date: string; totalPaise: number }[] }) {
  const [active, setActive] = React.useState<number | null>(null)
  const max = Math.max(...days.map((d) => d.totalPaise), 1)
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })
  return (
    <div>
      <div className="relative flex h-40 items-end gap-0.5 border-b border-border" role="img" aria-label="Sales for the last 7 days">
        {days.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 cursor-default items-end justify-center px-1 outline-none"
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <div
              className={cn("w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity", active !== null && active !== i && "opacity-40")}
              style={{ height: d.totalPaise ? `${Math.max(2, (d.totalPaise / max) * 100)}%` : "2px" }}
            />
            {active === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-xl border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md">
                <div className="text-muted-foreground">{label(d.date)}</div>
                <div className="font-semibold tabular-nums">{formatPaise(d.totalPaise, true)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5 text-center text-[11px] text-muted-foreground">
        {days.map((d) => <span key={d.date} className="flex-1">{label(d.date)}</span>)}
      </div>
      <table className="sr-only">
        <caption>Sales by day</caption>
        <tbody>{days.map((d) => <tr key={d.date}><th>{label(d.date)}</th><td>{formatPaise(d.totalPaise)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

export function DashboardWidgets() {
  const { can, term } = useAuth()
  const { data } = useApi<Summary>("/dashboard/summary")
  if (!data) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-4xl" />)}</div>

  const actions = [
    can("billing.invoice.create") && { href: "/app/m/billing/new", label: "New invoice", icon: Receipt },
    can("sales.quotation.create") && { href: "/app/m/sales/new", label: "New quotation", icon: FilePlus2 },
    can("crm.contact.create") && { href: "/app/m/crm", label: `Add ${term("entity.contact.singular", "customer").toLowerCase()}`, icon: UserPlus },
    (can("bookings.appointment.create") || can("bookings.event.create")) && { href: "/app/m/bookings", label: "Book", icon: CalendarDays },
    can("finance.expense.create") && { href: "/app/m/finance", label: "Add expense", icon: Wallet },
    can("tasks.task.create") && { href: "/app/m/tasks", label: "New task", icon: CheckSquare },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Receipt }[]

  return (
    <div className="grid gap-6">
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => <Link key={a.label} href={a.href} className={buttonVariants({ variant: "outline", size: "sm" })}><a.icon /> {a.label}</Link>)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.sales && <Stat label="Sales today" value={formatPaise(data.sales.todayPaise, true)} sub={`${data.sales.todayCount} invoice${data.sales.todayCount === 1 ? "" : "s"}`} href="/app/m/billing" />}
        {data.sales && <Stat label="Sales this month" value={formatPaise(data.sales.monthPaise, true)} sub={`${data.sales.monthCount} invoices`} href="/app/m/billing" />}
        {data.sales && <Stat label="Outstanding dues" value={formatPaise(data.sales.duesPaise, true)} sub={data.sales.overdueCount ? `${data.sales.overdueCount} overdue` : `${data.sales.duesCount} unpaid`} alert={data.sales.overdueCount > 0} href="/app/m/billing" />}
        {data.collections && <Stat label="Collected today" value={formatPaise(data.collections.todayPaise, true)} sub={`${formatPaise(data.collections.monthPaise, true)} this month`} />}
        {data.expenses && <Stat label="Expenses this month" value={formatPaise(data.expenses.monthPaise, true)} sub={data.sales ? `Net ${formatPaise(data.sales.monthPaise - data.expenses.monthPaise, true)} after sales` : undefined} href="/app/m/finance" />}
        {data.tasks && <Stat label="My open tasks" value={String(data.tasks.open)} sub={data.tasks.overdue ? `${data.tasks.overdue} overdue` : "None overdue"} alert={data.tasks.overdue > 0} href="/app/m/tasks" />}
        {data.followUps && <Stat label="Follow-ups due" value={String(data.followUps.due)} sub="today or earlier" alert={data.followUps.due > 0} href="/app/m/crm" />}
        {data.crm && <Stat label={term("entity.contact.plural", "Customers")} value={String(data.crm.customers)} sub={`${data.crm.openLeads} open ${term("entity.lead.plural", "leads").toLowerCase()}`} href="/app/m/crm" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.sales && (
          <Card>
            <CardHeader>
              <CardTitle>Sales, last 7 days</CardTitle>
              <CardDescription>Issued invoices incl. GST, cancelled excluded</CardDescription>
            </CardHeader>
            <CardContent><SalesChart days={data.sales.last7Days} /></CardContent>
          </Card>
        )}
        {data.bookings && (
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s {term("entity.appointment.plural", "appointments").toLowerCase()}</CardTitle>
              <CardDescription>{data.bookings.today.length || "No"} booking{data.bookings.today.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.bookings.today.length === 0 ? <p className="text-sm text-muted-foreground">A free day. <Link href="/app/m/bookings" className="underline">Open calendar</Link></p> : (
                <ul className="grid gap-2 text-sm">
                  {data.bookings.today.map((b) => (
                    <li key={b.id} className="flex items-center gap-3">
                      <span className="w-16 tabular-nums text-muted-foreground">{new Date(b.startAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                      <span className="flex-1 truncate">{b.title}</span>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
        {data.sales && (
          <Card>
            <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
            <CardContent>
              {data.sales.recent.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : (
                <ul className="divide-y text-sm">
                  {data.sales.recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/app/m/billing/${r.id}`} className="flex items-center gap-3 py-2 hover:underline">
                        <span className="w-28 font-mono text-xs">{r.number}</span>
                        <span className="flex-1 truncate">{r.buyer.name}</span>
                        <StatusBadge status={r.status} />
                        <span className="w-24 text-right tabular-nums">{formatPaise(r.totalPaise)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
        {data.tasks && (
          <Card>
            <CardHeader><CardTitle>My next tasks</CardTitle></CardHeader>
            <CardContent>
              {data.tasks.next.length === 0 ? <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p> : (
                <ul className="grid gap-2 text-sm">
                  {data.tasks.next.map((t) => (
                    <li key={t.id}>
                      <Link href={`/app/m/tasks/${t.id}`} className="flex items-center gap-3 hover:underline">
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.dueAt && <span className={cn("text-xs", new Date(t.dueAt) < new Date() ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDateTime(t.dueAt)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
