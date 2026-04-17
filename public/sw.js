/* BTC Vanity Generator — Service Worker
 * Strategy:
 *   - Navigation requests: network-first, fallback to cached root on failure.
 *   - Other same-origin / cross-origin GETs: stale-while-revalidate.
 *   - The elliptic CDN script is fetched by the app and automatically cached
 *     on first success so generation keeps working fully offline afterwards.
 */
const CACHE = "btc-vanity-v1"
const CORE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          CORE.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => (res.ok ? cache.put(url, res) : null))
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isHtmlRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    )
    return
  }

  // Stale-while-revalidate for everything else (assets, JSON, CDN scripts).
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res && (res.status === 200 || res.type === "opaque")) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || fetchPromise
    }),
  )
})
