"use client"

import * as React from "react"
import { Dashboard } from "@/components/dashboard/dashboard"

export default function DashboardPage() {
  return (
    <React.Suspense>
      <Dashboard />
    </React.Suspense>
  )
}
