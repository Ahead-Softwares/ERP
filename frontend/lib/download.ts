import { ApiError, authHeader, refreshAccessToken } from "@/lib/api"

/** Download a file the API streams (CSV, Excel, ZIP), named from Content-Disposition. */
export async function downloadApiFile(path: string, fallbackName: string) {
  const get = () => fetch(`/api/v1${path}`, { credentials: "include", headers: authHeader() })
  let res = await get()
  if (res.status === 401 && (await refreshAccessToken())) res = await get()
  if (!res.ok) {
    let message = "Couldn't prepare the file. Please try again."
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } }
      if (body.error?.message) message = body.error.message
      throw new ApiError(res.status, body.error?.code ?? "INTERNAL", message)
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(res.status, "INTERNAL", message)
    }
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}
