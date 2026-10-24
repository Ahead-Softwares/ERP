"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/lib/use-api"
import { formatDate, formatPaise, GST_STATES } from "@/lib/format"
import { amountInWords } from "@/lib/money"
import type { PlatformInvoice } from "@/lib/console"

const stateName = (code: string) => GST_STATES.find(([c]) => c === code)?.[1] ?? code

export default function PlatformInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const { data: inv, error } = useApi<PlatformInvoice>(`/console/invoices/${id}`)

  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!inv) return <Skeleton className="h-[40rem] rounded-4xl" />
  const intra = inv.igstPaise === 0
  const rate = inv.seller.gstRateBp / 100

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/console/payments/${inv.orderId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Order
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Print / PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl rounded-4xl border bg-background p-8 text-sm print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-lg font-semibold">{inv.seller.legalName}</p>
            {inv.seller.address && <p className="text-muted-foreground">{inv.seller.address}</p>}
            {inv.seller.gstin && <p>GSTIN {inv.seller.gstin}</p>}
            <p className="text-muted-foreground">State: {stateName(inv.seller.stateCode)} ({inv.seller.stateCode})</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tracking-tight">Tax invoice</p>
            <p className="font-mono">{inv.number}</p>
            <p className="text-muted-foreground">Date {formatDate(inv.issuedAt)}</p>
          </div>
        </header>

        <section className="grid gap-1 border-b py-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Bill to</p>
          <p className="font-medium">{inv.billTo.name}</p>
          {inv.billTo.address && <p>{inv.billTo.address}</p>}
          {inv.billTo.gstin ? <p>GSTIN {inv.billTo.gstin}</p> : <p className="text-muted-foreground">Unregistered (B2C)</p>}
          <p className="text-muted-foreground">Place of supply: {stateName(inv.billTo.stateCode)} ({inv.billTo.stateCode})</p>
        </section>

        <table className="mt-6 w-full text-left">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">SAC</th>
              <th className="py-2 text-right font-medium">Taxable</th>
              {intra ? (
                <>
                  <th className="py-2 text-right font-medium">CGST {rate / 2}%</th>
                  <th className="py-2 text-right font-medium">SGST {rate / 2}%</th>
                </>
              ) : (
                <th className="py-2 text-right font-medium">IGST {rate}%</th>
              )}
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">
                  {l.description}
                  {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  {l.discountPaise > 0 && <span className="block text-xs text-muted-foreground">after discount of {formatPaise(l.discountPaise)}</span>}
                </td>
                <td className="py-2">{l.sac}</td>
                <td className="py-2 text-right tabular-nums">{formatPaise(l.taxablePaise)}</td>
                {intra ? (
                  <>
                    <td className="py-2 text-right tabular-nums">{formatPaise(l.cgstPaise)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPaise(l.sgstPaise)}</td>
                  </>
                ) : (
                  <td className="py-2 text-right tabular-nums">{formatPaise(l.igstPaise)}</td>
                )}
                <td className="py-2 text-right tabular-nums">{formatPaise(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto grid max-w-xs gap-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Taxable value</span><span className="tabular-nums">{formatPaise(inv.taxablePaise)}</span></div>
          {intra ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="tabular-nums">{formatPaise(inv.cgstPaise)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="tabular-nums">{formatPaise(inv.sgstPaise)}</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="tabular-nums">{formatPaise(inv.igstPaise)}</span></div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatPaise(inv.totalPaise)}</span></div>
        </section>
        <p className="mt-4 text-xs text-muted-foreground">Amount in words: {amountInWords(inv.totalPaise)}</p>
        <p className="mt-8 text-xs text-muted-foreground">Paid in full. This is a computer-generated invoice.</p>
      </article>
    </>
  )
}
