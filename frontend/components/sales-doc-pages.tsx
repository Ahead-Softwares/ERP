"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Ban, Copy, FileText, IndianRupee, Pencil, Plus, Printer, Send, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/app-shell"
import { ConfirmDialog, EmptyState, MoneyInput, Spinner, StatusBadge } from "@/components/common"
import { DataList, HeaderLink, periodFilter, type Column, type ViewPreset } from "@/components/data-list"
import { todayInIndia } from "@contracts/validation"
import { Field, FormError, NativeSelect } from "@/components/form"
import { SalesDocEditor } from "@/components/sales-doc-editor"
import { SalesDocView } from "@/components/sales-doc-view"
import type { ContactOption } from "@/components/pickers"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatPaise } from "@/lib/format"
import { PAYMENT_METHODS } from "@/lib/money"
import { cn } from "@/lib/utils"
import { docApi, docLabel, docPath, type SalesDoc } from "@/lib/sales"

type Kind = "invoice" | "quotation"
const perm = (kind: Kind) => (kind === "invoice" ? "billing.invoice" : "sales.quotation")

interface Row {
  id: string
  status: string
  number: string | null
  buyer: { name: string }
  issueDate: string
  dueDate: string | null
  totalPaise: number
  paidPaise: number
  branchId: string | null
}

const STATUS_FILTERS: Record<Kind, { value: string; label: string }[]> = {
  invoice: [
    { value: "", label: "All" },
    { value: "unpaid", label: "Unpaid" },
    { value: "draft", label: "Drafts" },
    { value: "paid", label: "Paid" },
    { value: "cancelled", label: "Cancelled" },
  ],
  quotation: [
    { value: "", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "accepted", label: "Accepted" },
    { value: "converted", label: "Converted" },
    { value: "declined", label: "Declined" },
  ],
}

const PILL: Record<string, string> = {
  red: "bg-[#FDECEA] text-[#B42318] dark:bg-red-950 dark:text-red-200",
  amber: "bg-[#FFF3D6] text-[#8A5A00] dark:bg-amber-950 dark:text-amber-200",
  gray: "bg-muted text-foreground/80",
  green: "bg-[#E6F4EC] text-[#1F7A4D] dark:bg-emerald-950 dark:text-emerald-200",
  blue: "bg-accent text-accent-foreground",
}

/** List status as drawn in the wireframe: Overdue 6d (red), Partial (amber), Unpaid (grey) … */
function listStatus(kind: Kind, r: Row, today: string): { label: string; tone: keyof typeof PILL } {
  if (kind === "invoice") {
    const open = r.status === "issued" || r.status === "partially_paid"
    if (open && r.dueDate && r.dueDate.slice(0, 10) < today) {
      const days = Math.round((Date.parse(today) - Date.parse(r.dueDate.slice(0, 10))) / 86_400_000)
      return { label: `Overdue ${days}d`, tone: "red" }
    }
    if (r.status === "partially_paid") return { label: "Partial", tone: "amber" }
    if (r.status === "issued") return { label: "Unpaid", tone: "gray" }
    if (r.status === "paid") return { label: "Paid", tone: "green" }
    if (r.status === "cancelled") return { label: "Cancelled", tone: "gray" }
    return { label: "Draft", tone: "gray" }
  }
  const tone: Record<string, keyof typeof PILL> = { draft: "gray", sent: "blue", accepted: "green", converted: "green", declined: "red" }
  return { label: r.status.charAt(0).toUpperCase() + r.status.slice(1), tone: tone[r.status] ?? "gray" }
}

