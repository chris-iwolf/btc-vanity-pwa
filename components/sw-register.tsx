"use client"

import { useEffect } from "react"

/**
 * Registers the Service Worker so the app is installable and fully
 * functional offline after the first successful visit.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("[v0] SW registration failed:", err)
      })
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
    }
  }, [])

  return null
}
