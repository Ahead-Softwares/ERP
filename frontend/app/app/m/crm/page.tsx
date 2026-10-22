"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Download, Upload, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { EmptyState, LoadMore, SearchInput, Spinner, StatusBadge } from "@/components/common"
import { NativeSelect } from "@/components/form"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { useDebounced, useList } from "@/lib/use-list"
import { downloadCsv, parseCsv, rowsToContacts } from "@/lib/csv"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ContactDialog, type Contact } from "./contact-form"

type Tab = "customers" | "leads" | "follow-ups"

interface FollowUp {
  id: string
  title: string | null
  body: string | null
  dueAt: string
  contact: { id: string; name: string; phone: string | null } | null
}

function ImportDialog({ kind, onClose, onDone }: { kind: "customer" | "lead"; onClose: () => void; onDone: () => void }) {
  const [records, setRecords] = React.useState<Record<string, string>[] | null>(null)
  const [unknown, setUnknown] = React.useState<string[]>([])
  const [result, setResult] = React.useState<{ created: number; duplicates: { row: number; name: string; reason: string }[]; errors: { row: number; message: string }[] } | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function onFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) return toast.error("Save your Excel sheet as CSV (File → Save As → CSV) and upload that.")
    const { records, unknownColumns } = rowsToContacts(parseCsv(await file.text()))
    if (!records.length) return toast.error("No rows found. The first row must be column headers.")
    if (records.length > 1000) return toast.error("Up to 1,000 rows per import. Split the file and try again.")
    setRecords(records)
    setUnknown(unknownColumns)
  }

  async function run() {
    setBusy(true)
    try {
      setResult(await api.post("/contacts/import", { type: kind, rows: records }))
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import {kind === "lead" ? "leads" : "customers"}</DialogTitle>
          <DialogDescription>Upload a CSV with a header row. Recognised columns: name, phone, email, company, gstin, city, notes. Rows whose phone or email already exists are skipped.</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="grid gap-3 text-sm">
            <p><strong>{result.created}</strong> added · <strong>{result.duplicates.length}</strong> duplicates skipped · <strong>{result.errors.length}</strong> errors</p>
            {[...result.duplicates.map((d) => `Row ${d.row} (${d.name}): ${d.reason}`), ...result.errors.map((e) => `Row ${e.row}: ${e.message}`)].length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-2xl bg-muted p-3 text-xs">
                {[...result.duplicates.map((d) => `Row ${d.row} (${d.name}): ${d.reason}`), ...result.errors.map((e) => `Row ${e.row}: ${e.message}`)].map((l) => <li key={l}>{l}</li>)}
              </ul>
            )}
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid cursor-pointer place-items-center gap-2 rounded-3xl border border-dashed p-8 text-center text-sm hover:bg-muted">
              <Upload className="size-5 text-muted-foreground" />
              {records ? <span><strong>{records.length}</strong> rows ready to import</span> : <span>Choose a .csv file</span>}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            {unknown.length > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {unknown.join(", ")}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => downloadCsv("customers-template.csv", [["name", "phone", "email", "company", "gstin", "city", "notes"], ["Asha Verma", "9812345678", "asha@example.com", "", "", "Noida", "Prefers mornings"]])}>
                <Download /> Template
              </Button>
              <Button onClick={run} disabled={!records || busy}>{busy ? "Importing…" : "Import"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FollowUps() {
  const { data, reload } = useApi<{ data: FollowUp[] }>("/follow-ups")
  const [now] = React.useState(() => Date.now())
  if (!data) return <div className="grid place-items-center py-14"><Spinner /></div>
  if (!data.data.length) return <EmptyState icon={CalendarClock} title="No pending follow-ups" description="Schedule follow-ups from a customer's timeline." />
  return (
    <ul className="divide-y">
      {data.data.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/app/m/crm/${f.contact?.id}`} className="font-medium hover:underline">{f.contact?.name}</Link>
            <p className="truncate text-sm text-muted-foreground">{f.title || f.body}</p>
          </div>
          <span className={cn("text-sm", new Date(f.dueAt).getTime() < now ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDateTime(f.dueAt)}</span>
          <Button size="sm" variant="outline" onClick={() => api.patch(`/activities/${f.id}`, { completed: true }).then(reload).then(() => toast.success("Marked done"))}>Done</Button>
        </li>
      ))}
    </ul>
  )
}

export default function CrmPage() {
  const router = useRouter()
  const { can, term } = useAuth()
  const [tab, setTab] = React.useState<Tab>(can("crm.contact.view") ? "customers" : "leads")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const q = useDebounced(search)
  const kind = tab === "leads" ? "lead" : "customer"
  const list = useList<Contact>(tab === "leads" ? "/leads" : "/contacts", tab === "follow-ups" ? { q: "__none__" } : { q, status: tab === "leads" ? status : undefined })
  const [dialog, setDialog] = React.useState<"new" | "import" | null>(null)
  const customers = term("entity.contact.plural", "Customers")
  const leads = term("entity.lead.plural", "Leads")

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "customers", label: customers, show: can("crm.contact.view") },
    { key: "leads", label: leads, show: can("crm.lead.view") },
    { key: "follow-ups", label: "Follow-ups", show: can("crm.activity.view") },
  ]

  return (
    <>
      <PageHeader
        title="CRM"
        description={`${customers}, ${leads.toLowerCase()} and every call, note and follow-up in one place.`}
        actions={
          tab !== "follow-ups" && (
            <>
              {can(`crm.${kind === "lead" ? "lead" : "contact"}.create`) && <Button variant="outline" onClick={() => setDialog("import")}><Upload /> Import</Button>}
              {can(`crm.${kind === "lead" ? "lead" : "contact"}.create`) && <Button onClick={() => setDialog("new")}><UserPlus /> Add {kind === "lead" ? term("entity.lead.singular", "lead").toLowerCase() : term("entity.contact.singular", "customer").toLowerCase()}</Button>}
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm" role="tablist">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("rounded-full px-3 py-1", tab === t.key && "bg-background font-medium shadow-sm")}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== "follow-ups" && <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, email" className="w-full sm:w-72" />}
        {tab === "leads" && (
          <NativeSelect className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lead status">
            <option value="">Open leads</option>
            {["new", "contacted", "qualified", "lost", "converted"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </NativeSelect>
        )}
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {tab === "follow-ups" ? (
            <FollowUps />
          ) : list.loading ? (
            <div className="grid place-items-center py-14"><Spinner /></div>
          ) : list.rows.length === 0 ? (
            <EmptyState icon={Users} title={search ? "No matches" : `No ${(kind === "lead" ? leads : customers).toLowerCase()} yet`} description="Add one, or import your existing list from a spreadsheet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  {kind === "lead" ? <TableHead>Status</TableHead> : <TableHead className="hidden md:table-cell">GSTIN</TableHead>}
                  <TableHead className="hidden pr-6 sm:table-cell">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/app/m/crm/${c.id}`)}>
                    <TableCell className="pl-6">
                      <Link href={`/app/m/crm/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                      {c.companyName && <div className="text-xs text-muted-foreground">{c.companyName}</div>}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.phone ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell>
                    {kind === "lead" ? <TableCell>{c.leadStatus && <StatusBadge status={c.leadStatus} />}</TableCell> : <TableCell className="hidden font-mono text-xs md:table-cell">{c.gstin ?? "—"}</TableCell>}
                    <TableCell className="hidden pr-6 text-sm text-muted-foreground sm:table-cell">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab !== "follow-ups" && <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />}
        </CardContent>
      </Card>
      {dialog === "new" && <ContactDialog kind={kind} onClose={() => setDialog(null)} onSaved={(c) => router.push(`/app/m/crm/${c.id}`)} />}
      {dialog === "import" && <ImportDialog kind={kind} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
    </>
  )
}
