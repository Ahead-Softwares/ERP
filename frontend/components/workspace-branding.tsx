"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth"
import { setDateFormat } from "@/lib/format"

// Applies the workspace look (Settings › Branding) to the whole page: brand colour → --primary,
// font → --font-sans, density → data-density on <html>, plus the theme. A person's own choices
// in My account › Profile & preferences win over the workspace defaults.

const FONT_VAR: Record<string, string> = { inter: "", manrope: "var(--font-manrope)", plex: "var(--font-plex)", source: "var(--font-source)" }

export function applyBranding(b: { brandColor: string; font: string; density: string } | null) {
  const root = document.documentElement
  if (!b) {
    for (const p of ["--primary", "--ring", "--sidebar-primary", "--font-sans"]) root.style.removeProperty(p)
    delete root.dataset.density
    return
  }
  root.style.setProperty("--primary", b.brandColor)
  root.style.setProperty("--ring", `color-mix(in oklch, ${b.brandColor} 55%, transparent)`)
  root.style.setProperty("--sidebar-primary", b.brandColor)
  if (FONT_VAR[b.font]) root.style.setProperty("--font-sans", FONT_VAR[b.font])
  else root.style.removeProperty("--font-sans")
  root.dataset.density = b.density
}

export function WorkspaceBranding() {
  const { me } = useAuth()
  const { setTheme } = useTheme()
  const workspace = me?.tenant?.branding ?? null
  const personal = me?.user.preferences ?? null

  const brandColor = workspace?.brandColor
  const font = personal && personal.font !== "workspace" ? personal.font : workspace?.font
  const density = personal && personal.density !== "workspace" ? personal.density : workspace?.density
  const theme = personal && personal.theme !== "workspace" ? personal.theme : workspace?.theme

  React.useEffect(() => {
    if (!brandColor) return applyBranding(null)
    applyBranding({ brandColor, font: font ?? "inter", density: density ?? "comfortable" })
    return () => applyBranding(null)
  }, [brandColor, font, density])

  React.useEffect(() => {
    if (theme) setTheme(theme)
  }, [theme, setTheme])

  React.useEffect(() => {
    setDateFormat(personal?.dateFormat ?? "d_mmm_yyyy")
  }, [personal?.dateFormat])

  return null
}
