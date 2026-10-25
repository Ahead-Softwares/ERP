// Types and client-side GST preview for quotations and invoices.
// The server recomputes every total; this only mirrors it for the live preview.

export interface DocLine {
  id?: string
  itemId: string | null
  description: string
  hsnSac: string | null
  unit: string
  quantity: number | string
  unitPricePaise: number
  discountPaise: number
  taxablePaise?: number
  gstRateBp: number
  cgstPaise?: number
  sgstPaise?: number
  igstPaise?: number
  totalPaise?: number
}

export interface Buyer {
  name: string
  gstin?: string | null
  phone?: string | null
  email?: string | null
  stateCode?: string | null
  address?: Record<string, string> | null
}

export interface Seller {
  name: string
  legalName?: string | null
  gstin?: string | null
  stateCode?: string | null
  address?: Record<string, string> | null
  logoUrl?: string | null
  phone?: string | null
  email?: string | null
  /** Frozen at issue from Settings › Payments */
  bank?: { holder: string; account: string; ifsc: string } | null
  upiId?: string | null
  showUpiQr?: boolean
  /** Frozen at issue from Settings › Documents › Print */
  showHsnSummary?: boolean
  showSignatory?: boolean
  paper?: "a4" | "80mm" | "58mm"
}

export interface SalesDoc {
  id: string
  kind: "invoice" | "quotation"
  status: string
  number: string | null
  contactId: string | null
  buyer: Buyer
  seller: Seller | null
  placeOfSupply: string | null
  issueDate: string
  dueDate: string | null
  subtotalPaise: number
  discountPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalPaise: number
  paidPaise: number
  notes: string | null
  terms: string | null
  shareToken: string | null
  sourceType: string | null
  sourceId: string | null
  cancelReason: string | null
  lines: DocLine[]
  payments?: { id: string; number: string; amountPaise: number; method: string; reference: string | null; paidOn: string }[]
  version: number
}

const divRound = (n: number, d: number) => Math.floor((n * 2 + d) / (2 * d))

export function previewTotals(lines: DocLine[], intraState: boolean) {
  let taxable = 0
  let cgst = 0
  let igst = 0
  let discount = 0
  for (const l of lines) {
    const qtyMilli = Math.round(Number(l.quantity || 0) * 1000)
    const gross = divRound(l.unitPricePaise * qtyMilli, 1000)
    const t = Math.max(0, gross - (l.discountPaise || 0))
    discount += l.discountPaise || 0
    taxable += t
    if (intraState) cgst += divRound(t * l.gstRateBp, 20000)
    else igst += divRound(t * l.gstRateBp, 10000)
  }
  return { subtotal: taxable + discount, discount, taxable, cgst, sgst: cgst, igst, total: taxable + cgst * 2 + igst }
}

export const docPath = (kind: "invoice" | "quotation") => (kind === "invoice" ? "billing" : "sales")
export const docApi = (kind: "invoice" | "quotation") => (kind === "invoice" ? "/invoices" : "/quotations")
export const docLabel = (kind: "invoice" | "quotation") => (kind === "invoice" ? "Invoice" : "Quotation")
