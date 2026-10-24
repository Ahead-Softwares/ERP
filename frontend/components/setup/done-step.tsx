"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { SETUP_STEPS, type SetupStepKey } from "@contracts/workspace"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import type { Workspace } from "./wizard"

export function DoneStep({ workspace, goTo }: { workspace: Workspace; goTo: (k: SetupStepKey) => void }) {
  const { reload } = useAuth()
  const states = workspace.setup.steps
  const done = SETUP_STEPS.filter((s) => states[s.key] === "done").length

  // Reaching this screen finishes the wizard; skipped steps stay on the dashboard card
  const marked = React.useRef(false)
  React.useEffect(() => {
    if (marked.current) return
    marked.current = true
    void api.patch("/tenant/setup", { action: "complete" }).then(() => reload())
  }, [reload])

  return (
    <div className="grid content-start gap-6">
      <span className="grid size-14 place-items-center rounded-full bg-emerald-600 text-white">
        <Check className="size-7" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {done} of {SETUP_STEPS.length} set up.{done < SETUP_STEPS.length ? " Skipped steps stay on your dashboard until you finish them." : ""}
        </p>
      </div>
      <ul className="divide-y rounded-3xl border">
        {SETUP_STEPS.map((s) => {
          const st = states[s.key]
          return (
            <li key={s.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className={cn("grid size-6 place-items-center rounded-full", st === "done" ? "bg-emerald-600 text-white" : "border-2 border-dashed border-muted-foreground/40")}>{st === "done" && <Check className="size-3.5" />}</span>
              <span className="flex-1">{s.label}</span>
              {st !== "done" && (
                <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => goTo(s.key)}>
                  Set up now
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/m/billing/new" className={buttonVariants({ size: "lg" })}>
          Create your first invoice
        </Link>
        <Link href="/app" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
