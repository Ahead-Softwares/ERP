import Link from "next/link"
import { CalendarDays, Package, Receipt, ShieldCheck, Sparkles, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

const FEATURES = [
  { icon: Receipt, title: "GST billing", text: "Invoices with CGST/SGST or IGST, receipts and dues." },
  { icon: Users, title: "Customers & leads", text: "Every call, note and follow-up in one timeline." },
  { icon: Package, title: "Stock & catalogue", text: "Products, services, batches and low-stock alerts." },
  { icon: CalendarDays, title: "Bookings", text: "Appointments without double-booking your staff." },
  { icon: Sparkles, title: "AI assistant", text: "Ask “what is overdue today?” and get the answer." },
  { icon: ShieldCheck, title: "Safe by design", text: "Role-based access and isolated data for every business." },
]

export default function Home() {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">A</span>
          AHEAD ERP
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonVariants()}>
            Start free trial
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Run your whole business from one app</h1>
          <p className="mt-5 text-lg text-pretty text-muted-foreground">
            Sales, billing, stock, staff and finance for salons, shops, pharmacies, gyms, schools and service companies — set up for your industry in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Start 15-day free trial
            </Link>
            <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No card needed. Free plan forever after the trial.</p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-4xl border p-6">
              <f.icon className="size-5" />
              <h2 className="mt-4 font-medium">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
