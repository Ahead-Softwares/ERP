"use client"

import * as React from "react"
import Link from "next/link"
import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { email as emailRule, gstin as gstinRule, phone as phoneRule, storedPhone } from "@contracts/validation"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChoiceChip } from "@/components/onboarding"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { downloadCsv, parseCsv, rowsToContacts } from "@/lib/csv"
import { cn } from "@/lib/utils"
import { StepFooter, StepHeader, useStepSave, type StepProps } from "./wizard"

// Wireframe 2.4: import customers from a CSV with a preview and row-level errors,
// or start fresh. (Sample data and Excel files come later.)

const MAX_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 1000

interface Row {
  data: Record<string, string>
  row: number
  problem?: string
  duplicate?: boolean
}
interface ImportResult {
  created: number
  duplicates: { row: number; name: string; reason: string }[]
  errors: { row: number; message: string }[]
}

function checkRows(records: Record<string, string>[]): Row[] {
  const phones = new Map<string, number>()
  const emails = new Map<string, number>()
  return records.map((r, i) => {
    const row: Row = { data: r, row: i + 2 }
    const problem = !r.name?.trim() ? "Name is missing" : (r.phone && phoneRule(r.phone)) || (r.email && emailRule(r.email)) || (r.gstin && gstinRule(r.gstin)) || undefined
    if (problem) row.problem = problem
    const p = r.phone && !phoneRule(r.phone) ? storedPhone(r.phone) : null
    const e = r.email?.trim().toLowerCase()
    if ((p && phones.has(p)) || (e && emails.has(e))) row.duplicate = true
    if (p) phones.set(p, row.row)
    if (e) emails.set(e, row.row)
    return row
  })
}

