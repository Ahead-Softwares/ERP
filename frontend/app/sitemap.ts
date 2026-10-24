import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/site"

// Public, indexable pages only. Add new marketing pages here as they ship.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/signup"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/login"), lastModified, changeFrequency: "yearly", priority: 0.3 },
  ]
}
