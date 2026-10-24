"use client"

import * as React from "react"
import Link from "next/link"
import { CreditCard } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/app-shell"
import { EmptyState, LoadMore } from "@/components/common"
import { useList } from "@/lib/use-list"
import { formatDate, formatPaise } from "@/lib/format"
import { OrderBadge } from "@/components/order-badge"
import type { OrderRow } from "@/lib/console"

const TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending_approval", label: "Needs approval" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
]

export default function PaymentsPage() {
  const [status, setStatus] = React.useState("")
  const list = useList<OrderRow>("/console/orders", { status })

  return (
    <>
      <PageHeader title="Payments" description="Orders from new clients, the money received and AHEAD's GST invoices." />
      <Tabs value={status} onValueChange={(v) => setStatus(String(v))} className="mb-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.error && <p className="p-6 text-sm text-destructive">{list.error.message}</p>}
          {!list.loading && !list.rows.length && !list.error ? (
            <EmptyState icon={CreditCard} title="No orders here" description="Orders appear when a client is created from Clients → New client." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="pr-6">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6">
                      <Link href={`/console/payments/${o.id}`} className="font-medium hover:underline">
                        {o.clientName ?? "Client"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {o.kind === "renewal" ? "renewal · " : ""}{o.cycle} · by {o.createdByName ?? "System"}
                        {o.discountBp > 0 && ` · ${o.discountBp / 100}% off`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrderBadge status={o.status} />
                      {o.status === "awaiting_payment" && <div className="mt-1 text-xs text-muted-foreground">lapses {formatDate(o.expiresAt)}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPaise(o.totalPaise)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="pr-6 text-sm">
                      {o.invoice ? (
                        <Link href={`/console/invoices/${o.invoice.id}`} className="font-mono hover:underline">{o.invoice.number}</Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </CardContent>
      </Card>
    </>
  )
}