export function SalesDocList({ kind }: { kind: Kind }) {
  const { can, me } = useAuth()
  const today = todayInIndia()
  const label = docLabel(kind)
  const canCreate = can(`${perm(kind)}.create`)
  const branches = useApi<{ data: { id: string; name: string }[] }>(can("tenant.branch.view") ? "/branches" : null)
  const branchName = (id: string | null | undefined) => branches.data?.data.find((b) => b.id === id)?.name ?? "—"
  const newButton = canCreate && (
    <HeaderLink href={`/app/m/${docPath(kind)}/new`} primary>
      <Plus /> New {label.toLowerCase()}
    </HeaderLink>
  )
  const status = (r: Row) => listStatus(kind, r, today)
  const due = (r: Row) => Math.max(0, r.totalPaise - r.paidPaise)

  const columns: Column<Row>[] = [
    { key: "number", header: "Number", hideable: false, cell: (r) => <span className="font-semibold">{r.number ?? "Draft"}</span>, csv: (r) => r.number ?? "Draft", sort: (r) => r.number ?? "" },
    { key: "date", header: "Date", cell: (r) => formatDate(r.issueDate), csv: (r) => r.issueDate.slice(0, 10), sort: (r) => r.issueDate },
    { key: "customer", header: "Customer", cell: (r) => r.buyer?.name ?? "—", csv: (r) => r.buyer?.name, sort: (r) => r.buyer?.name?.toLowerCase() ?? "" },
    { key: "branch", header: "Branch", defaultHidden: (branches.data?.data.length ?? 0) < 2, cell: (r) => branchName(r.branchId), csv: (r) => branchName(r.branchId) },
    { key: "amount", header: "Amount", align: "right", cell: (r) => formatPaise(r.totalPaise), csv: (r) => (r.totalPaise / 100).toFixed(2), sort: (r) => r.totalPaise },
    ...(kind === "invoice"
      ? [{ key: "due", header: "Due", align: "right" as const, cell: (r: Row) => formatPaise(due(r)), csv: (r: Row) => (due(r) / 100).toFixed(2), sort: (r: Row) => due(r) }]
      : []),
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const s = status(r)
        return <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-semibold", PILL[s.tone], r.status === "cancelled" && "line-through")}>{s.label}</span>
      },
      csv: (r) => status(r).label,
    },
  ]

  const presets: ViewPreset[] =
    kind === "invoice"
      ? [
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "overdue", label: "Overdue", params: { overdue: "true" }, countKey: "overdue" },
          { key: "unpaid", label: "Unpaid", params: { unpaid: "true" }, countKey: "unpaid" },
          { key: "draft", label: "Draft", params: { status: "draft" }, countKey: "draft" },
          { key: "paid", label: "Paid", params: { status: "paid" }, countKey: "paid" },
          { key: "cancelled", label: "Cancelled", params: { status: "cancelled" }, countKey: "cancelled" },
        ]
      : STATUS_FILTERS.quotation.map((f) => ({ key: f.value || "all", label: f.label, params: (f.value ? { status: f.value } : {}) as Record<string, string>, countKey: f.value || "all" }))

  return (
    <DataList<Row>
      id={kind === "invoice" ? "invoices" : "quotations"}
      path={docApi(kind)}
      countsPath={`${docApi(kind)}/counts`}
      header={{
        breadcrumb: kind === "invoice" ? "Billing › Invoices" : "Sales › Quotations",
        title: kind === "invoice" ? "Invoices" : "Quotations",
        primary: newButton,
      }}
      columns={columns}
      searchPlaceholder="Search number, customer, mobile, GSTIN"
      presets={presets}
      filters={[periodFilter(me?.tenant?.fyStartMonth ?? 4)]}
      rowHref={(r) => `/app/m/${docPath(kind)}/${r.id}`}
      exportName={kind === "invoice" ? "invoices" : "quotations"}
      emptyState={
        <EmptyState
          icon={FileText}
          title={`No ${label.toLowerCase()}s yet`}
          description={kind === "invoice" ? "Create a GST invoice in under a minute, or bring your old invoices in." : "Send a quotation and convert it to an invoice when accepted."}
          action={newButton}
        />
      }
    />
  )
}

