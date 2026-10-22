"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"

function VerifyEmail() {
  const token = useSearchParams().get("token")
  const { status, reload } = useAuth()
  const [result, setState] = React.useState<{ ok: boolean; message: string } | null>(null)
  const state = token ? result : { ok: false, message: "This link is missing its token." }
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) return
    api
      .post("/auth/email/verify", { token })
      .then(() => {
        setState({ ok: true, message: "Your email is verified." })
        if (status === "authenticated") void reload()
      })
      .catch((e) => setState({ ok: false, message: errorMessage(e) }))
  }, [token, status, reload])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Email verification</CardTitle>
        <CardDescription>{state ? state.message : "Checking your link…"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={status === "authenticated" ? "/app" : "/login"} className={buttonVariants({ className: "w-full" })}>
          {status === "authenticated" ? "Go to dashboard" : "Sign in"}
        </Link>
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <VerifyEmail />
    </React.Suspense>
  )
}
