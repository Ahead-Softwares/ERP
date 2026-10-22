"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/app-shell"
import { Spinner, StatusBadge } from "@/components/common"
import { Field, FormError, NativeSelect } from "@/components/form"
import { ContactPicker, UserSelect, useDirectory, type ContactOption, type ItemOption } from "@/components/pickers"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatPaise } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Appointment {
  id: string
  kind: "appointment" | "event"
  title: string
  contactId: string | null
  itemId: string | null
  staffId: string | null
  startAt: string
  endAt: string
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show"
  notes: string | null
  invoiceId: string | null
  contact: { id: string; name: string; phone: string | null } | null
  staff: { id: string; name: string } | null
  item: { id: string; name: string; pricePaise: number } | null
  version: number
}

const DAY = 86_400_000
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // Monday = 0
  return new Date(x.getTime() - dow * DAY)
}
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

function BookingDialog({ defaultStart, onClose, onSaved }: { defaultStart: Date; onClose: () => void; onSaved: () => void }) {
  const { term, can } = useAuth()
  const services = useApi<{ data: ItemOption[] }>("/items?type=service&limit=100")
  const [kind, setKind] = React.useState<"appointment" | "event">(can("bookings.appointment.create") ? "appointment" : "event")
  const [contact, setContact] = React.useState<ContactOption | null>(null)
  const [itemId, setItemId] = React.useState("")
  const [staffId, setStaffId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [start, setStart] = React.useState(localInput(defaultStart))
  const [duration, setDuration] = React.useState("30")
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const service = services.data?.data.find((s) => s.id === itemId)
  const provider = term("role.service_provider", "Staff")

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const startAt = new Date(start)
    try {
      await api.post("/appointments", {
        kind,
        title: title || undefined,
        contactId: kind === "appointment" ? (contact?.id ?? null) : null,
        itemId: kind === "appointment" && itemId ? itemId : null,
        staffId,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + Number(duration || 30) * 60_000).toISOString(),
        notes: notes || null,
      })
      toast.success(kind === "appointment" ? "Booked" : "Event added")
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New {kind === "appointment" ? term("entity.appointment.singular", "appointment").toLowerCase() : "event"}</DialogTitle>
          <DialogDescription>A {provider.toLowerCase()} can never be double-booked.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          {can("bookings.appointment.create") && can("bookings.event.create") && (
            <div className="inline-flex w-fit rounded-full bg-muted p-1 text-sm" role="radiogroup" aria-label="Type">
              {(["appointment", "event"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("rounded-full px-3 py-1", kind === k && "bg-background font-medium shadow-sm")}>
                  {k === "appointment" ? term("entity.appointment.singular", "Appointment") : "Meeting / event"}
                </button>
              ))}
            </div>
          )}
          {kind === "appointment" && (
            <>
              <Field label={term("entity.contact.singular", "Customer")} error={errors.contactId}><ContactPicker value={contact} onChange={setContact} /></Field>
              <Field label="Service" error={errors.itemId}>
                <NativeSelect value={itemId} onChange={(e) => { setItemId(e.target.value); const s = services.data?.data.find((x) => x.id === e.target.value); if (s?.durationMin) setDuration(String(s.durationMin)) }}>
                  <option value="">—</option>
                  {services.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatPaise(s.pricePaise)}{s.durationMin ? ` · ${s.durationMin} min` : ""}</option>)}
                </NativeSelect>
              </Field>
            </>
          )}
          <Field label="Title" hint={kind === "appointment" ? "Optional — defaults to service and customer" : undefined} error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required={kind === "event"} placeholder={kind === "appointment" ? [service?.name, contact?.name].filter(Boolean).join(" · ") : "Team meeting"} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" error={errors.startAt}><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
            <Field label="Duration (minutes)" error={errors.endAt}><Input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <Field label={kind === "appointment" ? provider : "Attendee"} error={errors.staffId}><UserSelect value={staffId} onChange={setStaffId} emptyLabel={kind === "appointment" ? "Any / not assigned" : "Me"} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          <FormError message={error} />
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AppointmentDialog({ appt, onClose, onChanged }: { appt: Appointment; onClose: () => void; onChanged: () => void }) {
  const router = useRouter()
  const { can, term } = useAuth()
  const [busy, setBusy] = React.useState(false)
  const setStatus = async (status: Appointment["status"]) => {
    setBusy(true)
    try {
      await api.patch(`/appointments/${appt.id}`, { status, version: appt.version })
      toast.success("Updated")
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{appt.title} <StatusBadge status={appt.status} /></DialogTitle>
          <DialogDescription>
            {new Date(appt.startAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {time(appt.startAt)}–{time(appt.endAt)}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          {appt.contact && <div className="flex justify-between"><dt className="text-muted-foreground">{term("entity.contact.singular", "Customer")}</dt><dd><Link href={`/app/m/crm/${appt.contact.id}`} className="font-medium hover:underline">{appt.contact.name}</Link>{appt.contact.phone && ` · ${appt.contact.phone}`}</dd></div>}
          {appt.item && <div className="flex justify-between"><dt className="text-muted-foreground">Service</dt><dd>{appt.item.name} · {formatPaise(appt.item.pricePaise)}</dd></div>}
          {appt.staff && <div className="flex justify-between"><dt className="text-muted-foreground">{term("role.service_provider", "Staff")}</dt><dd>{appt.staff.name}</dd></div>}
          {appt.notes && <p className="rounded-2xl bg-muted p-3">{appt.notes}</p>}
        </dl>
        <DialogFooter className="flex-wrap gap-2">
          {appt.invoiceId ? (
            <Link href={`/app/m/billing/${appt.invoiceId}`} className={buttonVariants({ variant: "outline" })}><FileText /> View invoice</Link>
          ) : (
            appt.kind === "appointment" && appt.contactId && appt.itemId && appt.status !== "cancelled" && can("billing.invoice.create") && (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const inv = await api.post<{ id: string }>(`/appointments/${appt.id}/invoice`)
                    router.push(`/app/m/billing/${inv.id}`)
                  } catch (e) {
                    toast.error(errorMessage(e))
                    setBusy(false)
                  }
                }}
              >
                <FileText /> Complete & invoice
              </Button>
            )
          )}
          {can("bookings.appointment.edit") && !["completed", "cancelled"].includes(appt.status) && (
            <>
              {appt.status === "scheduled" && <Button variant="outline" disabled={busy} onClick={() => setStatus("confirmed")}>Confirm</Button>}
              <Button variant="outline" disabled={busy} onClick={() => setStatus("completed")}>Completed</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setStatus("no_show")}>No-show</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setStatus("cancelled")}>Cancel</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CalendarPage() {
  const { can, term } = useAuth()
  const staff = useDirectory()
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()))
  const [staffId, setStaffId] = React.useState("")
  const [creating, setCreating] = React.useState<Date | null>(null)
  const [open, setOpen] = React.useState<Appointment | null>(null)
  const from = weekStart.toISOString()
  const to = new Date(weekStart.getTime() + 7 * DAY).toISOString()
  const { data, reload, loading } = useApi<{ data: Appointment[] }>(`/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${staffId ? `&staffId=${staffId}` : ""}`)
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY))
  const todayKey = new Date().toDateString()
  const canCreate = can("bookings.appointment.create") || can("bookings.event.create")

  const nextSlot = (d: Date) => {
    const now = new Date()
    const base = d.toDateString() === todayKey ? now : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10)
    const m = base.getMinutes()
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours() + (m > 30 ? 1 : 0), m > 0 && m <= 30 ? 30 : 0)
  }

  return (
    <>
      <PageHeader
        title={`Calendar & ${term("entity.appointment.plural", "Appointments").toLowerCase()}`}
        description="Team calendar with bookings, meetings and events."
        actions={canCreate && <Button onClick={() => setCreating(nextSlot(new Date()))}><Plus /> New booking</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY))} aria-label="Previous week"><ChevronLeft /></Button>
        <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY))} aria-label="Next week"><ChevronRight /></Button>
        <span className="ml-2 text-sm font-medium">
          {days[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {days[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        {loading && <Spinner className="ml-2" />}
        <NativeSelect className="ml-auto w-52" value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Filter by staff">
          <option value="">Everyone</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((d) => {
          const items = (data?.data ?? []).filter((a) => new Date(a.startAt).toDateString() === d.toDateString())
          const isToday = d.toDateString() === todayKey
          return (
            <Card key={d.toISOString()} className={cn("min-h-40", isToday && "ring-2 ring-primary")}>
              <CardContent className="grid content-start gap-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</span>
                  {canCreate && <button className="text-muted-foreground hover:text-foreground" onClick={() => setCreating(nextSlot(d))} aria-label={`Add on ${d.toDateString()}`}><Plus className="size-4" /></button>}
                </div>
                {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {items.map((a) => (
                  <button key={a.id} onClick={() => setOpen(a)} className={cn("rounded-2xl border p-2 text-left text-xs transition-colors hover:bg-muted", a.kind === "event" && "border-dashed", ["cancelled", "no_show"].includes(a.status) && "opacity-50 line-through")}>
                    <span className="block font-medium tabular-nums">{time(a.startAt)}</span>
                    <span className="block truncate">{a.title}</span>
                    {a.staff && <span className="block truncate text-muted-foreground">{a.staff.name}</span>}
                  </button>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {creating && <BookingDialog defaultStart={creating} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); void reload() }} />}
      {open && <AppointmentDialog appt={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); void reload() }} />}
    </>
  )
}