function NewDoc({ kind }: { kind: Kind }) {
  const contactId = useSearchParams().get("contact")
  const contact = useApi<ContactOption>(contactId ? `/contacts/${contactId}` : null)
  if (contactId && contact.loading) return <div className="grid place-items-center py-24"><Spinner /></div>
  return (
    <>
      <Link href={`/app/m/${docPath(kind)}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {kind === "invoice" ? "Invoices" : "Quotations"}</Link>
      <PageHeader title={`New ${docLabel(kind).toLowerCase()}`} />
      <SalesDocEditor kind={kind} initialContact={contact.data} />
    </>
  )
}

export function SalesDocNew({ kind }: { kind: Kind }) {
  return (
    <React.Suspense>
      <NewDoc kind={kind} />
    </React.Suspense>
  )
}

export function SalesDocEdit({ kind, id }: { kind: Kind; id: string }) {
  const { data, error } = useApi<SalesDoc>(`${docApi(kind)}/${id}`)
  if (error) return <p className="text-sm text-muted-foreground">{error.message}</p>
  if (!data) return <div className="grid place-items-center py-24"><Spinner /></div>
  return (
    <>
      <Link href={`/app/m/${docPath(kind)}/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <PageHeader title={`Edit ${data.number ?? `draft ${docLabel(kind).toLowerCase()}`}`} />
      <SalesDocEditor kind={kind} doc={data} />
    </>
  )
}

function PaymentDialog({ doc, onClose, onSaved }: { doc: SalesDoc; onClose: () => void; onSaved: (d: SalesDoc) => void }) {
  const balance = doc.totalPaise - doc.paidPaise
  const [amount, setAmount] = React.useState<number | null>(balance)
  const [method, setMethod] = React.useState("cash")
  const [reference, setReference] = React.useState("")
  const [paidOn, setPaidOn] = React.useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10))
  const [error, setError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return setErrors({ amountPaise: "Enter an amount" })
    setBusy(true)
    setError(null)
    try {
      const d = await api.post<SalesDoc>(`/invoices/${doc.id}/payments`, { amountPaise: amount, method, reference: reference || null, paidOn })
      toast.success("Payment recorded")
      onSaved(d)
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Balance due on {doc.number}: {formatPaise(balance)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={errors.amountPaise}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
            <Field label="Date"><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
            <Field label="Method">
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Reference" hint="UPI ref, cheque no., etc."><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </div>
          <FormError message={error} />
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record payment"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SalesDocDetail({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter()
  const { can, me } = useAuth()
  const { data: doc, setData, reload, error } = useApi<SalesDoc>(`${docApi(kind)}/${id}`)
  const [paying, setPaying] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  if (error) return <p className="text-sm text-muted-foreground">{error.message}</p>
  if (!doc) return <div className="grid place-items-center py-24"><Spinner /></div>

  const p = perm(kind)
  const editable = kind === "invoice" ? doc.status === "draft" : ["draft", "sent"].includes(doc.status)
  const shareUrl = doc.shareToken ? `${window.location.origin}/d/${doc.shareToken}` : null
  const balance = doc.totalPaise - doc.paidPaise

  const act = async (fn: () => Promise<SalesDoc | void>, success: string) => {
    setBusy(true)
    try {
      const d = await fn()
      if (d) setData(d)
      else await reload()
      toast.success(success)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const whatsappText = encodeURIComponent(`${docLabel(kind)} ${doc.number} from ${me?.tenant?.name}: ${formatPaise(doc.totalPaise)}. View: ${shareUrl}`)

  return (
    <>
      <Link href={`/app/m/${docPath(kind)}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {kind === "invoice" ? "Invoices" : "Quotations"}</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {doc.number ?? `Draft ${docLabel(kind).toLowerCase()}`} <StatusBadge status={doc.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {doc.buyer.name} · {formatPaise(doc.totalPaise)}
            {kind === "invoice" && doc.paidPaise > 0 && balance > 0 && ` · ${formatPaise(balance)} due`}
            {doc.cancelReason && ` · Cancelled: ${doc.cancelReason}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && can(`${p}.edit`) && <Link href={`/app/m/${docPath(kind)}/${id}/edit`} className={buttonVariants({ variant: "outline" })}><Pencil /> Edit</Link>}
          {kind === "invoice" && doc.status === "draft" && can("billing.invoice.create") && (
            <Button disabled={busy} onClick={() => act(() => api.post<SalesDoc>(`/invoices/${id}/issue`), "Invoice issued")}><Send /> Issue invoice</Button>
          )}
          {kind === "invoice" && ["issued", "partially_paid"].includes(doc.status) && can("billing.payment.create") && (
            <Button onClick={() => setPaying(true)}><IndianRupee /> Record payment</Button>
          )}
          {kind === "quotation" && doc.status === "draft" && can("sales.quotation.edit") && (
            <Button variant="outline" disabled={busy} onClick={() => act(() => api.post<SalesDoc>(`/quotations/${id}/status`, { status: "sent" }), "Marked as sent")}><Send /> Mark sent</Button>
          )}
          {kind === "quotation" && doc.status === "sent" && can("sales.quotation.edit") && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => act(() => api.post<SalesDoc>(`/quotations/${id}/status`, { status: "accepted" }), "Marked accepted")}>Accepted</Button>
              <Button variant="ghost" disabled={busy} onClick={() => act(() => api.post<SalesDoc>(`/quotations/${id}/status`, { status: "declined" }), "Marked declined")}>Declined</Button>
            </>
          )}
          {kind === "quotation" && ["draft", "sent", "accepted"].includes(doc.status) && can("billing.invoice.create") && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const inv = await api.post<SalesDoc>(`/quotations/${id}/convert`)
                  toast.success("Draft invoice created")
                  router.push(`/app/m/billing/${inv.id}`)
                } catch (e) {
                  toast.error(errorMessage(e))
                  setBusy(false)
                }
              }}
            >
              <FileText /> Convert to invoice
            </Button>
          )}
          {doc.status !== "draft" && <a href={`/print/${kind}/${id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}><Printer /> Print / PDF</a>}
          {kind === "invoice" && ["issued", "partially_paid"].includes(doc.status) && doc.paidPaise === 0 && can("billing.invoice.approve") && (
            <Button variant="ghost" onClick={() => setCancelling(true)}><Ban /> Cancel</Button>
          )}
          {doc.status === "draft" && can(`${p}.edit`) && <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label="Delete draft"><Trash2 /></Button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-4xl border shadow-sm">
          <SalesDocView doc={doc} fallbackSeller={{ name: me?.tenant?.name ?? "", gstin: me?.tenant?.gstin, stateCode: me?.tenant?.billingStateCode }} />
        </div>
        <div className="grid content-start gap-4">
          {shareUrl && (
            <Card>
              <CardHeader><CardTitle className="text-base">Share</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} aria-label="Share link" className="text-xs" />
                  <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied"))}><Copy /></Button>
                </div>
                <a className={buttonVariants({ variant: "outline", size: "sm" })} target="_blank" rel="noreferrer" href={`https://wa.me/${(doc.buyer.phone ?? "").replace(/\D/g, "")}?text=${whatsappText}`}>Send on WhatsApp</a>
                {doc.buyer.email && <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`mailto:${doc.buyer.email}?subject=${encodeURIComponent(`${docLabel(kind)} ${doc.number}`)}&body=${whatsappText}`}>Send by email</a>}
              </CardContent>
            </Card>
          )}
          {kind === "invoice" && (doc.payments?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {doc.payments!.map((pm) => (
                    <li key={pm.id} className="flex justify-between gap-2">
                      <span>
                        <span className="font-mono text-xs">{pm.number}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(pm.paidOn)} · {PAYMENT_METHODS.find((m) => m.value === pm.method)?.label}{pm.reference ? ` · ${pm.reference}` : ""}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatPaise(pm.amountPaise)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {doc.sourceType === "quotation" && doc.sourceId && (
            <Link href={`/app/m/sales/${doc.sourceId}`} className="text-sm text-muted-foreground hover:text-foreground">Created from a quotation →</Link>
          )}
        </div>
      </div>

      {paying && <PaymentDialog doc={doc} onClose={() => setPaying(false)} onSaved={(d) => { setPaying(false); setData(d) }} />}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        destructive
        title={`Cancel ${doc.number}?`}
        description="The number stays used and the invoice is kept for your records, marked cancelled."
        reasonLabel="Reason for cancelling"
        confirmLabel="Cancel invoice"
        onConfirm={(reason) => act(() => api.post<SalesDoc>(`/invoices/${id}/cancel`, { reason }), "Invoice cancelled")}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title="Delete this draft?"
        confirmLabel="Delete"
        onConfirm={async () => {
          await api.delete(`${docApi(kind)}/${id}`)
          toast.success("Draft deleted")
          router.replace(`/app/m/${docPath(kind)}`)
        }}
      />
    </>
  )
}
