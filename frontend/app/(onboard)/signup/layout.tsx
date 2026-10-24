import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Start your free trial",
  description:
    "Create your AHEAD ERP workspace in minutes. 15-day free trial of every module, no card needed, free plan after the trial.",
  alternates: { canonical: "/signup" },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
