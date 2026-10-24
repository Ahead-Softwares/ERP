"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth"

// Applies the workspace look (Settings › Branding / setup wizard) to the whole page:
// brand colour → --primary, font → --font-sans, density → data-density on <html>.
// Theme: the workspace default is used until this person picks their own.

const FONT_VAR: Record<string, string> = { inter: "", manrope: "var(--font-manrope)", plex: "var(--font-plex)", source: "var(--font-source)" }
const PERSONAL_THEME_KEY = "theme" // next-themes' own key
const WORKSPACE_THEME_KEY = "ahead:workspace-theme"

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
  const branding = me?.tenant?.branding ?? null

  React.useEffect(() => {
    applyBranding(branding)
    return () => applyBranding(null)
  }, [branding])

  React.useEffect(() => {
    if (!branding) return
    try {
      // next-themes stores whatever was last set; it counts as the person's own choice only
      // when it differs from the workspace theme we applied last time
      const stored = localStorage.getItem(PERSONAL_THEME_KEY)
      const appliedByWorkspace = localStorage.getItem(WORKSPACE_THEME_KEY)
      if (stored === null || stored === appliedByWorkspace) {
        setTheme(branding.theme)
        localStorage.setItem(WORKSPACE_THEME_KEY, branding.theme)
      }
    } catch {
      // storage blocked: keep the system theme
    }
  }, [branding, setTheme])

  return null
}
