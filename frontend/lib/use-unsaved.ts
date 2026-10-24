"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Warn before work is lost: the browser's own prompt on reload/close, and a callback for
 * in-app link clicks so the page can ask "Discard changes?" before navigating.
 */
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(url.pathname + url.search + url.hash)
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  return {
    /** A link was clicked while there were changes */
    leaving: pendingHref !== null,
    stay: () => setPendingHref(null),
    leave: () => {
      const href = pendingHref
      setPendingHref(null)
      if (href) router.push(href)
    },
  }
}

/**
 * Debounced server check for a single value (unique SKU, existing customer …).
 * `check` resolves to an error message, or null when the value is fine.
 */
export function useAsyncCheck(value: string, check: (v: string) => Promise<string | null>, opts: { enabled?: boolean; delay?: number } = {}) {
  const { enabled = true, delay = 400 } = opts
  const [result, setResult] = React.useState<{ value: string; message: string | null; failed?: boolean } | null>(null)
  const checkRef = React.useRef(check)
  React.useEffect(() => {
    checkRef.current = check
  })

  React.useEffect(() => {
    if (!enabled || !value) return
    let cancelled = false
    const t = setTimeout(() => {
      checkRef.current(value)
        .then((message) => !cancelled && setResult({ value, message }))
        .catch(() => !cancelled && setResult({ value, message: null, failed: true }))
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value, enabled, delay])

  type Status = "idle" | "checking" | "ok" | "error"
  if (!enabled || !value) return { status: "idle" as Status, message: null }
  if (result?.value !== value) return { status: "checking" as Status, message: null }
  // A failed check (network) never blocks the form; the API re-checks on save
  return { status: (result.failed ? "idle" : result.message ? "error" : "ok") as Status, message: result.message }
}
