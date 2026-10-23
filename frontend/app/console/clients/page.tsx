"use client"

import * as React from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { EmptyState, LoadMore, SearchInput } from "@/components/common"
import { NativeSelect } from "@/components/form"
import { useDebounced, useList } from "@/lib/use-list"
import { formatDate } from "@/lib/format"
import { SOURCE_LABEL, STATUS_LABEL, type ClientRow } from "@/lib/console"
import type { TenantStatus } from "@/lib/types"

export default function ClientsPage() {
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const q = useDebounced(search)
  const list = useList<ClientRow>("/console/tenants", { search: q, status })

  return (
    <>
      <PageHeader title="Clients" description="Account and plan details only — business records stay private to each client." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or GSTIN" className="min-w-56 flex-1" />
        <NativeSelect className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as TenantStatus[]).filter((s) => s !== "purged").map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.error && <p className="p-6 text-sm text-destructive">{list.error.message}</p>}
          {!list.loading && !list.rows.length && !list.error ? (
            <EmptyState icon={Building2} title="No clients here" description={q || status ? "Try a different search or status." : "Clients you can see will appear here."} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6">
                      <Link href={`/console/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.isInternal && <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">AHEAD</Badge>}
                      <div className="text-xs text-muted-foreground">{c.owner?.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "past_due" ? "destructive" : c.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[c.status]}</Badge>
                      {c.status === "trialing" && c.trialEndsAt && <div className="mt-1 text-xs text-muted-foreground">ends {formatDate(c.trialEndsAt)}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{c.plan ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {SOURCE_LABEL[c.source]}
                      {c.acquiredBy && <div className="text-xs text-muted-foreground">by {c.acquiredBy}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.activeUsers}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
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
