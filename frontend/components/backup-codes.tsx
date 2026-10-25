"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** The 10 one-time backup codes with Download, Print and Copy (A3 step 4). */
export function BackupCodes({ codes, account }: { codes: string[]; account?: string }) {
  const text = `AHEAD backup codes${account ? ` for ${account}` : ""}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "ahead-backup-codes.txt"
    a.click()
    URL.revokeObjectURL(url)
  }
  const print = () => {
    const w = window.open("", "_blank", "width=420,height=520")
    if (!w) return toast.error("Allow pop-ups to print the codes.")
    w.document.title = "AHEAD backup codes"
    const pre = w.document.createElement("pre")
    pre.style.font = "16px/1.8 monospace"
    pre.textContent = text
    w.document.body.appendChild(pre)
    w.print()
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      toast.success("Codes copied")
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them instead.")
    }
  }
  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-1.5">
        {codes.map((c) => (
          <span key={c} className="rounded-md bg-muted px-1.5 py-1 text-center font-mono text-[13px] select-all">
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={download}>
          Download
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={print}>
          Print
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          Copy
        </Button>
      </div>
    </div>
  )
}
