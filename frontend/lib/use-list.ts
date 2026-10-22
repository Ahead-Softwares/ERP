"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"

interface Page<T> {
  data: T[]
  nextCursor: string | null
  [extra: string]: unknown
}

/** Cursor-paginated list with search/filter params; resets when params change. */
export function useList<T extends { id: string }>(path: string, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString()
  const url = `${path}${query ? `?${query}` : ""}`
  const [state, setState] = React.useState<{ url: string | null; rows: T[]; next: string | null; extra: Record<string, unknown>; error: ApiError | null }>({
    url: null,
    rows: [],
    next: null,
    extra: {},
    error: null,
  })
  const [loadingMore, setLoadingMore] = React.useState(false)

  const fetchPage = React.useCallback(
    async (cursor?: string) => {
      const sep = url.includes("?") ? "&" : "?"
      return api.get<Page<T>>(`${url}${cursor ? `${sep}cursor=${cursor}` : ""}`)
    },
    [url]
  )

  React.useEffect(() => {
    let cancelled = false
    fetchPage()
      .then(({ data, nextCursor, ...extra }) => !cancelled && setState({ url, rows: data, next: nextCursor, extra, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ ...s, url, error: e instanceof ApiError ? e : null })))
    return () => {
      cancelled = true
    }
  }, [fetchPage, url])

  const reload = React.useCallback(async () => {
    const { data, nextCursor, ...extra } = await fetchPage()
    setState({ url, rows: data, next: nextCursor, extra, error: null })
  }, [fetchPage, url])

  const loadMore = React.useCallback(async () => {
    if (!state.next) return
    setLoadingMore(true)
    try {
      const { data, nextCursor } = await fetchPage(state.next)
      setState((s) => ({ ...s, rows: [...s.rows, ...data], next: nextCursor }))
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, state.next])

  return {
    rows: state.rows,
    extra: state.extra,
    error: state.error,
    loading: state.url !== url,
    hasMore: !!state.next,
    loadingMore,
    loadMore,
    reload,
  }
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
