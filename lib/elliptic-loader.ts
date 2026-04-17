// Loads elliptic.min.js once and caches the source so it can be inlined into
// the vanity-generator Web Worker. This is what enables fully offline (PWA)
// operation after the first visit — the Service Worker caches the response.
const ELLIPTIC_URL = "https://cdnjs.cloudflare.com/ajax/libs/elliptic/6.5.4/elliptic.min.js"

let cache: string | null = null
let pending: Promise<string> | null = null

export function getEllipticSource(): Promise<string> {
  if (cache) return Promise.resolve(cache)
  if (pending) return pending
  pending = fetch(ELLIPTIC_URL)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load crypto library (" + res.status + ")")
      return res.text()
    })
    .then((text) => {
      cache = text
      pending = null
      return text
    })
    .catch((err) => {
      pending = null
      throw err
    })
  return pending
}

// Kick off the fetch early so the first Start click is snappy.
export function prefetchElliptic(): void {
  if (typeof window === "undefined") return
  getEllipticSource().catch(() => {
    /* ignore — will be retried (and surfaced) when Start is pressed */
  })
}
