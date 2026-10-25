"use client"

import * as React from "react"
import { previousRange, rangeFor, type DashboardLayout, type DashboardPrefs, type DashboardTab } from "@contracts/dashboard"
import { api, ApiError } from "@/lib/api"

// Dashboard v2 (Phase 3): tab config, per-tab data with the shared range, saved layout.

export interface DashboardConfig {
  tabs: { key: DashboardTab; label: string; readOnly: boolean }[]
  defaultTab: DashboardTab | null
  branches: { id: string; name: string }[]
  prefs: DashboardPrefs
  widgets: Record<DashboardTab, { key: string; label: string }[]>
  today: string
}

export interface Change {
  prev: number
  delta: number
  pct: number | null
}

export type WidgetData<T = Record<string, unknown>> = T | { error: string } | undefined

export const isError = (w: unknown): w is { error: string } => !!w && typeof w === "object" && "error" in (w as object)

export interface Query {
  from: string
  to: string
  compare: boolean
  branchId: string | null
}

export function queryFor(prefs: DashboardPrefs, today: string, weekStart: "monday" | "sunday" = "monday"): Query {
  const r = rangeFor(prefs.range, today, { from: prefs.from, to: prefs.to }, weekStart)
  return { ...r, compare: prefs.compare, branchId: prefs.branchId }
}

export { previousRange }

/** One tab's widgets for the query; reload() refetches (widget Retry). */
export function useTabData(tab: DashboardTab | null, q: Query | null) {
  const key = tab && q ? `${tab}|${q.from}|${q.to}|${q.compare ? 1 : 0}|${q.branchId ?? ""}` : null
  const [state, setState] = React.useState<{ key: string | null; data: Record<string, unknown> | null; error: ApiError | null; slow: boolean }>({ key: null, data: null, error: null, slow: false })
  const [nonce, setNonce] = React.useState(0)

  React.useEffect(() => {
    if (!key || !tab || !q) return
    let live = true
    const params = new URLSearchParams({ from: q.from, to: q.to, compare: q.compare ? "1" : "0", ...(q.branchId ? { branchId: q.branchId } : {}) })
    // After 10 s the skeletons say "Still loading…"
    const slow = setTimeout(() => live && setState((s) => (s.key === key ? s : { ...s, slow: true })), 10_000)
    api
      .get<{ data: Record<string, unknown> }>(`/dashboard/tab/${tab}?${params}`)
      .then((r) => live && setState({ key, data: r.data, error: null, slow: false }))
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiError ? e : new ApiError(0, "INTERNAL", String(e)), slow: false }))
    return () => {
      live = false
      clearTimeout(slow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key covers tab and query
  }, [key, nonce])

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    slow: !current && state.slow,
    reload: () => setNonce((x) => x + 1),
  }
}

/** Save dashboard preferences quietly, merging quick successive changes. */
export function usePrefsSaver() {
  const pending = React.useRef<Partial<DashboardPrefs>>({})
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  return React.useCallback((patch: Partial<DashboardPrefs>) => {
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      void api.put("/dashboard/preferences", body).catch(() => undefined)
    }, 600)
  }, [])
}

export type Layouts = Partial<Record<DashboardTab, DashboardLayout>>

/** A widget from another tab added here is stored as "tab.widget". */
export const splitWidgetKey = (k: string, tab: DashboardTab): [DashboardTab, string] => (k.includes(".") ? (k.split(".") as [DashboardTab, string]) : [tab, k])
