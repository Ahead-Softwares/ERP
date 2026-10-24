import { ImageResponse } from "next/og"
import { SITE } from "@/lib/site"

export const alt = "AHEAD ERP — GST billing, CRM and business management software for India"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Shared by Open Graph and Twitter cards (twitter-image re-exports it)
export default function OpengraphImage() {
  const chips = ["GST billing", "CRM & leads", "Quotations", "Bookings", "Expenses", "Reports"]
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 80% 0%, #dbe8ff 0%, #fbfcfe 55%)",
          color: "#04192b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, #3b82f6 0%, #1d2bd8 100%)",
              color: "white",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            A
          </div>
          {SITE.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: -3, maxWidth: 980 }}>
            The ERP that runs your whole business.
          </div>
          <div style={{ fontSize: 30, color: "#4a6378", maxWidth: 960 }}>
            Billing, customers, bookings, staff and money — in one app, set up for your industry.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid #d5e1ee",
                background: "white",
                fontSize: 22,
                color: "#24425a",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
