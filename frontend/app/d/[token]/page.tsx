"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SalesDocView, type ViewDoc } from "@/components/sales-doc-view"
import { api } from "@/lib/api"

// Public share link for an issued invoice or a sent quotation (BIL-01 "share link").
export default function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params)
  const [doc, setDoc] = React.useState<ViewDoc | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    api.get<ViewDoc>(`/public/documents/${token}`).then(setDoc).catch((e) => setError(e.message))
  }, [token])

  if (error) return <div className="grid min-h-svh place-items-center bg-neutral-100 p-6 text-sm text-neutral-700">This link is no longer available.</div>
  if (!doc) return <div className="grid min-h-svh place-items-center bg-neutral-100 p-6 text-sm text-neutral-500">Loading…</div>

  return (
    <div className="min-h-svh bg-neutral-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer /> Download PDF</Button>
      </div>
      <div className="mx-auto max-w-[210mm] overflow-hidden rounded-3xl shadow-sm print:rounded-none print:shadow-none">
        <SalesDocView doc={doc} />
      </div>
    </div>
  )
}
