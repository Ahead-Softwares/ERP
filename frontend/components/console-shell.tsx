"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Building2, CreditCard, LayoutDashboard, Menu, ScrollText, Settings2, Tags, Users, X, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NavLink, UserMenu, WorkspaceSwitcher } from "@/components/app-shell"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

// design v2: the AHEAD team's Console. Items show only for roles that have the permission;
// screens marked "Soon" arrive in Step 3–4.
interface ConsoleNav {
  href: string
  label: string
  icon: LucideIcon
  permission: string
  ready: boolean
}

const CONSOLE_NAV: ConsoleNav[] = [
  { href: "/console", label: "Dashboard", icon: LayoutDashboard, permission: "platform.dashboard.view", ready: true },
  { href: "/console/clients", label: "Clients", icon: Building2, permission: "platform.tenant.view", ready: false },
  { href: "/console/plans", label: "Plans & prices", icon: Tags, permission: "platform.plan.view", ready: false },
  { href: "/console/payments", label: "Payments", icon: CreditCard, permission: "platform.payment.view", ready: false },
  { href: "/console/team", label: "Console users", icon: Users, permission: "platform.member.view", ready: false },
  { href: "/console/settings", label: "Settings", icon: Settings2, permission: "platform.setting.view", ready: false },
  { href: "/console/audit", label: "Audit log", icon: ScrollText, permission: "platform.audit.view", ready: false },
]

function ConsoleSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { canConsole } = useAuth()
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label="Console">
      {CONSOLE_NAV.filter((item) => canConsole(item.permission)).map((item) =>
        item.ready ? (
          <NavLink key={item.href} href={item.href} active={pathname === item.href} onClick={onNavigate}>
            <item.icon className="size-4" /> {item.label}
          </NavLink>
        ) : (
          <span
            key={item.href}
            aria-disabled="true"
            className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-sidebar-foreground/50")}
          >
            <item.icon className="size-4" />
            <span className="flex-1 truncate">{item.label}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Soon</Badge>
          </span>
        )
      )}
    </nav>
  )
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  return (
    <div className="flex min-h-svh flex-col">
      <div className="bg-foreground px-4 py-1.5 text-center text-xs text-background">
        AHEAD Console — client business data is never shown here without the client&apos;s consent.
      </div>
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <div className="border-b p-3">
            <WorkspaceSwitcher />
          </div>
          <ConsoleSidebar />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
              <div className="flex items-center justify-between border-b p-3">
                <WorkspaceSwitcher />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                  <X className="size-4" />
                </Button>
              </div>
              <ConsoleSidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-4" />
            </Button>
            <div className="flex-1" />
            <UserMenu />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
