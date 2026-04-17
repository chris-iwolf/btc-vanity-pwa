import { ShieldCheck } from "lucide-react"

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-20 border-b border-[color:var(--card-border)] bg-background/85 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            role="img"
            aria-label="BTC Vanity"
            className="flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-[color:var(--primary)]/30"
            aria-hidden="true"
          >
            <rect width="512" height="512" rx="96" fill="#0d0d0d" />
            <circle cx="256" cy="256" r="188" fill="#f7931a" />
            <text x="256" y="354" textAnchor="middle" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif" fontWeight="900" fontSize="280" fill="#0d0d0d">₿</text>
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-foreground">BTC Vanity</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Generator</span>
          </div>
        </div>

        <nav aria-label="Primary">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--muted-strong)]">
            <ShieldCheck className="h-3 w-3 text-[color:var(--success)]" aria-hidden="true" />
            Local-only
          </span>
        </nav>
      </div>
    </header>
  )
}
