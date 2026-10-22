"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, NativeSelect } from "@/components/form"
import { useApi } from "@/lib/use-api"

export interface CustomFieldDef {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
  archivedAt: string | null
}

/** Active custom field definitions for an entity (CFG-03). */
export function useCustomFields(entity: string) {
  const { data } = useApi<{ data: CustomFieldDef[] }>(`/forms/fields?entity=${entity}`)
  return (data?.data ?? []).filter((f) => !f.archivedAt)
}

export function CustomFieldsForm({ fields, value, onChange, errors = {}, disabled }: { fields: CustomFieldDef[]; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; errors?: Record<string, string>; disabled?: boolean }) {
  if (!fields.length) return null
  const set = (k: string, v: unknown) => {
    const next = { ...value }
    if (v === "" || v === undefined) delete next[k]
    else next[k] = v
    onChange(next)
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const err = errors[`custom.${f.key}`]
        const v = value[f.key]
        if (f.type === "checkbox")
          return (
            <div key={f.id} className="flex items-center gap-2 pt-6">
              <Checkbox id={`cf-${f.key}`} checked={!!v} onCheckedChange={(c) => set(f.key, !!c)} disabled={disabled} />
              <Label htmlFor={`cf-${f.key}`}>{f.label}</Label>
            </div>
          )
        return (
          <Field key={f.id} label={`${f.label}${f.required ? " *" : ""}`} error={err}>
            {f.type === "dropdown" ? (
              <NativeSelect value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} disabled={disabled} required={f.required}>
                <option value="">—</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </NativeSelect>
            ) : f.type === "multi_select" ? (
              <NativeSelect multiple value={(v as string[]) ?? []} onChange={(e) => set(f.key, [...e.target.selectedOptions].map((o) => o.value))} disabled={disabled} className="h-20 py-1">
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </NativeSelect>
            ) : (
              <Input
                type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                value={(v as string | number | undefined) ?? ""}
                onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                disabled={disabled}
                required={f.required}
              />
            )}
          </Field>
        )
      })}
    </div>
  )
}
