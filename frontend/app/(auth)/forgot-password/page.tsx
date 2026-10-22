"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FormError } from "@/components/form"
import { api, errorMessage } from "@/lib/api"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [target, setTarget] = React.useState("")
  const [code, setCode] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const [devCode, setDevCode] = React.useState<string | undefined>()
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!sent) {
        const r = await api.post<{ devCode?: string }>("/auth/otp/send", { target, purpose: "reset" })
        setDevCode(r.devCode)
        setSent(true)
      } else {
        await api.post("/auth/password/reset", { target, code, password })
        toast.success("Password updated. Please sign in.")
        router.replace("/login")
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>{sent ? "If an account exists, we sent a 6-digit code." : "We'll send a code to your mobile or email."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Email or mobile">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} disabled={sent} required />
          </Field>
          {sent && (
            <>
              <Field label="6-digit code" hint={devCode ? `Development code: ${devCode}` : undefined}>
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
              </Field>
              <Field label="New password" hint="At least 8 characters">
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              </Field>
            </>
          )}
          <FormError message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : sent ? "Set new password" : "Send code"}
          </Button>
          <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  )
}
