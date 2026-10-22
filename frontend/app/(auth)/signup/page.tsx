"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"

interface Industry {
  key: string
  name: string
  description: string
}

const EMPTY = { name: "", mobile: "", email: "", password: "", businessName: "", industryKey: "" }

export default function SignupPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const industries = useApi<{ data: Industry[] }>("/public/industries")
  const [form, setForm] = React.useState(EMPTY)
  const [step, setStep] = React.useState<"details" | "otp">("details")
  const [otp, setOtp] = React.useState("")
  const [devCode, setDevCode] = React.useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function handle(err: unknown) {
    if (err instanceof ApiError && err.code === "VALIDATION_FAILED") setFieldErrors(err.fields)
    setError(errorMessage(err))
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      if (form.password.length < 8) throw new ApiError(422, "VALIDATION_FAILED", "Use at least 8 characters for your password.", { fields: { password: "Use at least 8 characters" } })
      const r = await api.post<{ devCode?: string }>("/auth/otp/send", { target: form.mobile, purpose: "signup" })
      setDevCode(r.devCode)
      setStep("otp")
    } catch (err) {
      handle(err)
    } finally {
      setBusy(false)
    }
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { verificationToken } = await api.post<{ verificationToken: string }>("/auth/otp/verify", { target: form.mobile, purpose: "signup", code: otp })
      const res = await api.post<{ accessToken: string }>("/auth/signup", { ...form, mobileVerificationToken: verificationToken })
      await signIn(res.accessToken)
      router.replace("/app?welcome=1")
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_FAILED") setStep("details")
      handle(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{step === "details" ? "Start your 15-day free trial" : "Verify your mobile"}</CardTitle>
        <CardDescription>
          {step === "details" ? "All modules unlocked. No card needed. Your data stays safe if you don't upgrade." : `Enter the 6-digit code sent to ${form.mobile}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "details" ? (
          <form onSubmit={sendCode} className="grid gap-4">
            <Field label="Your name" error={fieldErrors.name}>
              <Input autoComplete="name" value={form.name} onChange={set("name")} required minLength={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile number" error={fieldErrors.mobile ?? fieldErrors.target}>
                <Input inputMode="tel" autoComplete="tel" placeholder="98xxxxxxxx" value={form.mobile} onChange={set("mobile")} required />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
              </Field>
            </div>
            <Field label="Password" error={fieldErrors.password} hint="At least 8 characters">
              <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
            </Field>
            <Field label="Business name" error={fieldErrors.businessName}>
              <Input autoComplete="organization" value={form.businessName} onChange={set("businessName")} required minLength={2} />
            </Field>
            <Field label="Industry" error={fieldErrors.industryKey} hint="Sets up terminology, fields and dashboard for your business">
              <NativeSelect value={form.industryKey} onChange={set("industryKey")} required>
                <option value="" disabled>
                  Choose your industry
                </option>
                {industries.data?.data.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={busy}>
              {busy ? "Sending code…" : "Continue"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">By continuing you agree to the Terms and Privacy Policy.</p>
          </form>
        ) : (
          <form onSubmit={verifyAndCreate} className="grid gap-4">
            <Field label="6-digit code" hint={devCode ? `Development code: ${devCode}` : undefined}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={busy || otp.length !== 6}>
              {busy ? "Creating your workspace…" : "Verify & create account"}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("details")}>
                ← Change details
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => sendCode()} disabled={busy}>
                Resend code
              </button>
            </div>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
