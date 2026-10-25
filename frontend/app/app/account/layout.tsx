"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

// My account (wireframes A1–A3): only for the signed-in person, the same in every business.

const ITEMS = [
  { href: "/app/account", label: "Profile & preferences" },
  { href: "/app/account/security", label: "Security" },
  { href: "/app/account/notifications", label: "My notifications" },
  { href: "/app/account/businesses", label: "My businesses" },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { me } = useAuth()
  // The two-step setup is a page of its own (A3), without the side menu
  if (pathname.startsWith("/app/account/two-step")) return <div className="min-w-0 flex-1 px-4 py-6 sm:px-7">{children}</div>
  const active = (href: string) => (href === "/app/account" ? pathname === href : pathname.startsWith(href))
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col lg:flex-row">
      <nav aria-label="My account" className="flex shrink-0 flex-col gap-0.5 border-b bg-card px-3 py-4 lg:w-[220px] lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5 px-2.5 pb-3.5">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{initials(me?.user.name ?? "")}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{me?.user.name}</div>
            <div className="text-[11px] text-muted-foreground">My account</div>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {ITEMS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={cn("shrink-0 rounded-lg px-2.5 py-2 text-[13px] text-foreground/80 hover:bg-muted", active(i.href) && "bg-accent font-bold text-accent-foreground")}
            >
              {i.label}
            </Link>
          ))}
        </div>
        <Link href="/app" className="mt-auto hidden items-center gap-1 px-2.5 pt-4 text-xs text-muted-foreground hover:text-foreground lg:flex">
          <ChevronLeft className="size-3.5" /> Back to {me?.tenant?.name ?? "the app"}
        </Link>
      </nav>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-7">{children}</div>
    </div>
  )
}
