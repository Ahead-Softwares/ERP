"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-shell"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useDebounced } from "@/lib/use-list"
import { formatPaise, GST_STATES } from "@/lib/format"
import type { Catalog, Quote } from "@/lib/console"

interface Form {
  name: string
  industryKey: string
  gstin: string
  stateCode: string
  address: string
  ownerName: string
  ownerEmail: string
  ownerMobile: string
  planKey: string
  cycle: "monthly" | "yearly"
  addOns: string[]
  extraUsers: string
  discountPercent: string
  couponCode: string
}

const EMPTY: Form = {
  name: "", industryKey: "", gstin: "", stateCode: "", address: "",
  ownerName: "", ownerEmail: "", ownerMobile: "",
  planKey: "starter", cycle: "monthly", addOns: [], extraUsers: "0", discountPercent: "0", couponCode: "",
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default function NewClientPage() {
  const router = useRouter()
  const catalog = useApi<Catalog>("/console/catalog")
  const industries = useApi<{ data: { key: string; name: string }[] }>("/public/industries")
  const [form, setForm] = React.useState<Form>(EMPTY)
  const [quote, setQuote] = React.useState<Quote | null>(null)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Live price: re-quote whenever the commercial part of the form changes
  const pricing = useDebounced(
    JSON.stringify({ planKey: form.planKey, cycle: form.cycle, addOns: form.addOns, extraUsers: form.extraUsers, discountPercent: form.discountPercent, couponCode: form.couponCode, stateCode: form.stateCode }),
    400
  )
  React.useEffect(() => {
    const p = JSON.parse(pricing) as Pick<Form, "planKey" | "cycle" | "addOns" | "extraUsers" | "discountPercent" | "couponCode" | "stateCode">
    if (!p.stateCode) return
    let cancelled = false
    api
      .post<Quote>("/console/quote", {
        planKey: p.planKey,
        cycle: p.cycle,
        addOns: p.addOns,
        extraUsers: Number(p.extraUsers) || 0,
        discountPercent: Number(p.discountPercent) || 0,
        couponCode: p.couponCode || null,
        stateCode: p.stateCode,
      })
      .then((q) => {
        if (cancelled) return
        setQuote(q)
        setQuoteError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setQuote(null)
        setQuoteError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [pricing])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const r = await api.post<{ tenantId: string; orderId: string; status: string }>("/console/clients", {
        business: { name: form.name, industryKey: form.industryKey, gstin: form.gstin || null, stateCode: form.stateCode, address: form.address || null },
        owner: { name: form.ownerName, email: form.ownerEmail, mobile: form.ownerMobile },
        order: {
          planKey: form.planKey,
          cycle: form.cycle,
          addOns: form.addOns,
          extraUsers: Number(form.extraUsers) || 0,
          discountPercent: Number(form.discountPercent) || 0,
          couponCode: form.couponCode || null,
        },
      })
      toast.success(r.status === "pending_approval" ? "Client created — the discount is waiting for approval" : "Client created — waiting for payment")
      router.push(`/console/payments/${r.orderId}`)
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.split(".").pop()!, v]))
        setErrors({ ...fields, form: errorMessage(err) })
      } else setErrors({ form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  if (catalog.error) return <p className="text-sm text-destructive">{catalog.error.message}</p>
  if (!catalog.data) return <Skeleton className="h-96 rounded-4xl" />
  const plans = catalog.data.plans.filter((p) => p.key !== "free")
  const plan = plans.find((p) => p.key === form.planKey)
  const addOnPrices = catalog.data.prices.filter((p) => p.itemType === "addon_module" && p.cycle === form.cycle && !plan?.fullModules.includes(p.itemRef))
  const moduleName = (key: string) => catalog.data!.modules.find((m) => m.key === key)?.name ?? key

  return (
    <>
      <Link href="/console/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <PageHeader title="New client" description="No trial: the workspace is created now and modules open when the payment is received." />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" error={errors.name}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Industry" error={errors.industryKey}>
                <NativeSelect value={form.industryKey} onChange={(e) => set("industryKey", e.target.value)} required>
                  <option value="">Choose…</option>
                  {industries.data?.data.map((i) => (
                    <option key={i.key} value={i.key}>{i.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="State (for GST)" error={errors.stateCode}>
                <NativeSelect value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} required>
                  <option value="">Choose…</option>
                  {GST_STATES.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="GSTIN" hint="Optional — makes the invoice B2B" error={errors.gstin}>
                <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} />
              </Field>
              <Field label="Billing address" className="sm:col-span-2" error={errors.address}>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
              <CardDescription>They sign in with mobile OTP. An existing account with this email becomes the owner.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" error={errors.ownerName ?? errors.name}>
                <Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} required />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input type="email" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} required />
              </Field>
              <Field label="Mobile" error={errors.mobile}>
                <Input inputMode="tel" value={form.ownerMobile} onChange={(e) => set("ownerMobile", e.target.value)} placeholder="98765 43210" required />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan" error={errors.planKey}>
                  <NativeSelect value={form.planKey} onChange={(e) => setForm((f) => ({ ...f, planKey: e.target.value, addOns: [] }))}>
                    {plans.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Billing cycle" error={errors.cycle}>
                  <NativeSelect value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as Form["cycle"], addOns: [] }))}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </NativeSelect>
                </Field>
              </div>
              {addOnPrices.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Add-on modules</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {addOnPrices.map((p) => (
                      <label key={p.itemRef} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.addOns.includes(p.itemRef)}
                          onCheckedChange={(v) => set("addOns", v ? [...form.addOns, p.itemRef] : form.addOns.filter((k) => k !== p.itemRef))}
                        />
                        {moduleName(p.itemRef)} <span className="text-muted-foreground">+{formatPaise(p.amountPaise)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Extra users" hint={plan ? `${plan.limits.users} included` : undefined} error={errors.extraUsers}>
                  <Input type="number" min={0} max={500} value={form.extraUsers} onChange={(e) => set("extraUsers", e.target.value)} />
                </Field>
                <Field label="Discount (%)" hint={quote ? `Your limit: ${quote.discountLimitPercent}%` : undefined} error={errors.discountPercent}>
                  <Input type="number" min={0} max={100} step="0.01" value={form.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} />
                </Field>
                <Field label="Coupon" error={errors.couponCode}>
                  <Input value={form.couponCode} onChange={(e) => set("couponCode", e.target.value.toUpperCase())} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Price</CardTitle>
              <CardDescription>{form.stateCode ? (quote?.intraState ? "Same state: CGST + SGST" : "Other state: IGST") : "Choose the state to price the order"}</CardDescription>
            </CardHeader>
            <CardContent>
              {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}
              {quote && (
                <>
                  {quote.items.map((i) => (
                    <Line key={`${i.itemType}-${i.itemRef}`} label={`${i.description}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`} value={formatPaise(i.amountPaise)} />
                  ))}
                  {quote.salesDiscountPaise > 0 && <Line label="Discount" value={`−${formatPaise(quote.salesDiscountPaise)}`} />}
                  {quote.couponDiscountPaise > 0 && <Line label={`Coupon ${quote.couponCode}`} value={`−${formatPaise(quote.couponDiscountPaise)}`} />}
                  <div className="my-2 border-t" />
                  <Line label="Taxable" value={formatPaise(quote.taxablePaise)} />
                  {quote.intraState ? (
                    <>
                      <Line label={`CGST ${quote.gstRateBp / 200}%`} value={formatPaise(quote.cgstPaise)} />
                      <Line label={`SGST ${quote.gstRateBp / 200}%`} value={formatPaise(quote.sgstPaise)} />
                    </>
                  ) : (
                    <Line label={`IGST ${quote.gstRateBp / 100}%`} value={formatPaise(quote.igstPaise)} />
                  )}
                  <Line label="Total" value={formatPaise(quote.totalPaise)} strong />
                  {quote.needsApproval && (
                    <p className="mt-3 flex gap-2 rounded-2xl bg-amber-100 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                      <AlertTriangle className="size-4 shrink-0" /> Above your {quote.discountLimitPercent}% limit — a Super Admin must approve before the client can pay.
                    </p>
                  )}
                </>
              )}
              <FormError message={errors.form} />
              <Button type="submit" className="mt-4 w-full" disabled={busy || !quote}>
                {busy ? "Creating…" : "Create client"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </>
  )
}
