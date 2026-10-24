import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #3b82f6 0%, #1d2bd8 100%)",
          color: "white",
          fontSize: 112,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    size
  )
}
