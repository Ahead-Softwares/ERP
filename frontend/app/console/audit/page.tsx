"use client"

import * as React from "react"
import { ScrollText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { EmptyState, LoadMore } from "@/components/common"
import { NativeSelect } from "@/components/form"
import { useList } from "@/lib/use-list"
import { formatDateTime } from "@/lib/format"

interface AuditRow {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  before: unknown
  after: unknown
  at: string
  actorName: string | null
}

const FILTERS = [
  { value: "", label: "Everything" },
  { value: "console.", label: "Console actions" },
  { value: "settings.", label: "Settings" },
  { value: "tenant.", label: "Client source changes" },
  { value: "auth.", label: "Sign-ins and switches" },
]

const short = (v: unknown) => {
  if (v === null || v === undefined) return ""
  const s = typeof v === "string" ? v : JSON.stringify(v)
  return s.length > 120 ? `${s.slice(0, 117)}…` : s
}

export default function ConsoleAuditPage() {
  const [action, setAction] = React.useState("")
  const list = useList<AuditRow>("/console/audit", { action })

  return (
    <>
      <PageHeader title="Audit log" description="Everything changed from the Console and at platform level. Actions inside a client's business stay in that client's own log." />
      <NativeSelect className="mb-4 w-56" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter">
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </NativeSelect>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.error && <p className="p-6 text-sm text-destructive">{list.error.message}</p>}
          {!list.loading && !list.rows.length && !list.error ? (
            <EmptyState icon={ScrollText} title="Nothing logged yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="pr-6">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6 text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                    <TableCell className="text-sm">{r.actorName ?? "System"}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{r.action}</div>
                      {r.entityId && <div className="text-xs text-muted-foreground">{r.entity}: {r.entityId}</div>}
                    </TableCell>
                    <TableCell className="max-w-md pr-6 font-mono text-xs break-all text-muted-foreground">
                      {r.before !== null && r.before !== undefined && <div>before: {short(r.before)}</div>}
                      {r.after !== null && r.after !== undefined && <div>after: {short(r.after)}</div>}
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
