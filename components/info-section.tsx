import { Lock, Cpu, KeyRound, DownloadCloud } from "lucide-react"

const items = [
  {
    icon: Lock,
    title: "Private by design",
    body: "All key generation runs locally in Web Workers. Nothing is ever sent over the network.",
  },
  {
    icon: Cpu,
    title: "Multi-threaded",
    body: "Harness multiple CPU cores to grind through candidate keys faster.",
  },
  {
    icon: KeyRound,
    title: "Legacy · SegWit · Taproot",
    body: "Pick an address type, set a prefix or suffix, and generate matching addresses + WIFs.",
  },
  {
    icon: DownloadCloud,
    title: "Installable · Offline",
    body: "Add this app to your home screen and keep generating even without an internet connection.",
  },
]

export function InfoSection() {
  return (
    <section aria-labelledby="info-heading" className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <h1
          id="info-heading"
          className="text-xl font-semibold tracking-tight text-[color:var(--primary)] sm:text-2xl"
        >
          Vanity Address Generator
        </h1>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-[color:var(--muted-foreground)]">
        Create a custom Bitcoin address that starts or ends with your chosen pattern. Everything runs in your browser so
        your private keys never leave this device and PWA works offline too.
      </p>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card)] p-3"
          >
            <span
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)]/10 ring-1 ring-[color:var(--primary)]/25"
              aria-hidden="true"
            >
              <Icon className="h-4 w-4 text-[color:var(--primary)]" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[color:var(--muted-foreground)]">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
