import type { NextConfig } from "next"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:5000"

// Signed-in areas and one-off links must never show up in search results
const NOINDEX = ["/app", "/app/:path*", "/console", "/console/:path*", "/d/:path*", "/pay/:path*", "/print/:path*", "/invite/:path*", "/verify-email", "/forgot-password"]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Same-origin API: the refresh-token cookie stays first-party and no CORS is needed
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${BACKEND_URL}/api/v1/:path*` }]
  },
  async headers() {
    return NOINDEX.map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }))
  },
}

export default nextConfig