export function DataStep({ complete, back }: StepProps) {
  const { term, can } = useAuth()
  const plural = term("entity.contact.plural", "Customers")
  const [mode, setMode] = React.useState<"import" | "fresh">("import")
  const [file, setFile] = React.useState<{ name: string; rows: Row[]; unknown: string[] } | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const { saving, error, run } = useStepSave()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const canImport = can("crm.contact.create")

  const valid = file?.rows.filter((r) => !r.problem && !r.duplicate) ?? []
  const bad = file?.rows.filter((r) => r.problem) ?? []
  const dups = file?.rows.filter((r) => !r.problem && r.duplicate) ?? []

  const pick = async (f: File | undefined) => {
    setFileError(null)
    setResult(null)
    if (!f) return
    if (!/\.csv$/i.test(f.name)) return setFileError("Use a .csv file. In Excel: File › Save as › CSV.")
    if (f.size > MAX_BYTES) return setFileError("This file is larger than 5 MB. Split it into smaller files.")
    const { records, unknownColumns } = rowsToContacts(parseCsv(await f.text()))
    if (!records.length) return setFileError("No rows found. The first row must be the column names (Name, Phone, Email…).")
    if (records.length > MAX_ROWS) return setFileError(`This file has ${records.length.toLocaleString("en-IN")} rows; import up to ${MAX_ROWS.toLocaleString("en-IN")} at a time.`)
    setFile({ name: f.name, rows: checkRows(records), unknown: unknownColumns })
  }

  const doImport = () =>
    run(async () => {
      const rows = valid.map((r) => r.data)
      const r = await api.post<ImportResult>("/contacts/import", { type: "customer", rows })
      setResult(r)
    })

  const downloadErrors = () =>
    downloadCsv("import-errors.csv", [["Row", "Name", "Phone", "Email", "GSTIN", "Problem"], ...[...bad, ...dups].map((r) => [r.row, r.data.name ?? "", r.data.phone ?? "", r.data.email ?? "", r.data.gstin ?? "", r.problem ?? "Same phone or email as an earlier row"])])

  return (
    <form
      className="flex min-h-full flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => complete(result?.created || mode === "fresh" ? "done" : "skipped"))
      }}
    >
      <StepHeader title="Bring your data" description={`Start with the ${plural.toLowerCase()} you already have, or add them as you go.`} />
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How to start">
        <ChoiceChip selected={mode === "import"} onClick={() => setMode("import")} className="grid gap-0.5 py-3">
          <span>Import a file</span>
          <span className="text-xs font-normal text-muted-foreground">{plural} from a CSV file</span>
        </ChoiceChip>
        <ChoiceChip selected={mode === "fresh"} onClick={() => setMode("fresh")} className="grid gap-0.5 py-3">
          <span>Start fresh</span>
          <span className="text-xs font-normal text-muted-foreground">Add records as you go</span>
        </ChoiceChip>
      </div>

      {mode === "import" && !canImport && <p className="text-sm text-muted-foreground">Your role can&apos;t import {plural.toLowerCase()}.</p>}
      {mode === "import" && canImport && (
        <div className="grid gap-4 rounded-3xl border p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload /> {file ? "Choose another file" : "Choose CSV file"}
            </Button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label="CSV file" />
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => downloadCsv("customers-template.csv", [["Name", "Phone", "Email", "Company", "GSTIN", "City", "Notes"], ["Meera Kulkarni", "9820111223", "meera@example.com", "", "", "Mumbai", "Prefers WhatsApp"]])}
            >
              <Download className="size-4" /> Download template
            </button>
            <span className="text-xs text-muted-foreground">CSV up to 5 MB and {MAX_ROWS.toLocaleString("en-IN")} rows</span>
          </div>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}

          {file && !result && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1 font-medium">
                  <FileSpreadsheet className="size-4" /> {file.name} · {file.rows.length} rows
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">{valid.length} ready</span>
                {bad.length > 0 && <span className="text-destructive">{bad.length} with errors</span>}
                {dups.length > 0 && <span className="text-amber-700 dark:text-amber-400">{dups.length} repeated in the file</span>}
              </div>
              {file.unknown.length > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {file.unknown.join(", ")}</p>}
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {file.rows.slice(0, 10).map((r) => (
                      <TableRow key={r.row} className={cn(r.problem && "bg-destructive/5", !r.problem && r.duplicate && "bg-amber-50 dark:bg-amber-950/40")}>
                        <TableCell className="tabular-nums">{r.row}</TableCell>
                        <TableCell>{r.data.name || "—"}</TableCell>
                        <TableCell>{r.data.phone || "—"}</TableCell>
                        <TableCell>{r.data.email || "—"}</TableCell>
                        <TableCell className={cn("text-xs", r.problem ? "text-destructive" : r.duplicate ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                          {r.problem ?? (r.duplicate ? "Repeated — skipped" : "Ready")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {file.rows.length > 10 && <p className="text-xs text-muted-foreground">Showing the first 10 rows.</p>}
              <div className="flex flex-wrap items-center gap-3">
                {(bad.length > 0 || dups.length > 0) && (
                  <Button type="button" variant="ghost" onClick={downloadErrors}>
                    <Download /> Download {bad.length + dups.length} rows to fix
                  </Button>
                )}
                <Button type="button" className="ml-auto" onClick={() => void doImport()} disabled={!valid.length || saving}>
                  {saving ? "Importing…" : `Import ${valid.length} ${plural.toLowerCase()}`}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">People already in AHEAD with the same phone or email are skipped. Your plan&apos;s contact limit is checked before importing.</p>
            </>
          )}

          {result && (
            <div role="status" className="grid gap-1 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
              <p className="font-medium">
                Imported {result.created} {plural.toLowerCase()}.
              </p>
              {result.duplicates.length > 0 && <p>{result.duplicates.length} skipped — already in AHEAD.</p>}
              {result.errors.length > 0 && <p>{result.errors.length} rows had problems and were not imported.</p>}
              <Link href="/app/m/crm" target="_blank" className="font-medium underline underline-offset-2">
                Open {plural}
              </Link>
            </div>
          )}
        </div>
      )}
      <StepFooter back={back} onSkip={() => void complete("skipped")} saving={saving} error={error} saveLabel="Continue" />
    </form>
  )
}
