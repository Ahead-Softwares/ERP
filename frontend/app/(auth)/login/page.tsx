"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FormError } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, status, me } = useAuth()
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // password tab
  const [identifier, setIdentifier] = React.useState("")
  const [password, setPassword] = React.useState("")
  // OTP tab
  const [mobile, setMobile] = React.useState("")
  const [otp, setOtp] = React.useState("")
  const [otpSent, setOtpSent] = React.useState(false)
  const [devCode, setDevCode] = React.useState<string | undefined>()

  React.useEffect(() => {
    if (status === "authenticated") router.replace(me?.workspace === "console" ? "/console" : "/app")
  }, [status, me, router])

  async function finish(accessToken: string) {
    const signedIn = await signIn(accessToken)
    router.replace(signedIn.workspace === "console" ? "/console" : "/app")
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { accessToken } = await api.post<{ accessToken: string }>("/auth/login", { identifier, password })
      await finish(accessToken)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function sendOtp() {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ devCode?: string }>("/auth/otp/send", { target: mobile, purpose: "login" })
      setOtpSent(true)
      setDevCode(r.devCode)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otpSent) return sendOtp()
    setBusy(true)
    setError(null)
    try {
      const { accessToken } = await api.post<{ accessToken: string }>("/auth/login", { mobile, otp })
      await finish(accessToken)
    } catch (err) {
      setError(err instanceof ApiError && err.code === "INVALID_CREDENTIALS" ? "Incorrect mobile number or code." : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back. Sign in to your business account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Tabs defaultValue="password" onValueChange={() => setError(null)}>
          <TabsList className="w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="otp">Mobile OTP</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={onPassword} className="grid gap-4 pt-4">
              <Field label="Email or mobile">
                <Input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <div className="-mt-2 text-right">
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <FormError message={error} />
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="otp">
            <form onSubmit={onOtp} className="grid gap-4 pt-4">
              <Field label="Mobile number">
                <Input inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={otpSent} required />
              </Field>
              {otpSent && (
                <Field label="6-digit code" hint={devCode ? `Development code: ${devCode}` : "Sent by SMS"}>
                  <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required />
                </Field>
              )}
              <FormError message={error} />
              <Button type="submit" disabled={busy}>
                {busy ? "Please wait…" : otpSent ? "Sign in" : "Send code"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground">
          New to AHEAD?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Start a free trial
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
