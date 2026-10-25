"use client"

import * as React from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { SETUP_STEPS } from "@contracts/workspace"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

/** Owner-only card while the setup wizard has unfinished steps (wireframe 2.7 B). */
export function FinishSetupCard() {
  const { me, reload } = useAuth()
  const setup = me?.tenant?.onboarding?.setup
  const [hidden, setHidden] = React.useState(false)
  if (hidden || !setup || setup.cardDismissedAt) return null
  const done = SETUP_STEPS.filter((s) => setup.steps?.[s.key] === "done").length
  if (done === SETUP_STEPS.length) return null
  const next = SETUP_STEPS.find((s) => setup.steps?.[s.key] !== "done")!
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Finish setting up</CardTitle>
          <CardDescription className="mt-1">
            Next: <strong className="text-foreground">{next.label}</strong>
            {next.neededForInvoices ? " — needed before your first invoice" : ""}
          </CardDescription>
        </div>
        <button
          type="button"
          aria-label="Dismiss setup card"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            setHidden(true)
            void api.patch("/tenant/setup", { action: "dismiss_card" }).then(() => reload())
          }}
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={SETUP_STEPS.length}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${(done / SETUP_STEPS.length) * 100}%` }} />
        </div>
        <span className="text-sm font-medium tabular-nums">
          {done} of {SETUP_STEPS.length}
        </span>
        <Link href={`/app/setup?step=${next.key}`} className={buttonVariants()}>
          Continue setup
        </Link>
      </CardContent>
    </Card>
  )
}
