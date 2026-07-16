"use client";

import { useEffect } from "react";

/** Register the push service worker independently of notification settings. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("Megaapp service worker registration failed", error);
      }
    });
  }, []);

  return null;
}
