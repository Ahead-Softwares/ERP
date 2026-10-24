// Product illustrations for the homepage, drawn with HTML/SVG so they stay sharp, light and
// crawlable. They are decorative: each wrapper is aria-hidden and the surrounding copy carries
// the meaning.
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className={cn("mk-card overflow-hidden rounded-3xl text-left text-mk-ink select-none", className)}>
      {children}
    </div>
  )
}

function Pill({ tone = "blue", children }: { tone?: "blue" | "green" | "amber" | "red" | "slate"; children: React.ReactNode }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  }
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", tones[tone])}>{children}</span>
}

/* ---------------- Hero: the whole workspace ---------------- */

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Customers" },
  { icon: Receipt, label: "Invoices" },
  { icon: Package, label: "Stock" },
  { icon: CalendarDays, label: "Bookings" },
  { icon: Wallet, label: "Expenses" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
]

const KPIS = [
  { label: "Sales this month", value: "₹8,42,600", delta: "+18%", tone: "green" as const },
  { label: "To collect", value: "₹1,26,400", delta: "14 invoices", tone: "amber" as const },
  { label: "Low stock", value: "9 items", delta: "Reorder", tone: "red" as const },
  { label: "Bookings today", value: "27", delta: "4 staff", tone: "blue" as const },
]

const INVOICES = [
  { no: "INV/26-27/0412", who: "Sharma Traders", amt: "₹48,320", status: ["Paid", "green"] },
  { no: "INV/26-27/0411", who: "Glow Studio", amt: "₹12,980", status: ["Due in 3d", "amber"] },
  { no: "INV/26-27/0410", who: "Mehta Pharma", amt: "₹96,050", status: ["Overdue", "red"] },
  { no: "INV/26-27/0409", who: "FitZone Gym", amt: "₹22,400", status: ["Paid", "green"] },
] as const

export function DashboardMock() {
  return (
    <Frame className="rounded-[28px] shadow-[0_40px_120px_-40px_rgb(29_43_216/0.35)]">
      <div className="flex items-center gap-2 border-b border-mk-line bg-mk-bg px-4 py-3">
        <span className="size-2.5 rounded-full bg-rose-300" />
        <span className="size-2.5 rounded-full bg-amber-300" />
        <span className="size-2.5 rounded-full bg-emerald-300" />
        <div className="mx-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-mk-line bg-white px-3 py-1 text-[11px] text-mk-soft">
          <Search className="size-3" /> Search customers, invoices, items…
        </div>
      </div>
      <div className="grid md:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-mk-line bg-mk-bg/60 p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-2 text-xs font-semibold">
            <span className="grid size-6 place-items-center rounded-lg bg-mk-deep text-[10px] text-white">A</span>
            Sharma Traders
          </div>
          {NAV.map((n) => (
            <div
              key={n.label}
              className={cn(
                "mb-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]",
                n.active ? "bg-white font-medium shadow-sm ring-1 ring-mk-line" : "text-mk-muted"
              )}
            >
              <n.icon className="size-3.5" /> {n.label}
            </div>
          ))}
        </aside>
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-mk-soft">Good morning, Priya</div>
              <div className="text-base font-semibold tracking-tight">Here’s your business today</div>
            </div>
            <span className="mk-cta hidden rounded-full px-3 py-1.5 text-[11px] font-medium text-white sm:inline-flex">+ New invoice</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-2xl border border-mk-line p-3">
                <div className="text-[10px] text-mk-soft">{k.label}</div>
                <div className="mt-1 text-sm font-semibold tracking-tight sm:text-base">{k.value}</div>
                <div className="mt-1">
                  <Pill tone={k.tone}>{k.delta}</Pill>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-mk-line p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">Sales vs collections</span>
                <span className="text-mk-soft">Last 6 months</span>
              </div>
              <SalesChart />
            </div>
            <div className="rounded-2xl border border-mk-line p-3">
              <div className="mb-2 text-[11px] font-medium">Recent invoices</div>
              {INVOICES.map((i) => (
                <div key={i.no} className="flex items-center justify-between border-t border-mk-line py-1.5 text-[11px] first:border-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.who}</div>
                    <div className="text-[10px] text-mk-soft">{i.no}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{i.amt}</div>
                    <Pill tone={i.status[1]}>{i.status[0]}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  )
}

function SalesChart() {
  const sales = [38, 52, 47, 63, 71, 88]
  const paid = [30, 41, 44, 50, 62, 70]
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]
  const line = (d: number[]) => d.map((v, i) => `${i === 0 ? "M" : "L"}${20 + i * 56},${120 - v}`).join(" ")
  return (
    <svg viewBox="0 0 320 140" className="mt-2 h-auto w-full">
      <defs>
        <linearGradient id="mk-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563eb" stopOpacity="0.22" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[30, 60, 90].map((y) => (
        <line key={y} x1="10" x2="310" y1={y} y2={y} stroke="#e2e9f1" strokeDasharray="3 4" />
      ))}
      <path d={`${line(sales)} L300,120 L20,120 Z`} fill="url(#mk-area)" />
      <path d={line(sales)} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={line(paid)} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
      <circle cx="300" cy={120 - 88} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2.5" />
      {months.map((m, i) => (
        <text key={m} x={20 + i * 56} y="137" textAnchor="middle" fontSize="9" fill="#8197aa">
          {m}
        </text>
      ))}
    </svg>
  )
}

/* ---------------- Getting started cards ---------------- */

export function IndustryPickMock() {
  const items = [
    ["Salon & Spa", false],
    ["Retail Shop", true],
    ["Pharmacy", false],
    ["Gym & Fitness", false],
    ["Coaching", false],
    ["Services", false],
  ] as const
  return (
    <div aria-hidden className="grid w-full grid-cols-2 gap-2 p-5">
      {items.map(([label, on]) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between rounded-xl border px-3 py-2 text-[11px]",
            on ? "border-mk-blue bg-blue-50 font-medium text-mk-deep shadow-[0_6px_20px_-8px_rgb(37_99_235/0.6)]" : "border-mk-line bg-white text-mk-muted"
          )}
        >
          {label}
          {on && <Check className="size-3" />}
        </div>
      ))}
    </div>
  )
}

