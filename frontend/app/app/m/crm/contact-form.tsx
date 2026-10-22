"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, NativeSelect } from "@/components/form"
import { CustomFieldsForm, useCustomFields } from "@/components/custom-fields"
import { UserSelect } from "@/components/pickers"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { GST_STATES } from "@/lib/format"

export interface Contact {
  id: string
  type: "lead" | "customer"
  name: string
  companyName: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  stateCode: string | null
  address: { line1?: string; city?: string; pincode?: string } | null
  leadStatus: "new" | "contacted" | "qualified" | "lost" | "converted" | null
  leadSource: string | null
  ownerId: string | null
  isActive: boolean
  notes: string | null
  custom: Record<string, unknown>
  createdAt: string
  version: number
}

export const LEAD_SOURCES = ["Walk-in", "Phone call", "WhatsApp", "Instagram", "Facebook", "Google", "Website", "Referral", "Other"]

export function ContactDialog({ kind, contact, onClose, onSaved }: { kind: "customer" | "lead"; contact?: Contact; onClose: () => void; onSaved: (c: Contact) => void }) {
  const { term } = useAuth()
  const fields = useCustomFields(kind === "lead" ? "lead" : "contact")
  const [form, setForm] = React.useState({
    name: contact?.name ?? "",
    companyName: contact?.companyName ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    gstin: contact?.gstin ?? "",
    stateCode: contact?.stateCode ?? "",
    line1: contact?.address?.line1 ?? "",
    city: contact?.address?.city ?? "",
    pincode: contact?.address?.pincode ?? "",
    leadSource: contact?.leadSource ?? "",
    leadStatus: contact?.leadStatus && contact.leadStatus !== "converted" ? contact.leadStatus : "new",
    ownerId: contact?.ownerId ?? null as string | null,
    notes: contact?.notes ?? "",
    custom: contact?.custom ?? ({} as Record<string, unknown>),
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [duplicate, setDuplicate] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const label = kind === "lead" ? term("entity.lead.singular", "Lead") : term("entity.contact.singular", "Customer")

  async function save(e: React.FormEvent, allowDuplicate = false) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    const body = {
      name: form.name,
      companyName: form.companyName || null,
      phone: form.phone || null,
      email: form.email || null,
      gstin: form.gstin || null,
      stateCode: form.stateCode || (form.gstin.length >= 2 ? form.gstin.slice(0, 2) : null),
      address: form.line1 || form.city || form.pincode ? { line1: form.line1 || undefined, city: form.city || undefined, pincode: form.pincode || undefined } : null,
      ownerId: form.ownerId,
      notes: form.notes || null,
      custom: form.custom,
      ...(kind === "lead" ? { leadSource: form.leadSource || null, leadStatus: form.leadStatus } : {}),
    }
    try {
      const saved = contact
        ? await api.patch<Contact>(`/contacts/${contact.id}`, { ...body, version: contact.version })
        : await api.post<Contact>(kind === "lead" ? "/leads" : "/contacts", { ...body, allowDuplicate })
      toast.success(contact ? "Saved" : `${label} added`)
      onSaved(saved)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        if (err.code === "CONFLICT" && err.details?.duplicateId && !contact) setDuplicate(String(err.details.duplicateId))
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{contact ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Phone and email are checked for duplicates.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name} className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Company / business" error={errors.companyName}>
              <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </Field>
            <Field label="GSTIN" error={errors.gstin} hint="For B2B invoices">
              <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} />
            </Field>
            {kind === "lead" && (
              <>
                <Field label="Source">
                  <NativeSelect value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)}>
                    <option value="">—</option>
                    {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Status">
                  <NativeSelect value={form.leadStatus} onChange={(e) => set("leadStatus", e.target.value)}>
                    {["new", "contacted", "qualified", "lost"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </NativeSelect>
                </Field>
              </>
            )}
            <Field label="State (place of supply)" error={errors.stateCode}>
              <NativeSelect value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)}>
                <option value="">{form.gstin.length >= 2 ? "From GSTIN" : "Same as business"}</option>
                {GST_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Owner">
              <UserSelect value={form.ownerId} onChange={(v) => set("ownerId", v)} emptyLabel="Me" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.line1} onChange={(e) => set("line1", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="PIN code">
              <Input inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
          </div>
          <CustomFieldsForm fields={fields} value={form.custom} onChange={(v) => set("custom", v)} errors={errors} />
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>
          <FormError message={error} />
          <DialogFooter className="gap-2">
            {duplicate && (
              <Button type="button" variant="outline" onClick={(e) => save(e as unknown as React.FormEvent, true)} disabled={busy}>
                Add anyway
              </Button>
            )}
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : contact ? "Save changes" : `Add ${label.toLowerCase()}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
