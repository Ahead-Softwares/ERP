"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Shared pieces of the signup flow and the setup wizard (Phase 1 wireframes 1.x / 2.x).

export interface RailStep {
  key: string
  label: string
  /** Shown under the label once the step is done, e.g. "Glow Studio · Maharashtra" */
  summary?: string
  state: "done" | "current" | "todo" | "skipped"
}

/** Dark left panel with the step list (signup). */
export function SignupRail({ steps, footer }: { steps: RailStep[]; footer?: React.ReactNode }) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-10 bg-[#1B2A5C] p-10 text-white lg:flex xl:w-96">
      <Link href="/" className="text-xl font-extrabold tracking-wider">
        AHEAD
      </Link>
      <ol className="grid gap-6" aria-label="Signup steps">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3" aria-current={s.state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-bold",
                s.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                s.state === "current" && "border-white bg-white text-[#1B2A5C]",
                s.state === "todo" && "border-[#6E7FB8] text-[#C9D2F0]"
              )}
            >
              {s.state === "done" ? <Check className="size-4" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm font-semibold", s.state === "todo" && "text-[#C9D2F0]")}>{s.label}</span>
              {s.summary && <span className="mt-0.5 block truncate text-xs text-[#B5C0E6]">{s.summary}</span>}
            </span>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-auto border-t border-[#34447A] pt-5 text-sm leading-relaxed text-[#C9D2F0]">{footer}</div>}
    </aside>
  )
}

/** "Step 2 of 5" + bar, for the top of each step (always visible, also on phones). */
export function StepProgress({ index, total, right }: { index: number; total: number; right?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Step {index + 1} of {total}
        </span>
        {right}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  )
}

/** Six boxes for a one-time code: typing advances, paste fills all, backspace goes back. */
export function OtpInput({ value, onChange, onComplete, invalid, disabled }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; disabled?: boolean }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "")
  const update = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6)
    onChange(clean)
    if (clean.length === 6) onComplete?.(clean)
  }
  return (
    <div className="flex gap-2 sm:gap-3" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          name={i === 0 ? "otp" : undefined}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          value={d}
          autoFocus={i === 0}
          className="size-12 rounded-2xl border bg-background text-center text-xl font-bold tabular-nums outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/25 aria-invalid:border-destructive sm:size-14 sm:text-2xl"
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "")
            if (typed.length > 1) {
              // Paste or SMS autofill into one box
              update(typed)
              refs.current[Math.min(5, typed.length)]?.focus()
              return
            }
            const next = digits.slice()
            next[i] = typed
            update(next.join(""))
            if (typed && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus()
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus()
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus()
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

/** Pill-style single/multi choice that behaves like a radio or checkbox for keyboards. */
export function ChoiceChip({ selected, onClick, children, className, role = "radio" }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string; role?: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-2 text-left text-sm font-medium transition hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none",
        selected ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "bg-background",
        className
      )}
    >
      {children}
    </button>
  )
}
