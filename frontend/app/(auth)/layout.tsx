import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="px-4 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">A</span>
          AHEAD ERP
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
