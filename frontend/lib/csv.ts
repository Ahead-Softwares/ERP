// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF) for imports in the browser.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name", "customer name": "name", "full name": "name", "contact name": "name",
  phone: "phone", mobile: "phone", "phone number": "phone", "mobile number": "phone", contact: "phone",
  email: "email", "email address": "email", "e-mail": "email",
  company: "companyName", "company name": "companyName", business: "companyName",
  gstin: "gstin", gst: "gstin", "gst number": "gstin",
  city: "city", notes: "notes", note: "notes", remarks: "notes",
}

/** Map spreadsheet rows to import objects using flexible header names. */
export function rowsToContacts(rows: string[][]) {
  const [header, ...body] = rows
  if (!header) return { records: [], unknownColumns: [] as string[] }
  const keys = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null)
  const records = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]?.trim()]).filter(([k, v]) => k && v)) as Record<string, string>)
  return { records, unknownColumns: header.filter((_, i) => !keys[i]) }
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
