"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Ban, Copy, FilePlus2, FileText, IndianRupee, Pencil, Printer, Send, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { ConfirmDialog, EmptyState, LoadMore, MoneyInput, SearchInput, Spinner, StatusBadge } from "@/components/common"
import { Field, FormError, NativeSelect } from "@/components/form"
import { SalesDocEditor } from "@/components/sales-doc-editor"
import { SalesDocView } from "@/components/sales-doc-view"
import type { ContactOption } from "@/components/pickers"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { useDebounced, useList } from "@/lib/use-list"
import { formatDate, formatPaise } from "@/lib/format"
import { PAYMENT_METHODS } from "@/lib/money"
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

export function SalesDocList({ kind }: { kind: Kind }) {
  const router = useRouter()
  const { can } = useAuth()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const q = useDebounced(search)
  const list = useList<Row>(docApi(kind), { q, status: status === "unpaid" ? undefined : status, unpaid: status === "unpaid" ? "true" : undefined })
  const today = new Date().toISOString().slice(0, 10)
  const label = docLabel(kind)

  return (
    <>
      <PageHeader
        title={kind === "invoice" ? "Invoices" : "Quotations"}
        description={kind === "invoice" ? "GST tax invoices, receipts and dues. Issued invoices can't be edited." : "Estimates you can send and convert into invoices."}
        actions={can(`${perm(kind)}.create`) && <Link href={`/app/m/${docPath(kind)}/new`} className={buttonVariants()}><FilePlus2 /> New {label.toLowerCase()}</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-full bg-muted p-1 text-sm" role="tablist">
          {STATUS_FILTERS[kind].map((f) => (
            <button key={f.value} role="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)} className={`rounded-full px-3 py-1 ${status === f.value ? "bg-background font-medium shadow-sm" : ""}`}>
              {f.label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={`Search number or customer`} className="w-full sm:w-64" />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.loading ? (
            <div className="grid place-items-center py-14"><Spinner /></div>
          ) : list.rows.length === 0 ? (
            <EmptyState icon={FileText} title={`No ${label.toLowerCase()}s here`} description={kind === "invoice" ? "Create your first GST invoice in under a minute." : "Send a quotation and convert it to an invoice when accepted."} action={can(`${perm(kind)}.create`) && !search ? <Link href={`/app/m/${docPath(kind)}/new`} className={buttonVariants()}><FilePlus2 /> New {label.toLowerCase()}</Link> : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((r) => {
                  const overdue = kind === "invoice" && ["issued", "partially_paid"].includes(r.status) && r.dueDate && r.dueDate.slice(0, 10) < today
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/app/m/${docPath(kind)}/${r.id}`)}>
                      <TableCell className="pl-6 font-mono text-xs">
                        <Link href={`/app/m/${docPath(kind)}/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{r.number ?? "Draft"}</Link>
                      </TableCell>
                      <TableCell className="font-medium">{r.buyer?.name ?? "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(r.issueDate)}</TableCell>
                      <TableCell><StatusBadge status={overdue ? "overdue" : r.status} /></TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        <div className="font-medium">{formatPaise(r.totalPaise)}</div>
                        {kind === "invoice" && r.paidPaise > 0 && r.paidPaise < r.totalPaise && <div className="text-xs text-muted-foreground">{formatPaise(r.totalPaise - r.paidPaise)} due</div>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </CardContent>
      </Card>
    </>
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
