"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, Square, Download, Trash2 } from "lucide-react"
import { VANITY_WORKER_SRC } from "@/lib/vanity-worker-source"
import { getEllipticSource, prefetchElliptic } from "@/lib/elliptic-loader"
import { ResultCard, type AddrType, type VanityResult } from "@/components/result-card"

const BECH32_CHARS = new Set("qpzry9x8gf2tvdw0s3jn54khce6mua7l")
const BASE58_CHARS = new Set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")

const ADDR_META: Record<AddrType, { label: string; fixedPrefix: string; charset: "bech32" | "base58" }> = {
  legacy: { label: "Legacy (1...)", fixedPrefix: "1", charset: "base58" },
  segwit: { label: "Native SegWit (bc1q...)", fixedPrefix: "bc1q", charset: "bech32" },
  taproot: { label: "Taproot (bc1p...)", fixedPrefix: "bc1p", charset: "bech32" },
}

function fmtNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T"
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return n.toLocaleString()
}
function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—"
  if (s < 60) return s + "s"
  const m = Math.floor(s / 60)
  if (m < 60) return m + "m " + (s % 60) + "s"
  const h = Math.floor(m / 60)
  if (h < 24) return h + "h " + (m % 60) + "m"
  const d = Math.floor(h / 24)
  if (d < 7) return d + "d " + (h % 24) + "h"
  const w = Math.floor(d / 7)
  if (d < 30) return w + "w " + (d % 7) + "d"
  const mo = Math.floor(d / 30)
  if (d < 365) return mo + "mo " + (d % 30) + "d"
  const y = Math.floor(d / 365)
  return y + "y " + (mo % 12) + "mo"
}
function pad(n: number) {
  return String(n).padStart(2, "0")
}
function makeFileStamp(d: Date) {
  return (
    [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-") +
    "_" +
    [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join("-")
  )
}
function addrTypeName(t: AddrType) {
  if (t === "segwit") return "Native SegWit"
  if (t === "taproot") return "Taproot"
  return "Legacy"
}

type ValidationResult = { ok: boolean; msg: string }

function validateCustomPattern(
  val: string,
  charset: "bech32" | "base58",
  caseSensitive: boolean,
): ValidationResult {
  if (!val) return { ok: true, msg: "" }
  if (charset === "bech32") {
    for (const c of val.toLowerCase()) {
      if (!BECH32_CHARS.has(c)) {
        return { ok: false, msg: `Invalid "${c}" — bech32 charset: qpzry9x8gf2tvdw0s3jn54khce6mua7l` }
      }
    }
  } else {
    const allowed = caseSensitive ? BASE58_CHARS : new Set([...BASE58_CHARS].map((c) => c.toLowerCase()))
    const check = caseSensitive ? val : val.toLowerCase()
    for (const c of check) {
      if (!allowed.has(c)) {
        return { ok: false, msg: `Invalid "${c}" — Base58 excludes 0, O, I, l` }
      }
    }
  }
  return { ok: true, msg: "" }
}

export function VanityGenerator() {
  const [addrType, setAddrType] = useState<AddrType>("segwit")
  const [customPrefix, setCustomPrefix] = useState("")
  const [suffix, setSuffix] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(true)
  const [threads, setThreads] = useState(4)
  const [maxThreads, setMaxThreads] = useState(8)
  const [targetCount, setTargetCount] = useState(1)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [results, setResults] = useState<VanityResult[]>([])

  const [speed, setSpeed] = useState<string>("—")
  const [totalDisplay, setTotalDisplay] = useState<string>("—")
  const [elapsedDisplay, setElapsedDisplay] = useState<string>("—")

  const workersRef = useRef<Worker[]>([])
  const totalAttemptsRef = useRef(0)
  const lastCountRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const resultIdRef = useRef(0)
  const foundCountRef = useRef(0)
  const targetRef = useRef(1)

  // Detect CPU cores + warm up elliptic cache.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      const hc = Math.max(1, Math.min(16, navigator.hardwareConcurrency))
      setMaxThreads(hc)
      setThreads(Math.min(4, hc))
    }
    prefetchElliptic()
  }, [])

  const meta = ADDR_META[addrType]
  const fixedPrefix = meta.fixedPrefix
  const charset = meta.charset
  // Bech32 addresses are lowercase-only so case-sensitivity is moot for segwit/taproot.
  const effectiveCaseSensitive = caseSensitive && charset === "base58"

  const prefixValidation = useMemo(
    () => validateCustomPattern(customPrefix.trim(), charset, effectiveCaseSensitive),
    [customPrefix, charset, effectiveCaseSensitive],
  )
  const suffixValidation = useMemo(
    () => validateCustomPattern(suffix.trim(), charset, effectiveCaseSensitive),
    [suffix, charset, effectiveCaseSensitive],
  )

  const difficulty = useMemo(() => {
    const p = customPrefix.trim()
    const s = suffix.trim()
    if (!p && !s) return null
    const base = charset === "bech32" ? 32 : 58
    const total = p.length + s.length
    if (total === 0) return null
    const avg = Math.pow(base, total)
    const aps = threads * 800
    const secs = Math.round(avg / aps)
    const targetSecs = Math.round(secs * Math.max(1, targetCount))
    return { avg: Math.round(avg), secs: targetSecs }
  }, [customPrefix, suffix, threads, charset, targetCount])

  // Reset patterns when switching address type.
  const handleAddrType = useCallback((v: AddrType) => {
    setAddrType(v)
    setCustomPrefix("")
    setSuffix("")
    setError("")
  }, [])

  const stopAll = useCallback(() => {
    workersRef.current.forEach((w) => w.terminate())
    workersRef.current = []
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current)
      statsTimerRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setRunning(false)
  }, [])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  const start = useCallback(async () => {
    const p = customPrefix.trim()
    const s = suffix.trim()

    if (!prefixValidation.ok || !suffixValidation.ok) {
      setError("Fix pattern errors above.")
      return
    }
    if (!p && !s) {
      setError("Enter at least a prefix or suffix beyond the default.")
      return
    }

    const tgt = Math.max(1, Math.min(100, Math.floor(targetCount) || 1))
    targetRef.current = tgt

    setError("")
    totalAttemptsRef.current = 0
    lastCountRef.current = 0
    foundCountRef.current = 0
    startTimeRef.current = Date.now()
    setSpeed("0")
    setTotalDisplay("0")
    setElapsedDisplay("0s")
    setRunning(true)

    // Full prefix (fixed + custom) is what the worker matches against.
    const fullPrefix = fixedPrefix + p

    const snapshot = {
      addrType,
      prefix: p,
      suffix: s,
      caseSensitive: effectiveCaseSensitive,
    }

    let ellipticSrc: string
    try {
      ellipticSrc = await getEllipticSource()
    } catch {
      setError("Could not load crypto library. Connect once to enable offline mode.")
      setRunning(false)
      return
    }

    const fullSrc = ellipticSrc + "\n" + VANITY_WORKER_SRC
    const blob = new Blob([fullSrc], { type: "text/javascript" })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url

    const handleMsg = (e: MessageEvent) => {
      const data = e.data as
        | { type: "progress"; attempts: number }
        | { type: "result"; address: string; privKey: string; wif: string; attempts: number }

      if (data.type === "progress") {
        totalAttemptsRef.current += data.attempts
        return
      }
      if (data.type === "result") {
        if (foundCountRef.current >= targetRef.current) return
        totalAttemptsRef.current += data.attempts
        foundCountRef.current += 1
        resultIdRef.current += 1
        const newResult: VanityResult = {
          id: resultIdRef.current,
          address: data.address,
          privKey: data.privKey,
          wif: data.wif,
          attempts: data.attempts,
          foundAt: new Date(),
          config: snapshot,
        }
        setResults((prev) => [newResult, ...prev])
        if (foundCountRef.current >= targetRef.current) {
          stopAll()
        }
      }
    }

    const config = {
      prefix: fullPrefix,
      suffix: s,
      caseSensitive: effectiveCaseSensitive,
      addrType,
    }

    for (let i = 0; i < threads; i++) {
      const w = new Worker(url)
      w.onmessage = handleMsg
      w.postMessage(config)
      workersRef.current.push(w)
    }

    statsTimerRef.current = setInterval(() => {
      const startTs = startTimeRef.current
      if (!startTs) return
      const elapsed = Math.round((Date.now() - startTs) / 1000)
      const delta = totalAttemptsRef.current - lastCountRef.current
      lastCountRef.current = totalAttemptsRef.current
      const aps = Math.round(delta * 2) // 500ms interval
      setSpeed(fmtNum(aps))
      setTotalDisplay(fmtNum(totalAttemptsRef.current))
      setElapsedDisplay(fmtTime(elapsed))
    }, 500)
  }, [
    customPrefix,
    suffix,
    threads,
    addrType,
    effectiveCaseSensitive,
    fixedPrefix,
    prefixValidation.ok,
    suffixValidation.ok,
    stopAll,
    targetCount,
  ])

  const downloadResults = useCallback(() => {
    if (!results.length) return
    const entries = [...results].reverse()
    const lines: string[] = [
      "BTC Vanity Results",
      "Generated: " + new Date().toLocaleString(),
      "Total results: " + entries.length,
      "Warning: Anyone with the private key or WIF can spend these funds.",
      "",
    ]
    entries.forEach((item, index) => {
      lines.push("Result " + (index + 1))
      lines.push("Found at: " + item.foundAt.toLocaleString())
      lines.push("Address type: " + addrTypeName(item.config.addrType))
      lines.push("Prefix: " + (item.config.prefix || "(none)"))
      lines.push("Suffix: " + (item.config.suffix || "(none)"))
      lines.push("Case sensitive: " + (item.config.caseSensitive ? "Yes" : "No"))
      lines.push("Attempts: " + item.attempts.toLocaleString())
      lines.push("Address: " + item.address)
      lines.push(
        (item.config.addrType === "taproot" ? "Internal Private Key (hex): " : "Private Key (hex): ") + item.privKey,
      )
      lines.push("WIF: " + item.wif)
      if (item.config.addrType === "taproot") {
        lines.push("Note: Import as Taproot internal key (descriptor: tr(WIF)).")
      }
      if (index < entries.length - 1) {
        lines.push("")
        lines.push("---")
        lines.push("")
      }
    })
    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "btc-vanity-results-" + makeFileStamp(new Date()) + ".txt"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [results])

  const customPrefixPlaceholder = charset === "bech32" ? "abc, 9xt, …" : "love, abc, …"
  const suffixPlaceholder = charset === "bech32" ? "9x8, abc, …" : "777, abc, …"
  const canStart = prefixValidation.ok && suffixValidation.ok && (customPrefix.trim() || suffix.trim())

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Configuration ── */}
      <section
        aria-labelledby="config-title"
        className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card)] p-4 sm:p-5"
      >
        <h2
          id="config-title"
          className="mb-4 text-[11px] font-semibold uppercase tracking-[1.2px] text-[color:var(--muted)]"
        >
          Configuration
        </h2>

        {/* Address type + count */}
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2.5">
          <div className="min-w-0">
            <label htmlFor="addrType" className="mb-1.5 block text-[12px] text-[color:var(--muted-foreground)]">
              Address Type
            </label>
            <select
              id="addrType"
              value={addrType}
              onChange={(e) => handleAddrType(e.target.value as AddrType)}
              disabled={running}
              className="select-chevron w-full cursor-pointer truncate rounded-lg border border-[color:var(--border)] bg-[color:var(--card-inset)] px-3 py-2.5 font-mono text-[14px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/40 disabled:opacity-60"
            >
              <option value="segwit">{ADDR_META.segwit.label}</option>
              <option value="taproot">{ADDR_META.taproot.label}</option>
              <option value="legacy">{ADDR_META.legacy.label}</option>
            </select>
          </div>
          <div>
            <label htmlFor="count" className="mb-1.5 block text-[12px] text-[color:var(--muted-foreground)]">
              Count
            </label>
            <input
              id="count"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              value={targetCount}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isNaN(n)) return setTargetCount(1)
                setTargetCount(Math.max(1, Math.min(100, Math.floor(n))))
              }}
              disabled={running}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card-inset)] px-3 py-2.5 text-center font-mono text-[14px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/40 disabled:opacity-60"
              aria-label="Number of results to find before stopping"
            />
          </div>
        </div>

        {/* Prefix (locked default) / Suffix */}
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="prefix" className="mb-1.5 block text-[12px] text-[color:var(--muted-foreground)]">
              Prefix <span className="text-[color:var(--muted)]">(after {fixedPrefix})</span>
            </label>
            <div
              className={`flex items-stretch overflow-hidden rounded-lg border bg-[color:var(--card-inset)] transition-colors focus-within:border-[color:var(--primary)]/40 ${!prefixValidation.ok ? "border-[color:var(--destructive)]/60" : "border-[color:var(--border)]"
                } ${running ? "opacity-60" : ""}`}
            >
              <span
                aria-label={`Fixed ${fixedPrefix} prefix`}
                className="flex select-none items-center border-r border-[color:var(--border)] bg-[color:var(--surface)] px-3 font-mono text-[14px] font-semibold text-[color:var(--primary)]"
              >
                {fixedPrefix}
              </span>
              <input
                id="prefix"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={customPrefix}
                placeholder={customPrefixPlaceholder}
                onChange={(e) => setCustomPrefix(e.target.value)}
                disabled={running}
                className="w-full min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[14px] text-foreground outline-none placeholder:text-[color:var(--muted)]"
              />
            </div>
            {!prefixValidation.ok && (
              <p className="mt-1 text-[11px] text-[color:var(--destructive)]">{prefixValidation.msg}</p>
            )}
          </div>
          <div>
            <label htmlFor="suffix" className="mb-1.5 block text-[12px] text-[color:var(--muted-foreground)]">
              Suffix <span className="text-[color:var(--muted)]">(address end)</span>
            </label>
            <input
              id="suffix"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={suffix}
              placeholder={suffixPlaceholder}
              onChange={(e) => setSuffix(e.target.value)}
              disabled={running}
              className={`w-full rounded-lg border bg-[color:var(--card-inset)] px-3 py-2.5 font-mono text-[14px] text-foreground outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)]/40 disabled:opacity-60 ${!suffixValidation.ok ? "border-[color:var(--destructive)]/60" : "border-[color:var(--border)]"
                }`}
            />
            {!suffixValidation.ok && (
              <p className="mt-1 text-[11px] text-[color:var(--destructive)]">{suffixValidation.msg}</p>
            )}
          </div>
        </div>

        {/* Options: case sensitive + charset info */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label
            className={`flex select-none items-center gap-2 text-[13px] text-[color:var(--muted-strong)] ${charset === "bech32" ? "pointer-events-none opacity-40" : "cursor-pointer"
              }`}
          >
            <input
              type="checkbox"
              checked={effectiveCaseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              disabled={charset === "bech32" || running}
              className="h-4 w-4 cursor-pointer"
              style={{ accentColor: "var(--primary)" }}
            />
            Case Sensitive
          </label>
          {charset === "bech32" && (
            <p className="text-[11px] text-[color:var(--muted)]">
              Valid:{" "}
              <span className="font-mono tracking-wide text-[color:var(--muted)]">
                qpzry9x8gf2tvdw0s3jn54khce6mua7l
              </span>
            </p>
          )}
        </div>

        {/* Threads */}
        <div className="mb-4 flex items-center gap-3">
          <label htmlFor="threads" className="flex-shrink-0 text-[12px] text-[color:var(--muted-foreground)]">
            Threads:
          </label>
          <input
            id="threads"
            type="range"
            min={1}
            max={maxThreads}
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            disabled={running}
            className="flex-1 cursor-pointer disabled:opacity-60"
          />
          <span
            aria-live="polite"
            className="min-w-[1.5rem] text-right text-[13px] font-bold text-[color:var(--primary)]"
          >
            {threads}
          </span>
        </div>

        {error && (
          <p role="alert" className="mb-2 text-[11px] text-[color:var(--destructive)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => (running ? stopAll() : start())}
          disabled={!running && !canStart}
          className={`touch-target flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px] font-semibold tracking-wide transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${running
            ? "bg-[color:var(--destructive-bg)] text-white hover:bg-[color:var(--destructive-hover)]"
            : "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary-hover)]"
            }`}
        >
          {running ? (
            <>
              <Square className="h-4 w-4 fill-current" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              {targetCount > 1 ? `Find ${targetCount}` : "Start Generating"}
            </>
          )}
        </button>

        {difficulty && (
          <p className="mt-2 text-center text-[11px] text-[color:var(--muted)]">
            ~<span className="text-[color:var(--primary)]">{fmtNum(difficulty.avg)}</span> attempts avg · est.{" "}
            <span className="text-[color:var(--primary)]">{fmtTime(difficulty.secs)}</span> for {targetCount} on{" "}
            {threads} thread{threads > 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* ── Progress ── */}
      <section
        aria-labelledby="progress-title"
        className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card)] p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${running
                ? "animate-pulse-dot bg-[color:var(--success)] shadow-[0_0_6px_rgba(76,175,80,0.4)]"
                : "bg-[color:var(--muted)]"
                }`}
            />
            <h2
              id="progress-title"
              className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[color:var(--muted)]"
            >
              Progress
            </h2>
          </div>
          <span className="font-mono text-[11px] text-[color:var(--muted-foreground)]">
            {results.length}/{targetCount} found
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { value: speed, label: "Addresses/sec" },
            { value: totalDisplay, label: "Total Attempts" },
            { value: elapsedDisplay, label: "Elapsed" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-[color:var(--card-inset)] p-3 text-center">
              <div className="min-h-[1.5rem] truncate font-mono text-[18px] font-bold text-[color:var(--primary)]">
                {s.value}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-[color:var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Results ── */}
      <section
        aria-labelledby="results-title"
        className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card)] p-4 sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${results.length > 0
                ? "bg-[color:var(--success)] shadow-[0_0_6px_rgba(76,175,80,0.4)]"
                : "bg-[color:var(--muted)]"
                }`}
            />
            <h2
              id="results-title"
              className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[color:var(--muted)]"
            >
              Results {results.length > 0 && <span className="ml-1 text-[color:var(--muted-foreground)]">({results.length})</span>}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setResults([])}
              disabled={!results.length}
              className="touch-target inline-flex items-center gap-1.5 whitespace-nowrap text-[color:var(--destructive)]/80 hover:text-[color:var(--destructive)] disabled:cursor-not-allowed disabled:opacity-35 transition-colors px-3 py-2 border border-transparent hover:border-[color:var(--destructive)]/30 hover:bg-[color:var(--destructive)]/10 rounded-lg text-[12px] font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              type="button"
              onClick={downloadResults}
              disabled={!results.length}
              className="touch-target inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[12px] font-semibold text-[color:var(--muted-strong)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Download className="h-3.5 w-3.5" />
              Download Results
            </button>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="rounded-lg py-8 text-center text-[13px] text-[color:var(--muted)]">
            Results will appear here when a match is found
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {results.map((r) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-1 px-2 text-center text-[11px] leading-relaxed text-[color:var(--muted)]">
        Always verify: open-source code, local generation, no network calls. Save private key / WIF securely offline.
      </p>
    </div>
  )
}
