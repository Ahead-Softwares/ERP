"use client"

import * as React from "react"
import { toast } from "sonner"
import { TEAM_EVENTS } from "@contracts/account"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ErrorState } from "@/components/page-states"
import { api, errorMessage } from "@/lib/api"
import type { AccountOverview } from "@/lib/account"
import { useApi } from "@/lib/use-api"

// My account › My notifications: mute team alerts per channel. Security emails (password,
// email change, two-step reset) can't be muted, and customer messages aren't personal.

export default function MyNotificationsPage() {
  const { data, error, reload } = useApi<AccountOverview>("/account")
  const [saving, setSaving] = React.useState(false)
  if (error && !data) return <ErrorState error={error} onRetry={reload} />

  const toggle = async (channel: "inApp" | "email", key: string, on: boolean) => {
    if (!data) return
    const muted = data.preferences.mutedAlerts
    const list = on ? muted[channel].filter((k) => k !== key) : [...muted[channel], key]
    setSaving(true)
    try {
      await api.put("/account/preferences", { ...data.preferences, mutedAlerts: { ...muted, [channel]: list } })
      await reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">My notifications</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Alerts sent to you. Your business decides which alerts exist; you can mute the ones you don&apos;t need.</p>
      </div>
      {!data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <section className="rounded-xl border bg-card px-[18px] py-3.5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-semibold">Alert</th>
                <th className="w-20 py-2 text-center font-semibold">In-app</th>
                <th className="w-20 py-2 text-center font-semibold">Email</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_EVENTS.map((e) => (
                <tr key={e.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5">{e.label}</td>
                  {(["inApp", "email"] as const).map((ch) => (
                    <td key={ch} className="py-2.5 text-center">
                      <Switch aria-label={`${e.label} · ${ch === "inApp" ? "in-app" : "email"}`} checked={!data.preferences.mutedAlerts[ch].includes(e.key)} disabled={saving} onCheckedChange={(on) => toggle(ch, e.key, on)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2.5 text-muted-foreground">Security emails (password, email change, two-step reset)</td>
                <td className="py-2.5 text-center text-xs text-muted-foreground">—</td>
                <td className="py-2.5 text-center text-xs text-muted-foreground">Always on</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
