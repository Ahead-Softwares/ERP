// Money helpers: the API speaks integer paise; people type rupees.

/** "1,234.5" → 123450 (null when empty or invalid) */
export function rupeesToPaise(input: string): number | null {
  const clean = input.replace(/[,\s₹]/g, "")
  if (!clean) return null
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [whole, frac = ""] = clean.split(".")
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"))
}

export const paiseToRupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? "" : (paise / 100).toFixed(2).replace(/\.00$/, "")

export const GST_RATES = [
  { bp: 0, label: "0%" },
  { bp: 25, label: "0.25%" },
  { bp: 300, label: "3%" },
  { bp: 500, label: "5%" },
  { bp: 1200, label: "12%" },
  { bp: 1800, label: "18%" },
  { bp: 2800, label: "28%" },
]

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
]

/** Amount in words (Indian system) for invoices, e.g. "One Thousand Five Hundred Rupees Only" */
export function amountInWords(paise: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`)
  const three = (n: number) => `${n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " : ""}` : ""}${n % 100 ? two(n % 100) : ""}`
  const words = (n: number): string => {
    if (n === 0) return "Zero"
    const parts: string[] = []
    const crore = Math.floor(n / 1e7)
    const lakh = Math.floor((n % 1e7) / 1e5)
    const thousand = Math.floor((n % 1e5) / 1e3)
    const rest = n % 1e3
    if (crore) parts.push(`${words(crore)} Crore`)
    if (lakh) parts.push(`${two(lakh)} Lakh`)
    if (thousand) parts.push(`${two(thousand)} Thousand`)
    if (rest) parts.push(three(rest))
    return parts.join(" ")
  }
  const rupees = Math.floor(paise / 100)
  const p = paise % 100
  return `${words(rupees)} Rupees${p ? ` and ${two(p)} Paise` : ""} Only`
}
