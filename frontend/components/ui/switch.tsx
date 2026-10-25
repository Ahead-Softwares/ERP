"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** On/off toggle (wireframe .tg: 34 × 20 track). */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & { checked: boolean; onCheckedChange?: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      {...props}
    >
      <span className={cn("absolute top-[3px] size-3.5 rounded-full bg-white shadow-sm transition-[left]", checked ? "left-[17px]" : "left-[3px]")} />
    </button>
  )
}
