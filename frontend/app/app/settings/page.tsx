"use client"

import * as React from "react"
import { toast } from "sonner"
import { gstin as gstinRule, gstinStateMismatch, length, pincode as pincodeRule, squish, stateName, upperNoSpaces, url as urlRule } from "@contracts/validation"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EditableSection, ReadOnlyGrid, useConfirmChanges, type DiffRow } from "@/components/editable-section"
import { Field, NativeSelect } from "@/components/form"
import { ErrorState } from "@/components/page-states"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { useForm } from "@/lib/use-form"
import { formatDateTime, GST_STATES } from "@/lib/format"

interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
}

interface Tenant {
  name: string
  legalName: string | null
  gstin: string | null
  billingStateCode: string | null
  logoUrl: string | null
  timezone: string
  fyStartMonth: number
  address: Address | null
  updatedAt: string
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const fyLabel = (m: number) => `${MONTHS[m - 1]} – ${MONTHS[(m + 10) % 12]}`

export default function BusinessSettingsPage() {
  const { data, error, reload, setData } = useApi<Tenant>("/tenant")
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Skeleton className="h-96 rounded-4xl" />
  return (
    <div className="grid max-w-3xl gap-6">
      <ProfileCard key={`p-${data.updatedAt}`} tenant={data} onSaved={setData} />
      <TaxAddressCard key={`t-${data.updatedAt}`} tenant={data} onSaved={setData} />
    </div>
  )
}

/** Save a patch with the version check; refreshes /me so the sidebar and banners update. */
function useSaveTenant(tenant: Tenant, onSaved: (t: Tenant) => void) {
  const { reload } = useAuth()
  return async (patch: Record<string, unknown>, reason?: string) => {
    const saved = await api.patch<Tenant>("/tenant", { ...patch, ...(reason ? { reason } : {}), expectedUpdatedAt: tenant.updatedAt })
    onSaved(saved)
    await reload()
    toast.success("Business details saved")
  }
}

function lastChanged(t: Tenant) {
  return `Last changed ${formatDateTime(t.updatedAt)}`
}

function ProfileCard({ tenant, onSaved }: { tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const { can } = useAuth()
  const save = useSaveTenant(tenant, onSaved)
  const confirm = useConfirmChanges()
  const form = useForm({
    initial: { name: tenant.name, legalName: tenant.legalName ?? "", logoUrl: tenant.logoUrl ?? "" },
    labels: { name: "Business name", legalName: "Legal name", logoUrl: "Logo link" },
    clean: { name: squish, legalName: squish, logoUrl: (v) => v.trim() },
    rules: {
      name: (v) => (!v.trim() ? "Business name is required" : length(2, 100, "Business name")(v)),
      legalName: (v) => (v ? length(2, 160, "Legal name")(v) : null),
      logoUrl: (v) => (v ? urlRule(v) : null),
    },
    onSubmit: async (v, changed) => {
      const reason = changed.includes("legalName")
        ? await confirm.ask([{ label: "Legal name", before: tenant.legalName ?? "", after: v.legalName }], "The legal name is printed on every new invoice. Invoices already issued keep the old name.")
        : undefined
      await save(Object.fromEntries(changed.map((k) => [k, v[k] || null])), reason)
    },
  })

  return (
    <EditableSection
      title="Business profile"
      description="Shown on your invoices and documents."
      form={form}
      canEdit={can("tenant.settings.edit")}
      confirmDialog={confirm.dialog}
      footerNote={lastChanged(tenant)}
      view={
        <ReadOnlyGrid
          items={[
            { label: "Business name", value: tenant.name },
            { label: "Legal name", value: tenant.legalName },
            {
              label: "Logo",
              wide: true,
              value: tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="Business logo" className="h-12 w-auto rounded-lg border bg-white object-contain p-1" />
              ) : null,
            },
          ]}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required error={form.errors.name}>
          <Input {...form.field("name")} autoComplete="organization" autoFocus />
        </Field>
        <Field label="Legal name" error={form.errors.legalName} hint="As registered, if different">
          <Input {...form.field("legalName")} />
        </Field>
        <Field label="Logo link" error={form.errors.logoUrl} className="sm:col-span-2" hint="Logo upload comes with file storage; paste an image link for now">
          <Input {...form.field("logoUrl")} type="url" inputMode="url" placeholder="https://" />
        </Field>
      </div>
    </EditableSection>
  )
}

function TaxAddressCard({ tenant, onSaved }: { tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const { can } = useAuth()
  const save = useSaveTenant(tenant, onSaved)
  const confirm = useConfirmChanges()
  const a = tenant.address ?? {}
  const form = useForm({
    initial: {
      billingStateCode: tenant.billingStateCode ?? "",
      gstin: tenant.gstin ?? "",
      line1: a.line1 ?? "",
      line2: a.line2 ?? "",
      city: a.city ?? "",
      pincode: a.pincode ?? "",
      fyStartMonth: String(tenant.fyStartMonth),
    },
    labels: { billingStateCode: "State", gstin: "GSTIN", line1: "Address line 1", pincode: "PIN code", city: "City", fyStartMonth: "Financial year" },
    clean: { gstin: upperNoSpaces, line1: squish, line2: squish, city: squish, pincode: (v) => v.replace(/\s/g, "") },
    fromServer: (path) => (path.startsWith("address.") ? (path.slice(8) as "line1") : path === "billingStateCode" || path === "gstin" || path === "fyStartMonth" ? path : undefined),
    rules: {
      billingStateCode: (v) => (v ? null : "Choose your state — it decides CGST + SGST or IGST"),
      gstin: (v, all) => (v ? gstinRule(v) ?? gstinStateMismatch(v, all.billingStateCode) : null),
      line1: (v) => (v ? length(3, 200, "Address")(v) : null),
      line2: (v) => (v ? length(0, 200, "Address")(v) : null),
      city: (v) => (v ? length(2, 80, "City")(v) : null),
      pincode: (v) => (v ? pincodeRule(v) : null),
    },
    onSubmit: async (v, changed) => {
      const rows: DiffRow[] = []
      if (changed.includes("billingStateCode")) rows.push({ label: "State", before: stateName(tenant.billingStateCode) ?? "", after: stateName(v.billingStateCode) ?? "" })
      if (changed.includes("gstin")) rows.push({ label: "GSTIN", before: tenant.gstin ?? "", after: v.gstin })
      if (changed.includes("fyStartMonth")) rows.push({ label: "Financial year", before: fyLabel(tenant.fyStartMonth), after: fyLabel(Number(v.fyStartMonth)) })
      const reason = rows.length ? await confirm.ask(rows, "These change how tax is worked out and what's printed on new invoices. Invoices already issued are not changed.") : undefined
      const patch: Record<string, unknown> = {}
      if (changed.includes("billingStateCode")) patch.billingStateCode = v.billingStateCode || null
      if (changed.includes("gstin")) patch.gstin = v.gstin || null
      if (changed.includes("fyStartMonth")) patch.fyStartMonth = Number(v.fyStartMonth)
      if (changed.some((k) => ["line1", "line2", "city", "pincode"].includes(k))) {
        patch.address = { ...a, line1: v.line1, line2: v.line2, city: v.city, pincode: v.pincode, state: stateName(v.billingStateCode) ?? undefined }
      }
      await save(patch, reason)
    },
  })

  const gstinOk = form.values.gstin && !form.errors.gstin && !gstinRule(form.values.gstin) && !gstinStateMismatch(form.values.gstin, form.values.billingStateCode)
  const address = [a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(", ")

  return (
    <EditableSection
      title="GST & address"
      description="Your state decides CGST + SGST or IGST on invoices."
      form={form}
      canEdit={can("tenant.settings.edit")}
      confirmDialog={confirm.dialog}
      footerNote={lastChanged(tenant)}
      view={
        <ReadOnlyGrid
          items={[
            { label: "State", value: tenant.billingStateCode ? `${stateName(tenant.billingStateCode)} (${tenant.billingStateCode})` : null },
            { label: "GSTIN", value: tenant.gstin ? <span className="font-mono">{tenant.gstin}</span> : "Not GST registered" },
            { label: "Address", value: address, wide: true },
            { label: "Financial year", value: fyLabel(tenant.fyStartMonth) },
          ]}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State" required error={form.errors.billingStateCode}>
          <NativeSelect {...form.field("billingStateCode")}>
            <option value="">Select state</option>
            {GST_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="GSTIN" error={form.errors.gstin} success={gstinOk ? `Valid · ${stateName(form.values.gstin.slice(0, 2))}` : null} hint="Leave empty if not GST registered">
          <Input {...form.field("gstin")} maxLength={15} className="font-mono uppercase" autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Field label="Address line 1" error={form.errors.line1} className="sm:col-span-2">
          <Input {...form.field("line1")} autoComplete="address-line1" />
        </Field>
        <Field label="Address line 2" error={form.errors.line2} className="sm:col-span-2">
          <Input {...form.field("line2")} autoComplete="address-line2" />
        </Field>
        <Field label="City" error={form.errors.city}>
          <Input {...form.field("city")} autoComplete="address-level2" />
        </Field>
        <Field label="PIN code" error={form.errors.pincode}>
          <Input {...form.field("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
        </Field>
        <Field label="Financial year starts in" error={form.errors.fyStartMonth} hint="Locked once your first invoice is issued">
          <NativeSelect {...form.field("fyStartMonth")}>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </EditableSection>
  )
}
