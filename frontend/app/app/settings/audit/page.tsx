"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { toast } from "sonner"

interface Entry {
  id: string
  action: string
  actorKind: string
  actorName: string | null
  entity: string | null
  ip: string | null
  at: string
}

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.password_reset": "Reset password",
  "tenant.created": "Created the business",
  "tenant.update": "Updated business details",
  "branch.create": "Added a branch",
  "branch.update": "Updated a branch",
  "member.invite": "Invited a user",
  "member.invite_revoke": "Revoked an invitation",
  "member.joined": "Joined the business",
  "member.update": "Updated a user",
  "member.role_change": "Changed a user's role",
  "config.terms.update": "Changed terminology",
  "config.field.create": "Added a custom field",
  "config.field.update": "Changed a custom field",
  "subscription.transition": "Subscription changed",
}

export default function AuditPage() {
  const [rows, setRows] = React.useState<Entry[]>([])
  const [cursor, setCursor] = React.useState<string | null | undefined>(undefined)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async (from?: string) => {
    setLoading(true)
    try {
      const r = await api.get<{ data: Entry[]; nextCursor: string | null }>(`/audit-log?limit=50${from ? `&cursor=${from}` : ""}`)
      setRows((prev) => (from ? [...prev, ...r.data] : r.data))
      setCursor(r.nextCursor)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    api
      .get<{ data: Entry[]; nextCursor: string | null }>("/audit-log?limit=50")
      .then((r) => {
        if (cancelled) return
        setRows(r.data)
        setCursor(r.nextCursor)
      })
      .catch((e) => toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Sign-ins, role changes, plan changes, deletes, exports and financial actions. Kept for at least 2 years and cannot be edited.</p>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                  <TableCell>{r.actorName ?? (r.actorKind === "system" ? "System" : "AHEAD")}</TableCell>
                  <TableCell>{ACTION_LABEL[r.action] ?? r.action}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {cursor && (
        <Button variant="outline" className="justify-self-center" disabled={loading} onClick={() => load(cursor)}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  )
}
