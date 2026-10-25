"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/page-states"
import { api, errorMessage } from "@/lib/api"
import type { AccountOverview } from "@/lib/account"
import { useAuth } from "@/lib/auth"
import { formatDate, initials } from "@/lib/format"
import { useApi } from "@/lib/use-api"

// My account › My businesses: every business this person works in, with the role.

export default function MyBusinessesPage() {
  const { data, error, reload } = useApi<AccountOverview>("/account")
  const { me, switchTenant, reload: reloadMe } = useAuth()
  const router = useRouter()
  const [leaving, setLeaving] = React.useState<AccountOverview["businesses"][number] | null>(null)
  const [busy, setBusy] = React.useState(false)
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="flex max-w-3xl flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">My businesses</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">One sign-in for every business you work with.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/signup?mode=business")}>
          + Add another business
        </Button>
      </div>
      {!data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <section className="divide-y rounded-xl border bg-card">
          {data.businesses.map((b) => {
            const current = b.tenantId === me?.tenant?.id
            return (
              <div key={b.tenantId} className="flex flex-wrap items-center gap-3 px-[18px] py-3.5">
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt="" className="size-9 rounded-lg border bg-white object-contain p-0.5" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{initials(b.name)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {b.name}
                    {current && <Badge variant="secondary">Open now</Badge>}
                    {b.status === "closed" && <Badge variant="outline">Closed</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.isOwner ? "Owner" : b.roleName}
                    {b.joinedAt ? ` · joined ${formatDate(b.joinedAt)}` : ""}
                  </div>
                </div>
                {!current && (
                  <Button variant="outline" size="sm" onClick={() => switchTenant(b.tenantId).then(() => router.push("/app"))}>
                    Open
                  </Button>
                )}
                {!b.isOwner && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setLeaving(b)}>
                    Leave
                  </Button>
                )}
              </div>
            )
          })}
        </section>
      )}
      <p className="text-xs text-muted-foreground">Owners can&apos;t leave their own business — close it from Settings › Data instead.</p>
      <Dialog open={!!leaving} onOpenChange={(o) => !o && setLeaving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave {leaving?.name}?</DialogTitle>
            <DialogDescription>You lose access right away. An admin of {leaving?.name} can invite you again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaving(null)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!leaving) return
                setBusy(true)
                try {
                  await api.post(`/account/businesses/${leaving.tenantId}/leave`)
                  toast.success(`You left ${leaving.name}`)
                  setLeaving(null)
                  await Promise.all([reload(), reloadMe()])
                } catch (e) {
                  toast.error(errorMessage(e))
                } finally {
                  setBusy(false)
                }
              }}
            >
              Leave business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
