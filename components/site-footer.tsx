"use client"

import { useState, useRef } from "react"
import { Coffee, Heart, Star, Download, Copy, Check, Send } from "lucide-react"
import QRCode from "react-qr-code"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const DONATE_ADDRESS = "bc1pyd4l4l964dxz80d5ql4hy55m6xfs7v30n5ctj3h4m5qsauuk5hsqvhappy"

export function SiteFooter() {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(DONATE_ADDRESS)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const downloadQR = () => {
    if (!qrRef.current) return
    const svg = qrRef.current.querySelector("svg")
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      if (ctx) {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        const a = document.createElement("a")
        a.download = "donate-qr.png"
        a.href = canvas.toDataURL("image/png")
        a.click()
      }
    }
    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  const DonateButton = ({ label, Icon }: { label: string; Icon: any }) => (
    <DialogTrigger asChild>
      <button
        type="button"
        className="touch-target flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-inset)] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--muted-strong)] transition-colors active:scale-[0.98] hover:border-[color:var(--border-strong)] hover:text-foreground"
      >
        <Icon className="h-4 w-4 text-[color:var(--primary)]" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    </DialogTrigger>
  )

  return (
    <footer className="mt-8 border-t border-[color:var(--card-border)] bg-[color:var(--card)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <Dialog>
          <nav aria-label="Support and project links">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <li>
                <DonateButton label="Tip Me" Icon={Coffee} />
              </li>
              <li>
                <DonateButton label="Donate" Icon={Heart} />
              </li>
              <li>
                <a
                  href="https://github.com/chris-iwolf/btc-vanity-pwa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-inset)] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--muted-strong)] transition-colors active:scale-[0.98] hover:border-[color:var(--border-strong)] hover:text-foreground"
                >
                  <Star className="h-4 w-4 text-[color:var(--primary)]" aria-hidden="true" />
                  <span className="truncate">Star Me (GitHub)</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/chris-iwolf/btc-vanity-pwa/archive/refs/heads/main.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-inset)] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--muted-strong)] transition-colors active:scale-[0.98] hover:border-[color:var(--border-strong)] hover:text-foreground"
                >
                  <Download className="h-4 w-4 text-[color:var(--primary)]" aria-hidden="true" />
                  <span className="truncate">Download (GitHub)</span>
                </a>
              </li>
            </ul>
          </nav>

          <DialogContent className="sm:max-w-md border border-[color:var(--card-border)] bg-[color:var(--card)] rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-foreground">Support the Project</DialogTitle>
              <DialogDescription className="text-[color:var(--muted)] text-xs sm:text-sm">
                Send Bitcoin (BTC) to the address below to tip or donate!
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex w-full min-w-0 flex-col items-center justify-center gap-4 sm:mt-4 sm:gap-6">
              <div
                ref={qrRef}
                className="flex w-full max-w-[180px] flex-shrink-0 justify-center rounded-xl bg-white p-3 sm:max-w-[240px] sm:p-4"
              >
                <QRCode
                  value={`bitcoin:${DONATE_ADDRESS}`}
                  size={200}
                  level="M"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>
              <div className="flex w-full flex-col gap-3">
                <div className="flex max-w-full min-w-0 items-stretch gap-2">
                  <button
                    type="button"
                    onClick={onCopy}
                    className="flex min-w-0 flex-1 items-center overflow-hidden truncate rounded-md border border-[color:var(--card-inset-border)] bg-[color:var(--card-inset-deep)] px-2 py-2 text-left font-mono text-[10px] text-[color:var(--muted-strong)] transition-colors hover:border-[color:var(--border-strong)] hover:text-foreground sm:px-2.5 sm:text-[12px]"
                    aria-label="Copy Bitcoin address"
                    title="Copy address"
                  >
                    {DONATE_ADDRESS}
                  </button>
                  <button
                    type="button"
                    onClick={onCopy}
                    className={`touch-target flex flex-shrink-0 items-center justify-center rounded-md p-2 transition-colors ${copied
                      ? "bg-[color:var(--success-bg)] text-[color:var(--success)]"
                      : "bg-[color:var(--surface)] text-[color:var(--muted-strong)] hover:bg-[color:var(--surface-hover)] hover:text-foreground"
                      }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row">
                  <a
                    href={`bitcoin:${DONATE_ADDRESS}`}
                    className="touch-target flex flex-1 items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-[13px] font-semibold text-[color:var(--primary-foreground)] transition-colors hover:bg-[color:var(--primary-hover)]"
                  >
                    <Send className="h-4 w-4" />
                    Open Wallet
                  </a>
                  <button
                    type="button"
                    onClick={downloadQR}
                    className="touch-target flex items-center justify-center gap-2 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--surface)] px-4 py-2 text-[13px] font-semibold text-[color:var(--muted-strong)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Save QR
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  )
}
