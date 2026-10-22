"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/app/settings", label: "Business", permission: "tenant.settings.view" },
  { href: "/app/settings/branches", label: "Branches", permission: "tenant.branch.view" },
  { href: "/app/settings/team", label: "Team", permission: "tenant.member.view" },
  { href: "/app/settings/roles", label: "Roles", permission: "tenant.role.view" },
  { href: "/app/settings/customization", label: "Customization", permission: "tenant.config.view" },
  { href: "/app/settings/audit", label: "Audit log", permission: "tenant.audit.view" },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { can } = useAuth()
  return (
    <>
      <PageHeader title="Settings" description="Your business profile, team, roles and customization." />
      <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b pb-px" aria-label="Settings">
        {TABS.filter((t) => can(t.permission)).map((t) => {
          const active = t.href === "/app/settings" ? pathname === t.href : pathname.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                active && "border-primary font-medium text-foreground"
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </>
  )
}
