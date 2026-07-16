"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudCheck, CloudOff, LoaderCircle, Zap } from "lucide-react";
import { quickCapture } from "@/lib/actions";

export const OFFLINE_CAPTURE_KEY = "megaapp:quick-capture-queue:v1";
const MAX_OFFLINE_CAPTURES = 50;

type QueuedCapture = {
  id: string;
  text: string;
  capturedAt: string;
};

function readQueue(): QueuedCapture[] {
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_CAPTURE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is QueuedCapture => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<QueuedCapture>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.text === "string" &&
        candidate.text.length > 0 &&
        candidate.text.length <= 500 &&
        typeof candidate.capturedAt === "string"
      );
    }).slice(-MAX_OFFLINE_CAPTURES);
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedCapture[]) {
  try {
    localStorage.setItem(OFFLINE_CAPTURE_KEY, JSON.stringify(queue.slice(-MAX_OFFLINE_CAPTURES)));
    return true;
  } catch {
    return false;
  }
}

function formDataFor(item: QueuedCapture) {
  const formData = new FormData();
  formData.set("text", item.text);
  formData.set("clientId", item.id);
  formData.set("capturedAt", item.capturedAt);
  return formData;
}

export function QuickCapture() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const flushing = useRef(false);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine || flushing.current) return;
    if (readQueue().length === 0) {
      setQueued(0);
      return;
    }

    flushing.current = true;
    setBusy(true);
    let synced = 0;
    try {
      while (navigator.onLine) {
        const item = readQueue()[0];
        if (!item) break;
        try {
          const result = await quickCapture(formDataFor(item));
          const remaining = readQueue();
          const deliveredIndex = remaining.findIndex((queuedItem) => queuedItem.id === item.id);
          if (deliveredIndex >= 0) remaining.splice(deliveredIndex, 1);
          writeQueue(remaining);
          if (result.ok) synced += 1;
        } catch {
          break;
        }
      }
      const remaining = readQueue().length;
      setQueued(remaining);
      if (synced > 0) {
        setMessage(`${synced} offline capture${synced === 1 ? "" : "s"} synced.`);
        router.replace(`/today?updated=${Date.now()}`, { scroll: false });
      }
    } finally {
      flushing.current = false;
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    const updateConnection = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      setQueued(readQueue().length);
      if (isOnline) void flushQueue();
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, [flushQueue]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = text.trim().slice(0, 500);
    if (!cleanText) return;
    const item: QueuedCapture = {
      id: crypto.randomUUID(),
      text: cleanText,
      capturedAt: new Date().toISOString(),
    };
    setText("");
    setMessage("");

    const next = [...readQueue(), item].slice(-MAX_OFFLINE_CAPTURES);
    if (!writeQueue(next)) {
      setMessage("This browser could not save the capture queue.");
      return;
    }
    setQueued(next.length);

    if (!navigator.onLine) {
      setOnline(false);
      setMessage("Saved on this device. It will sync when you reconnect.");
      return;
    }
    setMessage("Saving…");
    void flushQueue();
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 py-2 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
          <Zap size={16} className="shrink-0 text-black/40 dark:text-white/40" />
          <input
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            placeholder="Capture anything…"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {busy ? <LoaderCircle className="animate-spin" size={16} aria-label="Capturing" /> : "Capture"}
        </button>
      </form>
      {(message || !online || queued > 0) && (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-black/50 dark:text-white/50" role="status">
          {online ? <CloudCheck size={12} /> : <CloudOff size={12} />}
          {message || (!online ? `Offline${queued ? ` · ${queued} waiting` : ""}` : `${queued} waiting to sync`)}
        </p>
      )}
      <p className="mt-1.5 px-1 text-[11px] text-black/35 dark:text-white/35">
        Tasks by default · <span className="font-mono">$12 lunch</span> ·{" "}
        <span className="font-mono">weight 72.4</span> ·{" "}
        <span className="font-mono">water 500</span> ·{" "}
        <span className="font-mono">sleep 7.5</span> ·{" "}
        <span className="font-mono">run 30min</span> ·{" "}
        <span className="font-mono">buy milk</span> ·{" "}
        <span className="font-mono">read Dune</span> ·{" "}
        <span className="font-mono">watch Severance</span> ·{" "}
        <span className="font-mono">met Alex</span> ·{" "}
        <span className="font-mono">service aircon</span> ·{" "}
        <span className="font-mono">todo call mum tomorrow</span>
      </p>
    </div>
  );
}
