// Indian number, currency and date formats (NFR-17)

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

/** Money is stored as integer paise */
export const formatPaise = (paise: number, whole = false) => (whole ? inrWhole : inr).format(paise / 100)

export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(n)

// The signed-in person's date format (My account › Profile & preferences)
let dateFormat: "d_mmm_yyyy" | "dd_mm_yyyy" | "yyyy_mm_dd" = "d_mmm_yyyy"
export const setDateFormat = (f: typeof dateFormat) => {
  dateFormat = f
}

export const formatDate = (iso: string | Date) => {
  const d = new Date(iso)
  if (dateFormat === "d_mmm_yyyy") return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(d).map((x) => [x.type, x.value]))
  return dateFormat === "dd_mm_yyyy" ? `${p.day}/${p.month}/${p.year}` : `${p.year}-${p.month}-${p.day}`
}

export const formatDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")

/** GST state codes (one list, shared with the API) */
export { GST_STATES } from "@contracts/validation"