export function ImportMock() {
  return (
    <div aria-hidden className="relative w-full p-5 pb-9">
      <div className="overflow-hidden rounded-xl border border-mk-line bg-white">
        {["Name", "Mobile", "GSTIN", "City"].map((h, r) => (
          <div key={h} className={cn("grid grid-cols-4 gap-2 border-mk-line px-3 py-2", r > 0 && "border-t")}>
            {[0, 1, 2, 3].map((c) => (
              <span key={c} className={cn("h-1.5 rounded-full", r === 0 ? "bg-slate-300" : c === 0 ? "bg-blue-200" : "bg-slate-200")} />
            ))}
          </div>
        ))}
      </div>
      <div className="mk-cta absolute right-8 bottom-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-white">
        <FileSpreadsheet className="size-3.5" /> 1,248 customers imported
      </div>
    </div>
  )
}

export function FirstInvoiceMock() {
  return (
    <div aria-hidden className="relative w-full p-5 pt-9">
      <div className="rounded-xl border border-mk-line bg-white p-3 text-[11px]">
        <div className="flex justify-between pr-11">
          <span className="font-semibold">Tax Invoice</span>
          <span className="text-mk-soft">INV/26-27/0001</span>
        </div>
        <div className="mt-2 space-y-1 text-mk-muted">
          <div className="flex justify-between"><span>Taxable value</span><span>₹10,000.00</span></div>
          <div className="flex justify-between"><span>CGST 9%</span><span>₹900.00</span></div>
          <div className="flex justify-between"><span>SGST 9%</span><span>₹900.00</span></div>
        </div>
        <div className="mt-2 flex justify-between border-t border-mk-line pt-2 font-semibold">
          <span>Total</span>
          <span>₹11,800.00</span>
        </div>
      </div>
      <div className="mk-cta absolute top-2 right-3 grid size-12 place-items-center rounded-full text-center leading-none text-white">
        <span className="text-base font-semibold">90</span>
        <span className="-mt-2 text-[8px]">sec</span>
      </div>
    </div>
  )
}

/* ---------------- Feature rows ---------------- */

