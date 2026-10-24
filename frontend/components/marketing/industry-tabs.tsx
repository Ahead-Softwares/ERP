"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export const INDUSTRIES = [
  {
    key: "retail",
    label: "Retail shops",
    before: ["Bills written by hand or in a separate billing tool", "Prices and GST rates looked up every time", "Credit customers tracked in a diary"],
    after: ["GST bill in seconds, items picked by name or code", "One catalogue with prices, HSN codes and GST rates", "Every customer's invoices and payments on one screen"],
  },
  {
    key: "salon",
    label: "Salons & spas",
    before: ["Appointments in a register, double bookings on Saturdays", "No idea which stylist earns the most", "Memberships tracked on paper cards"],
    after: ["A calendar per stylist that blocks double bookings", "Services with duration, price and GST ready to bill", "Client history, hair and skin type and birthdays in the profile"],
  },
  {
    key: "pharmacy",
    label: "Pharmacies",
    before: ["Medicine details copied by hand on every bill", "Doctor and patient details lost after the sale", "Expired stock found on the shelf, not in the system"],
    after: ["Medicines with manufacturer, composition and schedule", "Doctor name saved on the customer for repeat bills", "Batch, expiry and reorder alerts (coming soon)"],
  },
  {
    key: "gym",
    label: "Gyms & studios",
    before: ["Renewals missed because nobody checked the sheet", "Trainer schedules on WhatsApp", "Fees collected in cash with no receipt trail"],
    after: ["Members with fitness goal and membership end date", "Personal-training slots booked per trainer", "Receipts for every payment, dues visible to the front desk"],
  },
  {
    key: "school",
    label: "Coaching & schools",
    before: ["Fee dues chased from an Excel sheet", "Guardian numbers scattered across phones", "Batch timetables pinned on the wall"],
    after: ["Fee invoices and receipts per student, dues at a glance", "Student and guardian details in one record", "Batches, teachers and tasks organised in one place"],
  },
  {
    key: "services",
    label: "Service companies",
    before: ["Quotes in Word, invoices in another app", "Jobs and follow-ups in team members' heads", "Monthly P&L only after the accountant visits"],
    after: ["Lead → quotation → GST invoice in one flow", "Tasks, owners and due dates for every job", "Expenses and income on a dashboard you can open anytime"],
  },
] as const

export function IndustryTabs() {
  const [active, setActive] = React.useState<string>(INDUSTRIES[0].key)
  const current = INDUSTRIES.find((i) => i.key === active) ?? INDUSTRIES[0]

  return (
    <div>
      <div role="tablist" aria-label="Choose your industry" className="flex flex-wrap justify-center gap-2">
        {INDUSTRIES.map((i) => (
          <button
            key={i.key}
            id={`tab-${i.key}`}
            role="tab"
            type="button"
            aria-selected={i.key === active}
            aria-controls={`panel-${i.key}`}
            onClick={() => setActive(i.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              i.key === active
                ? "border-blue-300 bg-blue-50 text-mk-deep shadow-[0_0_0_4px_rgb(191_219_254/0.4)]"
                : "border-mk-line bg-white text-mk-muted hover:text-mk-ink"
            )}
          >
            {i.label}
          </button>
        ))}
      </div>

      {INDUSTRIES.map((i) => (
        <div
          key={i.key}
          id={`panel-${i.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${i.key}`}
          hidden={i.key !== current.key}
          className="mt-10 grid gap-4 md:grid-cols-2"
        >
          <div className="rounded-3xl border border-dashed border-mk-line bg-white/60 p-6 sm:p-8">
            <p className="text-sm font-medium text-mk-soft">Before</p>
            <ul className="mt-5 space-y-4">
              {i.before.map((b) => (
                <li key={b} className="flex gap-3 text-mk-muted">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500">
                    <X className="size-3" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="mk-card rounded-3xl p-6 sm:p-8">
            <p className="text-sm font-medium text-mk-blue">With AHEAD</p>
            <ul className="mt-5 space-y-4">
              {i.after.map((a) => (
                <li key={a} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blue-50 text-mk-blue">
                    <Check className="size-3" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
