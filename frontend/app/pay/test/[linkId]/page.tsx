"use client"

import * as React from "react"
import { CheckCircle2, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, errorMessage } from "@/lib/api"
import { formatPaise } from "@/lib/format"

// Development only: what a payment link opens when Razorpay keys are not configured.
// "Pay" makes the API send itself the same signed webhook Razorpay would.

interface TestLink {
  clientName: string | null
  amountPaise: number
  status: "pending_approval" | "awaiting_payment" | "paid" | "cancelled"
  kind: string
}

export default function TestPaymentPage({ params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = React.use(params)
  const [link, setLink] = React.useState<TestLink | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  React.useEffect(() => {
    api.get<TestLink>(`/payments/test/${linkId}`).then(setLink).catch((e) => setError(errorMessage(e)))
  }, [linkId])

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ status: string; detail?: string }>(`/payments/test/${linkId}/pay`)
      setResult(r.status === "processed" ? "Payment received. The workspace is active and the invoice is issued." : `${r.status}${r.detail ? `: ${r.detail}` : ""}`)
      setLink((l) => (l && r.status === "processed" ? { ...l, status: "paid" } : l))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" /> Test payment
          </CardTitle>
          <CardDescription>Development gateway — no money moves. With Razorpay keys set, clients see Razorpay&apos;s page instead.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {link && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">{link.clientName} · AHEAD {link.kind === "renewal" ? "renewal" : "subscription"}</p>
                <p className="text-3xl font-semibold tabular-nums">{formatPaise(link.amountPaise)}</p>
              </div>
              {result ? (
                <p className="flex gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-primary" /> {result}</p>
              ) : link.status === "awaiting_payment" ? (
                <Button onClick={pay} disabled={busy}>{busy ? "Paying…" : `Pay ${formatPaise(link.amountPaise)}`}</Button>
              ) : (
                <p className="text-sm text-muted-foreground">This link can&apos;t be paid: the order is {link.status.replace("_", " ")}.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