export function PipelineMock() {
  const cols = [
    { name: "New enquiry", count: 12, cards: [["Ritu Kapoor", "Bridal package", "₹45,000"], ["Ankit Jain", "Bulk order", "₹1,20,000"]] },
    { name: "Quote sent", count: 7, cards: [["Om Electricals", "AMC renewal", "₹68,000"], ["Neha Verma", "Annual membership", "₹18,000"]] },
    { name: "Follow-up today", count: 5, cards: [["Kiran Stores", "Restock order", "₹32,500"]] },
    { name: "Won", count: 21, cards: [["Desai & Sons", "Fit-out project", "₹2,40,000"]] },
  ]
  return (
    <Frame className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Leads pipeline</div>
        <div className="flex gap-1.5">
          <Pill tone="blue">This month</Pill>
          <Pill tone="green">Won ₹6.8L</Pill>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((c) => (
          <div key={c.name} className="rounded-2xl bg-mk-bg p-2.5">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-medium">
              {c.name} <span className="text-mk-soft">{c.count}</span>
            </div>
            {c.cards.map(([who, what, amt], i) => (
              <div key={who} className={cn("mb-2 rounded-xl border border-mk-line bg-white p-2.5 text-[11px]", c.name === "Follow-up today" && i === 0 && "ring-2 ring-blue-200")}>
                <div className="font-medium">{who}</div>
                <div className="text-mk-soft">{what}</div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="font-semibold">{amt}</span>
                  {c.name === "Follow-up today" && <Pill tone="amber">Call 11:30</Pill>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function BillingMock() {
  const lines = [
    ["Basmati Rice 25kg", "1006", "4", "₹7,600"],
    ["Sunflower Oil 15L", "1512", "6", "₹12,300"],
    ["Toor Dal 30kg", "0713", "2", "₹8,400"],
  ]
  return (
    <div aria-hidden className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Frame className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-mk-soft">Tax Invoice</div>
            <div className="text-sm font-semibold">INV/26-27/0412</div>
          </div>
          <div className="text-right text-[11px]">
            <div className="font-medium">Sharma Traders</div>
            <div className="text-mk-soft">GSTIN 27AAACS1234F1Z5</div>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-mk-line text-[11px]">
          <div className="grid grid-cols-[2fr_1fr_0.6fr_1fr] gap-2 bg-mk-bg px-3 py-2 font-medium text-mk-muted">
            <span>Item</span><span>HSN</span><span>Qty</span><span className="text-right">Amount</span>
          </div>
          {lines.map((l) => (
            <div key={l[0]} className="grid grid-cols-[2fr_1fr_0.6fr_1fr] gap-2 border-t border-mk-line px-3 py-2">
              <span className="truncate">{l[0]}</span><span className="text-mk-soft">{l[1]}</span><span>{l[2]}</span><span className="text-right">{l[3]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 ml-auto max-w-56 space-y-1 text-[11px] text-mk-muted">
          <div className="flex justify-between"><span>Taxable</span><span>₹28,300.00</span></div>
          <div className="flex justify-between"><span>IGST 5%</span><span>₹1,415.00</span></div>
          <div className="flex justify-between border-t border-mk-line pt-1 text-sm font-semibold text-mk-ink"><span>Total</span><span>₹29,715.00</span></div>
        </div>
      </Frame>
      <div className="flex flex-col gap-4">
        <Frame className="p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <Bell className="size-3.5 text-mk-blue" /> Payment received
          </div>
          <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-950">
            ₹48,320 from Sharma Traders by UPI. Receipt RCT/26-27/0388 created and INV/26-27/0412 marked paid.
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-mk-soft"><span>Balance due ₹0</span><span>Today · 11:42 AM</span></div>
        </Frame>
        <Frame className="p-4">
          <div className="text-[11px] text-mk-soft">Collected this week</div>
          <div className="mt-1 text-xl font-semibold tracking-tight">₹3,18,450</div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-mk-tint">
            <span className="w-[62%] bg-mk-blue" />
            <span className="w-[23%] bg-sky-300" />
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-mk-muted">
            <span>● UPI 62%</span><span className="text-sky-500">● Bank 23%</span><span className="text-slate-400">● Cash 15%</span>
          </div>
        </Frame>
      </div>
    </div>
  )
}

export function StockMock() {
  const rows = [
    { item: "Paracetamol 650 (10s)", batch: "PC2409", exp: "Mar 2027", qty: 420, tag: ["In stock", "green"] },
    { item: "Amoxicillin 500 (10s)", batch: "AM2402", exp: "Dec 2026", qty: 36, tag: ["Low stock", "amber"] },
    { item: "Vitamin D3 60K (4s)", batch: "VD2311", exp: "Nov 2026", qty: 58, tag: ["Expires soon", "red"] },
    { item: "ORS Sachet Orange", batch: "OR2407", exp: "Jul 2027", qty: 610, tag: ["In stock", "green"] },
  ] as const
  return (
    <Frame className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Stock · Main branch</div>
        <div className="flex gap-1.5">
          <Pill tone="amber">9 to reorder</Pill>
          <Pill tone="red">4 expiring in 60 days</Pill>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-mk-line text-[11px]">
        <div className="hidden grid-cols-[2fr_1fr_1fr_0.7fr_1fr] gap-2 bg-mk-bg px-3 py-2 font-medium text-mk-muted sm:grid">
          <span>Item</span><span>Batch</span><span>Expiry</span><span>Qty</span><span className="text-right">Status</span>
        </div>
        {rows.map((r) => (
          <div key={r.item} className="grid grid-cols-[2fr_1fr] gap-2 border-t border-mk-line px-3 py-2.5 first:border-0 sm:grid-cols-[2fr_1fr_1fr_0.7fr_1fr] sm:first:border-t">
            <span className="font-medium">{r.item}</span>
            <span className="hidden text-mk-soft sm:block">{r.batch}</span>
            <span className="hidden text-mk-soft sm:block">{r.exp}</span>
            <span className="hidden sm:block">{r.qty}</span>
            <span className="text-right"><Pill tone={r.tag[1]}>{r.tag[0]}</Pill></span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function BookingsMock() {
  const staff = ["Anjali", "Rohit", "Sana", "Vikram"]
  const slots = [
    [0, 0, 2, "Haircut · Meera", "blue"],
    [0, 3, 2, "Hair spa · Kavya", "sky"],
    [1, 1, 3, "PT session · Arjun", "violet"],
    [2, 0, 1, "Facial · Isha", "emerald"],
    [2, 2, 2, "Bridal trial · Pooja", "blue"],
    [3, 1, 2, "Consult · Raj", "amber"],
    [3, 4, 1, "Haircut · Dev", "sky"],
  ] as const
  const tone: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    sky: "bg-sky-50 border-sky-200 text-sky-800",
    violet: "bg-violet-50 border-violet-200 text-violet-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  }
  return (
    <Frame className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">Today · Fri 24 Oct</div>
        <Pill tone="green">No clashes</Pill>
      </div>
      <div className="grid grid-cols-[52px_repeat(4,1fr)] gap-x-2 text-[10px]">
        <span />
        {staff.map((s) => (
          <span key={s} className="pb-2 text-center font-medium">{s}</span>
        ))}
        <div className="grid grid-rows-5 text-mk-soft">
          {["10:00", "11:00", "12:00", "1:00", "2:00"].map((t) => (
            <span key={t} className="h-10">{t}</span>
          ))}
        </div>
        {staff.map((s, col) => (
          <div key={s} className="relative h-50 rounded-xl bg-mk-bg">
            {slots
              .filter((x) => x[0] === col)
              .map(([, start, len, label, t]) => (
                <div
                  key={label}
                  className={cn("absolute inset-x-1 overflow-hidden rounded-lg border px-1.5 py-1 leading-tight", tone[t])}
                  style={{ top: start * 40 + 2, height: len * 40 - 4 }}
                >
                  {label}
                </div>
              ))}
          </div>
        ))}
      </div>
    </Frame>
  )
}

/* ---------------- AI assistant ---------------- */

export function AssistantMock() {
  const insights = [
    { title: "₹1,26,400 is waiting to be collected", body: "14 invoices are past due. Mehta Pharma alone owes ₹96,050 — 9 days late.", tag: "Collections" },
    { title: "Hair spa bookings are up 34%", body: "Saturday slots fill by Thursday. Adding one stylist on weekends could add ~₹42,000 a month.", tag: "Bookings" },
    { title: "Amoxicillin 500 will run out in 5 days", body: "At the current pace you need 120 strips. Last purchase price ₹74/strip from Om Medico.", tag: "Stock" },
  ]
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="mk-card relative z-30 rounded-3xl p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium text-mk-blue">
          <Sparkles className="size-3.5" /> Ask AHEAD
        </div>
        <div className="mt-2 rounded-2xl bg-mk-bg px-3 py-2 text-[12px]">What should I look at today?</div>
        <div className="mt-3 rounded-2xl border border-mk-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">{insights[0].title}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-mk-muted">{insights[0].body}</p>
          <div className="mt-2 flex items-center justify-between">
            <Pill tone="amber">{insights[0].tag}</Pill>
            <span className="mk-cta rounded-full px-2.5 py-1 text-[10px] font-medium text-white">Send reminders</span>
          </div>
        </div>
      </div>
      {insights.slice(1).map((i, idx) => (
        <div
          key={i.title}
          className="mk-card absolute inset-x-0 rounded-3xl p-4"
          style={{ bottom: -(idx + 1) * 14, transform: `scale(${0.95 - idx * 0.05})`, zIndex: 20 - idx, opacity: 0.85 - idx * 0.25 }}
        >
          <div className="text-[12px] font-semibold text-transparent">{i.title}</div>
        </div>
      ))}
    </div>
  )
}
