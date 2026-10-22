"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Trash2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app-shell"
import { ConfirmDialog, EmptyState, LoadMore, MoneyInput, SearchInput, Spinner } from "@/components/common"
import { Field, FormError, NativeSelect } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { useDebounced, useList } from "@/lib/use-list"
import { formatDate, formatPaise } from "@/lib/format"
import { PAYMENT_METHODS } from "@/lib/money"

interface Expense {
  id: string
  category: string
  amountPaise: number
  paidOn: string
  method: string
  payee: string | null
  notes: string | null
  receiptUrl: string | null
  version: number
}

const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)

function ExpenseDialog({ expense, categories, onClose, onSaved }: { expense?: Expense; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    category: expense?.category ?? "",
    amountPaise: expense?.amountPaise ?? (null as number | null),
    paidOn: expense?.paidOn.slice(0, 10) ?? todayIST(),
    method: expense?.method ?? "cash",
    payee: expense?.payee ?? "",
    notes: expense?.notes ?? "",
    receiptUrl: expense?.receiptUrl ?? "",
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amountPaise) return setErrors({ amountPaise: "Enter an amount" })
    setBusy(true)
    setError(null)
    const body = { ...form, payee: form.payee || null, notes: form.notes || null, receiptUrl: form.receiptUrl || null }
    try {
      if (expense) await api.patch(`/expenses/${expense.id}`, { ...body, version: expense.version })
      else await api.post("/expenses", body)
      toast.success(expense ? "Saved" : "Expense added")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Expenses feed your dashboard and, with the paid Finance module, your ledgers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={errors.amountPaise}><MoneyInput value={form.amountPaise} onChange={(v) => set("amountPaise", v)} autoFocus /></Field>
            <Field label="Date" error={errors.paidOn}><Input type="date" value={form.paidOn} max={todayIST()} onChange={(e) => set("paidOn", e.target.value)} /></Field>
            <Field label="Category" error={errors.category}>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} list="expense-categories" required />
            </Field>
            <Field label="Paid by">
              <NativeSelect value={form.method} onChange={(e) => set("method", e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Paid to"><Input value={form.payee} onChange={(e) => set("payee", e.target.value)} /></Field>
            <Field label="Receipt link" error={errors.receiptUrl} hint="Photo upload arrives with file storage"><Input type="url" value={form.receiptUrl} onChange={(e) => set("receiptUrl", e.target.value)} placeholder="https://" /></Field>
          </div>
          <datalist id="expense-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <FormError message={error} />
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : expense ? "Save" : "Add expense"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ExpensesPage() {
  const { can } = useAuth()
  const monthStart = `${todayIST().slice(0, 8)}01`
  const [from, setFrom] = React.useState(monthStart)
  const [to, setTo] = React.useState(todayIST())
  const [category, setCategory] = React.useState("")
  const [search, setSearch] = React.useState("")
  const q = useDebounced(search)
  const list = useList<Expense>("/expenses", { from, to, category, q })
  const categories = useApi<{ data: string[] }>("/expense-categories").data?.data ?? []
  const [editing, setEditing] = React.useState<Expense | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<Expense | null>(null)

  return (
    <>
      <PageHeader title="Expenses" description="Record what you spend. Ledgers, P&L and GST reports come with the Finance module." actions={can("finance.expense.create") && <Button onClick={() => setEditing("new")}><Plus /> Add expense</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></Field>
        <Field label="Category">
          <NativeSelect className="w-48" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </Field>
        <SearchInput value={search} onChange={setSearch} placeholder="Search payee or notes" className="w-full sm:w-56" />
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Total for period</p>
          <p className="text-xl font-semibold tabular-nums">{formatPaise(Number(list.extra.totalPaise ?? 0))}</p>
        </div>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.loading ? (
            <div className="grid place-items-center py-14"><Spinner /></div>
          ) : list.rows.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses in this period" description="Add rent, supplies, salaries and other spending to see your real profit." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Paid to</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((e) => (
                  <TableRow key={e.id} className={can("finance.expense.edit") ? "cursor-pointer" : ""} onClick={() => can("finance.expense.edit") && setEditing(e)}>
                    <TableCell className="pl-6 text-muted-foreground">{formatDate(e.paidOn)}</TableCell>
                    <TableCell className="font-medium">{e.category}{e.notes && <div className="text-xs font-normal text-muted-foreground">{e.notes}</div>}</TableCell>
                    <TableCell className="hidden sm:table-cell">{e.payee ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{PAYMENT_METHODS.find((m) => m.value === e.method)?.label}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatPaise(e.amountPaise)}</TableCell>
                    <TableCell className="pr-6">
                      {can("finance.expense.delete") && (
                        <Button variant="ghost" size="icon-sm" aria-label="Delete expense" onClick={(ev) => { ev.stopPropagation(); setDeleting(e) }}><Trash2 /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </CardContent>
      </Card>
      {editing && <ExpenseDialog expense={editing === "new" ? undefined : editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void list.reload() }} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete this expense?"
        description={deleting ? `${deleting.category} · ${formatPaise(deleting.amountPaise)}` : undefined}
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await api.delete(`/expenses/${deleting!.id}`)
            toast.success("Deleted")
            await list.reload()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </>
  )
}
