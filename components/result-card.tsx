"use client"

import { useState } from "react"
import { Check, Copy, Lock, Plus, Minus } from "lucide-react"

export type AddrType = "segwit" | "legacy" | "taproot"

const ADDR_META: Record<AddrType, { fixedPrefix: string }> = {
  legacy: { fixedPrefix: "1" },
  segwit: { fixedPrefix: "bc1q" },
  taproot: { fixedPrefix: "bc1p" },
}

export type VanityResult = {
  id: number
  address: string
  privKey: string
  wif: string
  attempts: number
  foundAt: Date
  config: {
    addrType: AddrType
    prefix: string
    suffix: string
    caseSensitive: boolean
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : label}
      className={`touch-target flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${copied
          ? "bg-[color:var(--success-bg)] text-[color:var(--success)]"
          : "bg-[color:var(--surface)] text-[color:var(--muted-strong)] hover:bg-[color:var(--surface-hover)] hover:text-foreground"
        }`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  )
}

function HighlightedAddress({ result }: { result: VanityResult }) {
  const { address, config } = result
  const { prefix, suffix, caseSensitive, addrType } = config

  const fixedPrefix = ADDR_META[addrType].fixedPrefix
  const matchPrefix = fixedPrefix.length + prefix.length

  let matchSuffixStart = -1
  if (suffix) {
    if (caseSensitive) {
      if (address.endsWith(suffix)) matchSuffixStart = address.length - suffix.length
    } else {
      if (address.toLowerCase().endsWith(suffix.toLowerCase()))
        matchSuffixStart = address.length - suffix.length
    }
  }

  const parts: Array<{ text: string; highlight: boolean }> = []
  const hasPrefix = prefix.length > 0
  const hasSuffix = matchSuffixStart >= 0

  if (hasPrefix) {
    parts.push({ text: address.slice(0, matchPrefix), highlight: true })
  }
  const middleStart = hasPrefix ? matchPrefix : 0
  const middleEnd = hasSuffix ? matchSuffixStart : address.length
  if (middleEnd > middleStart) {
    parts.push({ text: address.slice(middleStart, middleEnd), highlight: false })
  }
  if (hasSuffix) {
    parts.push({ text: address.slice(matchSuffixStart), highlight: true })
  }

  return (
    <span className="break-all">
      {parts.map((p, i) =>
        p.highlight ? (
          <span key={i} className="font-bold text-[color:var(--primary)]">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  )
}

function Row({
  label,
  value,
  copyLabel,
  children,
}: {
  label: string
  value: string
  copyLabel: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden truncate rounded-md bg-[color:var(--card-inset-deep)] px-2.5 py-2 font-mono text-[12px] text-[color:var(--muted-strong)]">
          {children ?? value}
        </div>
        <CopyButton text={value} label={copyLabel} />
      </div>
    </div>
  )
}

export function ResultCard({ result }: { result: VanityResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="animate-fade-in-up rounded-xl border border-[color:var(--card-inset-border)] border-l-[3px] border-l-[color:var(--primary)] bg-[color:var(--card-inset)] p-4">
      <div className="mb-2.5 last:mb-0">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.6px] text-[color:var(--muted)]">
          <span>Address</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[color:var(--muted)] hover:text-foreground transition-colors"
          >
            {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {expanded ? "Hide Details" : "Show Details"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden truncate rounded-md bg-[color:var(--card-inset-deep)] px-2.5 py-2 font-mono text-[12px] text-[color:var(--muted-strong)]">
            <HighlightedAddress result={result} />
          </div>
          <CopyButton text={result.address} label="Copy Address" />
        </div>
      </div>

      {expanded && (
        <>
          <Row label="Private Key (hex)" value={result.privKey} copyLabel="Copy Key" />
          <Row label="WIF (import format)" value={result.wif} copyLabel="Copy WIF" />
          <div className="mt-3 flex items-start gap-2 border-t border-[color:var(--card-inset-border)] pt-3 text-[11px] leading-snug text-[color:var(--muted)]">
            <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>
              Store your private key / WIF offline in a secure location. Anyone with it controls the funds.
            </span>
          </div>
        </>
      )}
    </article>
  )
}
