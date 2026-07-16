"use client";

import { type FormEvent, useState } from "react";
import { LibraryBig, Sparkles, Star, X } from "lucide-react";
import { deleteItem, rateMediaItem, updateMediaState } from "@/lib/actions";
import type { MediaItem, MediaState } from "@/lib/lists";

const KIND_LABEL: Record<string, string> = {
  book: "Book",
  movie: "Movie",
  show: "Show",
  game: "Game",
  other: "Other",
};

export function MediaLibraryClient({ initialItems }: { initialItems: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const backlog = items.filter((item) => item.state === "backlog");
  const current = items.filter((item) => item.state === "in_progress");
  const done = items.filter((item) => item.state === "done");
  const nextPick = backlog.at(-1) ?? null;

  function setBusy(itemId: string, busy: boolean) {
    setBusyIds((currentIds) => {
      const next = new Set(currentIds);
      if (busy) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  async function changeState(event: FormEvent<HTMLFormElement>, item: MediaItem, state: MediaState) {
    event.preventDefault();
    if (busyIds.has(item.itemId)) return;
    const previous = items;
    setBusy(item.itemId, true);
    setMessage("");
    setItems((currentItems) => currentItems.map((candidate) => candidate.itemId === item.itemId ? { ...candidate, state } : candidate));
    try {
      await updateMediaState(new FormData(event.currentTarget));
    } catch {
      setItems(previous);
      setMessage(`Couldn’t update ${item.title}. Try again.`);
    } finally {
      setBusy(item.itemId, false);
    }
  }

  async function rate(event: FormEvent<HTMLFormElement>, item: MediaItem) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rating = Number(formData.get("rating"));
    if (busyIds.has(item.itemId) || !Number.isInteger(rating)) return;
    const previous = items;
    setBusy(item.itemId, true);
    setItems((currentItems) => currentItems.map((candidate) => candidate.itemId === item.itemId ? { ...candidate, rating } : candidate));
    try {
      await rateMediaItem(formData);
    } catch {
      setItems(previous);
      setMessage(`Couldn’t rate ${item.title}. Try again.`);
    } finally {
      setBusy(item.itemId, false);
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>, item: MediaItem) {
    event.preventDefault();
    if (busyIds.has(item.itemId)) return;
    const previous = items;
    setItems((currentItems) => currentItems.filter((candidate) => candidate.itemId !== item.itemId));
    try {
      await deleteItem(new FormData(event.currentTarget));
    } catch {
      setItems(previous);
      setMessage(`Couldn’t delete ${item.title}. Try again.`);
    }
  }

  function row(item: MediaItem) {
    const busy = busyIds.has(item.itemId);
    return (
      <div key={item.itemId} className="group rounded-xl border border-black/10 p-3 dark:border-white/10">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">{KIND_LABEL[item.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{item.title}</p>
            {item.notes && <p className="mt-1 text-xs text-black/50 dark:text-white/50">{item.notes}</p>}
            {item.rating && <p className="mt-1 flex items-center gap-1 text-xs text-amber-500"><Star size={12} fill="currentColor" /> {item.rating}/5</p>}
          </div>
          <form onSubmit={(event) => remove(event, item)}>
            <input type="hidden" name="itemId" value={item.itemId} />
            <button disabled={busy} aria-label={`Delete ${item.title}`} className="rounded p-1 text-black/30 opacity-0 hover:text-red-500 group-hover:opacity-100 disabled:opacity-20 dark:text-white/30"><X size={14} /></button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.state !== "in_progress" && <form onSubmit={(event) => changeState(event, item, "in_progress")}><input type="hidden" name="itemId" value={item.itemId} /><input type="hidden" name="state" value="in_progress" /><button disabled={busy} className="rounded-md border border-black/10 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10">Start</button></form>}
          {item.state !== "done" && <form onSubmit={(event) => changeState(event, item, "done")}><input type="hidden" name="itemId" value={item.itemId} /><input type="hidden" name="state" value="done" /><button disabled={busy} className="rounded-md border border-black/10 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10">Finish</button></form>}
          {item.state === "done" && <form onSubmit={(event) => rate(event, item)} className="flex items-center gap-1"><input type="hidden" name="itemId" value={item.itemId} /><select name="rating" defaultValue={item.rating ?? ""} aria-label={`Rate ${item.title}`} className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10 dark:bg-black"><option value="" disabled>rate</option>{[1, 2, 3, 4, 5].map((ratingValue) => <option key={ratingValue} value={ratingValue}>{ratingValue}/5</option>)}</select><button disabled={busy} className="rounded-md border border-black/10 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10">Save</button></form>}
          {item.state !== "backlog" && <form onSubmit={(event) => changeState(event, item, "backlog")}><input type="hidden" name="itemId" value={item.itemId} /><input type="hidden" name="state" value="backlog" /><button disabled={busy} className="text-xs text-black/40 hover:underline disabled:opacity-40 dark:text-white/40">Backlog</button></form>}
        </div>
      </div>
    );
  }

  function section(title: string, sectionItems: MediaItem[]) {
    if (sectionItems.length === 0) return null;
    return <section className="space-y-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">{title}</h2><div className="grid gap-2 sm:grid-cols-2">{sectionItems.map(row)}</div></section>;
  }

  return (
    <>
      {nextPick && <section className="rounded-xl border border-amber-500/25 bg-amber-500/[.05] p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"><Sparkles size={14} /> Pick next</p><p className="mt-2 font-medium">{nextPick.title}</p><p className="text-xs text-black/50 dark:text-white/50">Oldest item in your backlog. Start it or clear it.</p></section>}
      {items.length === 0 ? <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15"><LibraryBig className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-3 text-sm text-black/50 dark:text-white/50">Try Quick Capture: <span className="font-mono">read Dune</span> or <span className="font-mono">watch Severance</span>.</p></div> : <div className="space-y-7">{section("In progress", current)}{section(`Backlog · ${backlog.length}`, backlog)}{section(`Finished · ${done.length}`, done)}</div>}
      {message && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{message}</p>}
    </>
  );
}
