"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, X } from "lucide-react"
import type { ProvisioningStatus } from "@contracts/workspace"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

// Workspace loading (wireframe 1.7): real progress of the tenant.created jobs, tips while
// waiting, retry on failure, then straight into the setup wizard (owner) or the dashboard.

const TIPS = [
  "Customers can be imported from Excel in one go — you'll see the option in setup.",
  "Every word in the app — Clients, Patients, Students — can be renamed in Settings.",
  "Invoices pick CGST + SGST or IGST automatically from the customer's state.",
  "Invite your team with a role, so each person sees only what they need.",
  "Your trial includes every module. Nothing is deleted if you don't upgrade.",
]
const POLL_MS = 1000
const SLOW_AFTER_MS = 30_000

export default function WelcomePage() {
  const router = useRouter()
  const { me, reload, can } = useAuth()
  const [status, setStatus] = React.useState<ProvisioningStatus | null>(null)
  const [pollError, setPollError] = React.useState(false)
  const [tip, setTip] = React.useState(0)
  const [elapsed, setElapsed] = React.useState(0)
  const [retrying, setRetrying] = React.useState(false)
  const [finished, setFinished] = React.useState(false)
  const done = status?.state === "ready"

  // Poll until ready (or failed); keep polling after a retry
  React.useEffect(() => {
    if (done || status?.state === "failed") return
    let cancelled = false
    const tick = async () => {
      try {
        const s = await api.get<ProvisioningStatus>("/tenant/provisioning")
        if (!cancelled) {
          setStatus(s)
          setPollError(false)
        }
      } catch {
        if (!cancelled) setPollError(true)
      }
    }
    const t = setInterval(tick, POLL_MS)
    const first = setTimeout(tick, 0)
    return () => {
      cancelled = true
      clearInterval(t)
      clearTimeout(first)
    }
  }, [done, status?.state])

  React.useEffect(() => {
    const t = setInterval(() => {
      setTip((i) => (i + 1) % TIPS.length)
    }, 4000)
    const e = setInterval(() => setElapsed((x) => x + 1000), 1000)
    return () => {
      clearInterval(t)
      clearInterval(e)
    }
  }, [])

  // Ready: refresh /me (configApplied, terms), show the success state briefly, move on
  React.useEffect(() => {
    if (!done || finished) return
    let cancelled = false
    void reload().then((fresh) => {
      if (cancelled) return
      setFinished(true)
      const setup = fresh?.tenant?.onboarding?.setup
      const toWizard = !!fresh?.tenant?.isOwner && can("tenant.settings.edit") && !setup?.completedAt && !setup?.deferredAt
      setTimeout(() => router.replace(toWizard ? "/app/setup" : "/app?welcome=1"), 1200)
    })
    return () => {
      cancelled = true
    }
  }, [done, finished, reload, router, can])

  const retry = async () => {
    setRetrying(true)
    try {
      await api.post("/tenant/provisioning/retry")
      setStatus((s) => (s ? { ...s, state: "running", steps: s.steps.map((x) => (x.state === "failed" ? { ...x, state: "running" } : x)) } : s))
    } finally {
      setRetrying(false)
    }
  }

  const steps = status?.steps ?? [
    { key: "business", label: "Creating your business", state: "running" as const },
    { key: "roles", label: "Setting up roles and access", state: "waiting" as const },
    { key: "template", label: "Applying your industry setup", state: "waiting" as const },
    { key: "catalog", label: "Adding starter items", state: "waiting" as const },
    { key: "dashboard", label: "Getting your dashboard ready", state: "waiting" as const },
  ]
  const progress = Math.round((steps.filter((s) => s.state === "done").length / steps.length) * 100)
  const name = me?.tenant?.name ?? "your business"
  const failed = status?.state === "failed"

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4 py-10">
      <div className="grid w-full max-w-lg justify-items-center gap-6 text-center">
        <div className="relative grid size-28 place-items-center" aria-hidden>
          {!finished && !failed && <span className="absolute inset-0 rounded-[2rem] border-2 border-primary motion-safe:animate-ping motion-safe:[animation-duration:1.8s]" />}
          <span
            className={cn(
              "grid size-24 place-items-center rounded-[1.75rem] text-3xl font-extrabold text-primary-foreground shadow-lg transition-colors duration-500",
              finished ? "bg-emerald-600" : failed ? "bg-destructive" : "bg-primary motion-safe:animate-pulse"
            )}
          >
            {finished ? <Check className="size-10" /> : initials(name)}
          </span>
        </div>

        <div aria-live="polite">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{finished ? "Your workspace is ready" : failed ? "Setup hit a snag" : `Setting up ${name}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {finished
              ? "Opening it now…"
              : failed
                ? "Everything else is ready. Retry finishes only the step that failed."
                : elapsed > SLOW_AFTER_MS
                  ? "Taking a little longer than usual — you can keep this tab open or come back later; we'll keep going."
                  : "This usually takes under 15 seconds."}
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Setup progress">
          <div className={cn("h-full rounded-full transition-[width] duration-700", failed ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.max(progress, 8)}%` }} />
        </div>

        <ol className="grid w-full gap-1 rounded-4xl bg-card p-4 text-left shadow-md ring-1 ring-foreground/5">
          {steps.map((s) => (
            <li key={s.key} className={cn("flex items-center gap-3 rounded-2xl px-2 py-2.5 text-sm", s.state === "running" && "font-medium", s.state === "waiting" && "text-muted-foreground")}>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  s.state === "done" && "bg-emerald-600 text-white",
                  s.state === "failed" && "bg-destructive text-white",
                  s.state === "waiting" && "border-2 border-muted-foreground/30"
                )}
              >
                {s.state === "done" && <Check className="size-3.5" />}
                {s.state === "failed" && <X className="size-3.5" />}
                {s.state === "running" && <Loader2 className="size-5 text-primary motion-safe:animate-spin" />}
              </span>
              <span>{s.label}</span>
              <span className="sr-only">{s.state}</span>
            </li>
          ))}
        </ol>

        {failed ? (
          <div className="grid justify-items-center gap-3">
            <div className="flex gap-2">
              <Button onClick={retry} disabled={retrying}>
                {retrying ? "Retrying…" : "Retry"}
              </Button>
              <a href={`mailto:support@ahead.software?subject=Workspace%20setup%20${status?.reference ?? ""}`} className="inline-flex h-9 items-center rounded-4xl border px-4 text-sm font-medium">
                Contact support
              </a>
            </div>
            {status?.reference && <p className="text-xs text-muted-foreground">Reference: {status.reference}</p>}
          </div>
        ) : (
          !finished && <p className="min-h-10 max-w-md rounded-2xl border border-dashed px-4 py-2 text-sm text-muted-foreground">Tip · {TIPS[tip]}</p>
        )}
        {pollError && !failed && <p className="text-xs text-muted-foreground">Reconnecting…</p>}
      </div>
    </main>
  )
}
