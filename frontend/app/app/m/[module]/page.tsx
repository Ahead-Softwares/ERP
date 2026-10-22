"use client"

import * as React from "react"
import Link from "next/link"
import { Construction, Lock } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"
import { MODULE_NAV } from "@/lib/nav"

// Placeholder for business modules that are still being built (see TASKS.md for the plan).
export default function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = React.use(params)
  const { me, can, term } = useAuth()
  const nav = MODULE_NAV.find((m) => m.key === module)
  if (!nav) {
    return <PageHeader title="Not found" description="This module does not exist." />
  }
  const ent = me?.modules?.[nav.key]
  const title = nav.termKey ? term(nav.termKey, nav.label) : nav.label

  return (
    <>
      <PageHeader title={title} description={nav.description} />
      {ent?.status === "inactive" ? (
        <Card className="max-w-xl">
          <CardHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-muted">
              <Lock className="size-5" />
            </span>
            <CardTitle>{nav.label} isn&apos;t part of your plan</CardTitle>
            <CardDescription>Upgrade to unlock it. Everything you add stays yours, even if you change plans later.</CardDescription>
          </CardHeader>
          {can("tenant.billing.view") && (
            <CardContent>
              <Link href="/app/billing" className={buttonVariants()}>
                See plans
              </Link>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-muted">
              <Construction className="size-5" />
            </span>
            <CardTitle>Coming in release phase {nav.phase}</CardTitle>
            <CardDescription>
              The platform (sign-up, trial, roles, permissions and configuration) is live. The {nav.label} screens are next on the build plan.
              {ent?.status === "read_only" && " On your current plan this module will be read-only."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  )
}
