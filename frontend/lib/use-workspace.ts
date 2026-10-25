"use client"

import * as React from "react"
import type { SetupTenant, Workspace } from "@/components/setup/wizard"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"

/** Tenant + workspace preferences for a settings page; refresh also reloads /me (branding, banners). */
export function useWorkspaceData() {
  const tenant = useApi<SetupTenant>("/tenant")
  const workspace = useApi<Workspace>("/tenant/workspace")
  const { reload } = useAuth()
  const reloadTenant = tenant.reload
  const reloadWorkspace = workspace.reload
  const refresh = React.useCallback(async () => {
    await Promise.all([reloadTenant(), reloadWorkspace(), reload()])
  }, [reloadTenant, reloadWorkspace, reload])
  return {
    tenant: tenant.data,
    workspace: workspace.data,
    error: tenant.error ?? workspace.error,
    refresh,
  }
}
