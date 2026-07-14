"use client";

import { useEffect } from "react";

/** Registers the PWA service worker in production (PRD §6.1). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] registration failed", err);
    });
  }, []);
  return null;
}
