"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  deletePushSubscription,
  savePushSubscription,
} from "@/lib/actions";

type Status = "checking" | "off" | "on" | "denied" | "unsupported";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

export function NotificationControl({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (live) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (live) setStatus(subscription ? "on" : "off");
    }
    void check().catch(() => live && setStatus("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setMessage("Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(vapidPublicKey),
        }));
      const formData = new FormData();
      formData.set("subscription", JSON.stringify(subscription.toJSON()));
      formData.set("userAgent", navigator.userAgent);
      const result = await savePushSubscription(formData);
      setStatus(result.ok ? "on" : "off");
      setMessage(result.message);
    } catch {
      setStatus("off");
      setMessage("Couldn’t enable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const formData = new FormData();
        formData.set("endpoint", subscription.endpoint);
        await deletePushSubscription(formData);
        await subscription.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications turned off on this device.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") return null;

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {status === "on" ? (
            <Bell className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" size={18} />
          ) : (
            <BellOff className="mt-0.5 shrink-0 text-black/45 dark:text-white/45" size={18} />
          )}
          <div>
            <p className="text-sm font-medium">
              {status === "on" ? "Notifications are on" : "Protect your streaks"}
            </p>
            <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
              {status === "denied"
                ? "Allow notifications in your browser settings, then reload."
                : status === "on"
                  ? "This device will receive reminders and evening streak nudges."
                  : "Get renewal, weekly review, and streak-at-risk reminders. On iPhone, add Megaapp to your Home Screen first."}
            </p>
          </div>
        </div>
        {status === "on" ? (
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className="rounded-lg border border-black/10 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-white/10"
          >
            {busy ? "Turning off…" : "Turn off"}
          </button>
        ) : status !== "denied" ? (
          <button
            type="button"
            disabled={busy || status === "checking"}
            onClick={enable}
            className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {busy ? "Enabling…" : status === "checking" ? "Checking…" : "Enable"}
          </button>
        ) : null}
      </div>
      {message && (
        <p className="mt-2 pl-7 text-xs text-black/50 dark:text-white/50" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
