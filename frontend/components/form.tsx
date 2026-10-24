"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Label + control + one line under it, with ids wired for accessibility. The line shows,
 * in order: the error, a live check in progress, a success note, or the hint.
 */
export function Field({
  label,
  error,
  hint,
  success,
  checking,
  required,
  count,
  children,
  className,
}: {
  label: string
  error?: React.ReactNode
  hint?: React.ReactNode
  /** Shown in green when the value passed a live check, e.g. "Andheri West, Mumbai" */
  success?: string | null
  /** A live server check is running for this value */
  checking?: boolean
  required?: boolean
  /** Character counter for long text: [current, max] */
  count?: [number, number]
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-required"?: boolean; "data-valid"?: string }>
  className?: string
}) {
  const id = React.useId()
  const line = error ? "error" : checking ? "checking" : success ? "success" : hint ? "hint" : null
  const describedBy = line ? `${id}-${line}` : undefined
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {React.cloneElement(children, {
        id,
        "aria-invalid": !!error || undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
        // Green border once a value passed its checks (wireframe 0.3)
        ...(line === "success" ? { "data-valid": "true" } : {}),
      })}
      {(line || count) && (
      <div className="flex items-start justify-between gap-2">
        {line === "error" && (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
        {line === "checking" && (
          <p id={`${id}-checking`} className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Checking…
          </p>
        )}
        {line === "success" && (
          <p id={`${id}-success`} className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" aria-hidden /> {success}
          </p>
        )}
        {line === "hint" && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {count && (
          <p className={cn("ml-auto shrink-0 text-xs tabular-nums text-muted-foreground", count[0] > count[1] && "text-destructive")}>
            {count[0].toLocaleString("en-IN")} / {count[1].toLocaleString("en-IN")}
          </p>
        )}
      </div>
      )}
    </div>
  )
}

/** Native select styled like the shadcn input (reliable on mobile and with keyboards). */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-[color,box-shadow,border-color] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive disabled:bg-muted disabled:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

/** "Fix 3 fields to save: …" — only once a submit found 3 or more problems. */
export function ErrorSummary({ fields, show, action = "save" }: { fields: string[]; show: boolean; action?: string }) {
  if (!show || fields.length < 3) return null
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <strong>Fix {fields.length} fields to {action}:</strong> {fields.join(" · ")}
    </div>
  )
}

/** Asked when leaving or cancelling a form that has changes. */
export function DiscardChangesDialog({
  open,
  count,
  onKeep,
  onDiscard,
}: {
  open: boolean
  count?: number
  onKeep: () => void
  onDiscard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeep()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard {count && count > 1 ? `${count} changes` : "your changes"}?</DialogTitle>
          <DialogDescription>What you changed here hasn&apos;t been saved yet.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeep} autoFocus>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
