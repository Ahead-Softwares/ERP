"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { GST_STATES } from "@/lib/format"

interface Tenant {
  name: string
  legalName: string | null
  gstin: string | null
  billingStateCode: string | null
  logoUrl: string | null
  timezone: string
  fyStartMonth: number
  address: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string } | null
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export default function BusinessSettingsPage() {
  const { can, reload } = useAuth()
  const { data, setData } = useApi<Tenant>("/tenant")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const editable = can("tenant.settings.edit")

  if (!data) return <Skeleton className="h-96 rounded-4xl" />

  const set = <K extends keyof Tenant>(k: K, v: Tenant[K]) => setData({ ...data, [k]: v })
  const setAddr = (k: string, v: string) => setData({ ...data, address: { ...(data.address ?? {}), [k]: v } })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const saved = await api.patch<Tenant>("/tenant", {
        name: data!.name,
        legalName: data!.legalName || null,
        gstin: data!.gstin || null,
        billingStateCode: data!.billingStateCode || null,
        logoUrl: data!.logoUrl || null,
        fyStartMonth: data!.fyStartMonth,
        address: data!.address,
      })
      setData(saved)
      await reload()
      toast.success("Business details saved")
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>Shown on your invoices and documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={errors.name}>
            <Input value={data.name} onChange={(e) => set("name", e.target.value)} disabled={!editable} required />
          </Field>
          <Field label="Legal name" error={errors.legalName} hint="As registered, if different">
            <Input value={data.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} disabled={!editable} />
          </Field>
          <Field label="Logo URL" error={errors.logoUrl} className="sm:col-span-2" hint="File upload arrives with object storage; paste an image link for now">
            <Input type="url" value={data.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} disabled={!editable} placeholder="https://" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GST & address</CardTitle>
          <CardDescription>Your state decides CGST + SGST or IGST on invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="State" error={errors.billingStateCode}>
            <NativeSelect value={data.billingStateCode ?? ""} onChange={(e) => set("billingStateCode", e.target.value)} disabled={!editable}>
              <option value="">Select state</option>
              {GST_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="GSTIN" error={errors.gstin} hint="Leave empty if not GST registered">
            <Input value={data.gstin ?? ""} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} disabled={!editable} />
          </Field>
          <Field label="Address line 1" error={errors["address.line1"]} className="sm:col-span-2">
            <Input value={data.address?.line1 ?? ""} onChange={(e) => setAddr("line1", e.target.value)} disabled={!editable} />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input value={data.address?.line2 ?? ""} onChange={(e) => setAddr("line2", e.target.value)} disabled={!editable} />
          </Field>
          <Field label="City">
            <Input value={data.address?.city ?? ""} onChange={(e) => setAddr("city", e.target.value)} disabled={!editable} />
          </Field>
          <Field label="PIN code" error={errors["address.pincode"]}>
            <Input inputMode="numeric" maxLength={6} value={data.address?.pincode ?? ""} onChange={(e) => setAddr("pincode", e.target.value)} disabled={!editable} />
          </Field>
          <Field label="Financial year starts in">
            <NativeSelect value={data.fyStartMonth} onChange={(e) => set("fyStartMonth", Number(e.target.value))} disabled={!editable}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      {editable && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <FormError message={error} />
        </div>
      )}
    </form>
  )
}
