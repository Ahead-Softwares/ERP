"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(500, "INTERNAL", "Something went wrong."))

interface State<T> {
  path: string | null
  data: T | null
  error: ApiError | null
}

/** Load a GET endpoint; returns data, error and a reload function. */
export function useApi<T>(path: string | null) {
  const [state, setState] = React.useState<State<T>>({ path: null, data: null, error: null })

  React.useEffect(() => {
    if (!path) return
    let cancelled = false
    api
      .get<T>(path)
      .then((data) => !cancelled && setState({ path, data, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ path, data: s.data, error: toApiError(e) })))
    return () => {
      cancelled = true
    }
  }, [path])

  const reload = React.useCallback(async () => {
    if (!path) return
    try {
      const data = await api.get<T>(path)
      setState({ path, data, error: null })
    } catch (e) {
      setState((s) => ({ ...s, path, error: toApiError(e) }))
    }
  }, [path])

  const setData = React.useCallback((data: T) => setState((s) => ({ ...s, data })), [])

  return {
    data: state.data,
    error: state.error,
    loading: !!path && state.path !== path,
    reload,
    setData,
  }
}
