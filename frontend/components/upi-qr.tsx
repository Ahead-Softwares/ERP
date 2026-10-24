"use client"

import * as React from "react"
import QRCode from "qrcode"

/** UPI payment QR (NPCI deep link) for printed invoices and the share page. */
export function UpiQr({ upiId, payee, amountPaise, note, size = 96 }: { upiId: string; payee: string; amountPaise?: number; note?: string; size?: number }) {
  const [src, setSrc] = React.useState<string | null>(null)
  const link = `upi://pay?${new URLSearchParams({
    pa: upiId,
    pn: payee.slice(0, 50),
    cu: "INR",
    ...(amountPaise && amountPaise > 0 ? { am: (amountPaise / 100).toFixed(2) } : {}),
    ...(note ? { tn: note.slice(0, 50) } : {}),
  })}`
  React.useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(link, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [link, size])
  if (!src) return <span className="inline-block rounded bg-neutral-100" style={{ width: size, height: size }} aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`UPI QR code to pay ${payee}`} width={size} height={size} className="rounded" />
}
