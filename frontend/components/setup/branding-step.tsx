"use client"

import * as React from "react"
import { BRAND_COLORS, FONTS, brandColorError, type WorkspacePreferences } from "@contracts/workspace"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { ChoiceChip } from "@/components/onboarding"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StepFooter, StepHeader, useStepSave, type StepProps } from "./wizard"

type Branding = WorkspacePreferences["branding"]
const FONT_FAMILY: Record<string, string> = { inter: "var(--font-sans)", manrope: "var(--font-manrope)", plex: "var(--font-plex)", source: "var(--font-source)" }

export function BrandingStep({ workspace, tenant, refresh, complete, back }: StepProps) {
  const { reload } = useAuth()
  const [b, setB] = React.useState<Branding>(workspace.preferences.branding)
  const [custom, setCustom] = React.useState(BRAND_COLORS.some((c) => c.hex === b.brandColor) ? "" : b.brandColor)
  const { saving, error, run } = useStepSave()
  const customError = custom ? brandColorError(custom.startsWith("#") ? custom : `#${custom}`) : null
  const colorError = brandColorError(b.brandColor)

  const save = () =>
    run(async () => {
      if (colorError) return
      await api.put("/tenant/preferences/branding", b)
      await Promise.all([refresh(), reload()])
      await complete("done")
    })

  return (
    <form
      className="flex min-h-full flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <StepHeader title="Make it yours" description="Choose the look for your team. The preview updates as you click." />
      <div className="grid gap-8 xl:grid-cols-[22rem_1fr]">
        <div className="grid content-start gap-6">
          <section id="colour" className="grid gap-2">
            <h2 className="text-sm font-semibold">Brand colour</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand colour">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={b.brandColor === c.hex}
                  aria-label={c.name}
                  onClick={() => {
                    setB((x) => ({ ...x, brandColor: c.hex }))
                    setCustom("")
                  }}
                  className={cn("size-9 rounded-xl ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring", b.brandColor === c.hex && "ring-2 ring-foreground")}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
            <Field label="Custom colour" error={customError} hint="Hex code, e.g. #7C2D12. Must be dark enough for white text.">
              <Input
                value={custom}
                placeholder="#"
                maxLength={7}
                className="w-32 font-mono uppercase"
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  setCustom(raw)
                  const hex = raw.startsWith("#") ? raw : `#${raw}`
                  if (/^#[0-9A-Fa-f]{6}$/.test(hex) && !brandColorError(hex)) setB((x) => ({ ...x, brandColor: hex.toUpperCase() }))
                }}
              />
            </Field>
          </section>
          <section id="look" className="grid gap-2">
            <h2 className="text-sm font-semibold">Default theme for the team</h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme">
              {(["light", "dark", "system"] as const).map((t) => (
                <ChoiceChip key={t} selected={b.theme === t} onClick={() => setB((x) => ({ ...x, theme: t }))} className="capitalize">
                  {t}
                </ChoiceChip>
              ))}
            </div>
          </section>
          <section className="grid gap-2">
            <h2 className="text-sm font-semibold">Font</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Font">
              {FONTS.map((f) => (
                <ChoiceChip key={f.key} selected={b.font === f.key} onClick={() => setB((x) => ({ ...x, font: f.key }))}>
                  <span style={{ fontFamily: FONT_FAMILY[f.key] }}>{f.label}</span>
                </ChoiceChip>
              ))}
            </div>
          </section>
          <section className="grid gap-2">
            <h2 className="text-sm font-semibold">Density</h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Density">
              {(["comfortable", "compact"] as const).map((d) => (
                <ChoiceChip key={d} selected={b.density === d} onClick={() => setB((x) => ({ ...x, density: d }))} className="capitalize">
                  {d}
                </ChoiceChip>
              ))}
            </div>
          </section>
          <p className="text-xs leading-relaxed text-muted-foreground">Each person can still pick their own theme. The brand colour and logo are the same for everyone and also appear on invoices.</p>
        </div>
        <Preview b={b} name={tenant.name} />
      </div>
      <StepFooter back={back} onSkip={() => void complete("skipped")} saving={saving} error={error ?? colorError} />
    </form>
  )
}

function Preview({ b, name }: { b: Branding; name: string }) {
  const dark = b.theme === "dark"
  const pad = b.density === "compact" ? "py-1.5" : "py-2.5"
  const c = dark
    ? { bg: "#121418", side: "#1A1D23", text: "#E8EAEE", line: "#2A2F38", card: "#1A1D23", muted: "#9AA1AD" }
    : { bg: "#FFFFFF", side: "#F7F8FA", text: "#16181D", line: "#E3E6EA", card: "#FFFFFF", muted: "#5B6270" }
  return (
    <div className="rounded-3xl bg-muted/60 p-4" aria-label="Preview">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Live preview {b.theme === "system" ? "· follows each device" : ""}</p>
      <div className="flex overflow-hidden rounded-2xl border text-[13px]" style={{ background: c.bg, color: c.text, borderColor: c.line, fontFamily: FONT_FAMILY[b.font] }}>
        <div className="hidden w-40 shrink-0 flex-col gap-1 p-3 sm:flex" style={{ background: c.side, borderRight: `1px solid ${c.line}` }}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold">
            <span className="grid size-6 place-items-center rounded-md text-[10px] text-white" style={{ background: b.brandColor }}>
              {initials(name)}
            </span>
            <span className="truncate">{name}</span>
          </div>
          <span className="rounded-lg px-2 py-1.5 font-medium text-white" style={{ background: b.brandColor }}>
            Dashboard
          </span>
          {["Appointments", "Clients", "Billing"].map((x) => (
            <span key={x} className="rounded-lg px-2 py-1.5">
              {x}
            </span>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 content-start gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Good morning</span>
            <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: b.brandColor }}>
              + New invoice
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Today's sales", "₹18,450"],
              ["Appointments", "14"],
              ["Dues", "₹6,200"],
            ].map(([k, val]) => (
              <div key={k} className="rounded-xl p-3" style={{ background: c.card, border: `1px solid ${c.line}` }}>
                <p className="text-[11px]" style={{ color: c.muted }}>
                  {k}
                </p>
                <p className="text-base font-bold">{val}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl px-3" style={{ background: c.card, border: `1px solid ${c.line}` }}>
            {["10:30 · Meera K. · Hair spa", "11:15 · Sana S. · Facial", "12:00 · Vikram I. · Haircut"].map((row) => (
              <div key={row} className={cn("flex items-center justify-between border-t first:border-t-0", pad)} style={{ borderColor: c.line }}>
                <span>{row}</span>
                <span className="rounded-full border px-2 text-[11px] font-medium" style={{ color: b.brandColor, borderColor: b.brandColor }}>
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
