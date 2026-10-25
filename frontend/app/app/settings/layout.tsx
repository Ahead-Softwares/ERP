"use client"

import { SettingsFrame } from "@/components/settings-shell"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>
}
