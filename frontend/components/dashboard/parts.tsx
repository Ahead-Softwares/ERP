"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPaise } from "@/lib/format"
import { isError, type Change } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

// Building blocks for dashboard widgets (wireframes 5.1–5.8).

export const money = (paise: number) => formatPaise(paise, true)

export const pill = "inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-semibold whitespace-nowrap"
export const tones = {
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  blue: "bg-accent text-accent-foreground",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  grey: "bg-muted text-foreground/80",
}

/** ▲ 12% / ▼ 4% — `goodWhenDown` for expenses, no-shows, cancellations */
export function Delta({ change, goodWhenDown, unit = "%", absolute }: { change: Change | null | undefined; goodWhenDown?: boolean; unit?: string; absolute?: (n: number) => string }) {
  if (!change) return null
  const value = absolute ? change.delta : change.pct
  if (value === null || value === 0) return <span className="text-xs font-semibold text-muted-foreground">{change.delta === 0 ? "No change" : "New"}</span>
  const up = change.delta > 0
  const good = goodWhenDown ? !up : up
  return (
    <span className={cn("text-xs font-semibold", good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
      {up ? "▲" : "▼"} {absolute ? absolute(Math.abs(change.delta)) : `${Math.abs(value)}${unit}`}
    </span>
  )
}

export function Kpi({ label, value, change, note, href, goodWhenDown, tone, absolute }: { label: string; value: React.ReactNode; change?: Change | null; note?: React.ReactNode; href?: string; goodWhenDown?: boolean; tone?: "red"; absolute?: (n: number) => string }) {
  const body = (
    <>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {change !== undefined && <Delta change={change} goodWhenDown={goodWhenDown} absolute={absolute} />}
        {note && <span className={cn("text-xs", tone === "red" ? "font-semibold text-red-700 dark:text-red-400" : "text-muted-foreground")}>{note}</span>}
      </div>
    </>
  )
  const cls = "block rounded-xl border bg-card px-3.5 py-3"
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}

/** A widget card: title, optional right side, and its own loading / error / empty states. */
export function Widget({
  title,
  right,
  data,
  slow,
  onRetry,
  empty,
  children,
  className,
}: {
  title: string
  right?: React.ReactNode
  data: unknown
  slow?: boolean
  onRetry?: () => void
  /** Shown instead of the content when there's nothing yet */
  empty?: React.ReactNode | false
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-3.5 py-3", className)} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {data !== undefined && !isError(data) && right}
      </div>
      {data === undefined ? (
        <div className="grid gap-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          {slow && <p className="text-xs text-muted-foreground">Still loading…</p>}
        </div>
      ) : isError(data) ? (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs dark:border-red-900 dark:bg-red-950/20">
          Couldn&apos;t load {title}.{" "}
          {onRetry && (
            <button type="button" className="font-semibold text-primary hover:underline" onClick={onRetry}>
              Retry
            </button>
          )}{" "}
          <span className="text-muted-foreground">— the other widgets keep working.</span>
        </div>
      ) : empty ? (
        <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">{empty}</div>
      ) : (
        children
      )}
    </section>
  )
}

export function WidgetLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-primary hover:underline">
      {children}
    </Link>
  )
}

/** Labelled horizontal bar with the value on the right */
export function Meter({ label, value, pct, color, href }: { label: React.ReactNode; value: React.ReactNode; pct: number; color?: string; href?: string }) {
  const inner = (
    <>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <strong className="shrink-0 tabular-nums">{value}</strong>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <i className="block h-full rounded-full" style={{ width: `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct))}%`, background: color ?? "var(--primary)" }} />
      </div>
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-md hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  )
}

/** Shades of the brand colour for stacked meters (keeps lightness apart, not only hue) */
export const SHADES = ["var(--primary)", "color-mix(in oklab, var(--primary) 70%, white)", "color-mix(in oklab, var(--primary) 50%, white)", "color-mix(in oklab, var(--primary) 32%, white)", "var(--input)"]
export const WARN = ["var(--primary)", "#C27C0E", "#C2410C", "#B42318"]

/** Vertical bars; `pair` draws two bars per slot (e.g. invoiced vs collected). */
export function Bars({ rows, height = 140, pair, labels }: { rows: { label: string; a: number; b?: number; title?: string }[]; height?: number; pair?: boolean; labels?: [string, string] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b ?? 0)))
  const every = rows.length > 16 ? Math.ceil(rows.length / 10) : 1
  return (
    <div>
      {labels && (
        <div className="mb-1 flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm" style={{ background: "var(--primary)" }} /> {labels[0]}
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm" style={{ background: SHADES[2] }} /> {labels[1]}
          </span>
        </div>
      )}
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={rows.map((r) => `${r.label}: ${r.title ?? r.a}`).join(", ")}>
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={r.title}>
            <div className="flex w-full items-end gap-[2px]" style={{ height: height - 18 }}>
              <div className="flex-1 rounded-t" style={{ height: `${(r.a / max) * 100}%`, minHeight: r.a ? 2 : 0, background: "var(--primary)" }} />
              {pair && <div className="flex-1 rounded-t" style={{ height: `${((r.b ?? 0) / max) * 100}%`, minHeight: r.b ? 2 : 0, background: SHADES[2] }} />}
            </div>
            <span className="h-3 text-[10px] leading-3 text-muted-foreground">{i % every === 0 || i === rows.length - 1 ? r.label : ""}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  )
}
export const th = "border-b px-2 py-1.5 text-left font-semibold text-muted-foreground"
export const td = "border-b border-border/60 px-2 py-[7px]"

export function ActionButton({ onClick, children, busy }: { onClick: () => void | Promise<void>; children: React.ReactNode; busy?: boolean }) {
  const [running, setRunning] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={running || busy}
      onClick={async () => {
        setRunning(true)
        try {
          await onClick()
        } finally {
          setRunning(false)
        }
      }}
    >
      {running ? "…" : children}
    </Button>
  )
}
