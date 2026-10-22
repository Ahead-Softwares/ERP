"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CloudOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-svh place-items-center p-6 text-center text-sm text-muted-foreground">{children}</div>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status, me, reload, retry } = useAuth()
  const [retrying, setRetrying] = React.useState(false)

  React.useEffect(() => {
    if (status === "anonymous") router.replace("/login")
  }, [status, router])

  // LLD §11.1: the template is applied asynchronously right after signup
  const settingUp = status === "authenticated" && me?.tenant && !me.tenant.configApplied
  React.useEffect(() => {
    if (!settingUp) return
    const t = setInterval(() => void reload(), 1500)
    return () => clearInterval(t)
  }, [settingUp, reload])

  if (status === "unavailable") {
    return (
      <FullScreen>
        <div className="flex max-w-sm flex-col items-center gap-3">
          <CloudOff className="size-6" />
          <p className="font-medium text-foreground">Can&apos;t reach AHEAD right now</p>
          <p>The server or database isn&apos;t responding. You&apos;re still signed in — we&apos;ll reconnect automatically.</p>
          <Button
            variant="outline"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true)
              await retry()
              setRetrying(false)
            }}
          >
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </FullScreen>
    )
  }
  if (status !== "authenticated" || !me) {
    return (
      <FullScreen>
        <Loader2 className="size-5 animate-spin" aria-label="Loading" />
      </FullScreen>
    )
  }
  if (!me.tenant) {
    return (
      <FullScreen>
        <div className="max-w-sm">
          <p className="font-medium text-foreground">No active business</p>
          <p className="mt-1">You&apos;re not an active member of any business yet. Ask your administrator for an invitation.</p>
        </div>
      </FullScreen>
    )
  }
  if (settingUp) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin" />
          <p>Setting up your workspace…</p>
        </div>
      </FullScreen>
    )
  }
  return <AppShell>{children}</AppShell>
}
