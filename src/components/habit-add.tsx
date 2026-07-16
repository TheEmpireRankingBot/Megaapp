"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { createHabit } from "@/lib/actions";
import type { HabitView } from "@/lib/data";

export function HabitAdd({ onCreated }: { onCreated: (habit: HabitView) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!String(formData.get("title") ?? "").trim()) return;
    setPending(true);
    setMessage("");
    try {
      const habit = await createHabit(formData);
      if (!habit) throw new Error("Habit was not created");
      onCreated(habit);
      form.reset();
    } catch {
      setMessage("Couldn’t add the habit. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 py-2 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
          <Plus size={16} className="shrink-0 text-black/40 dark:text-white/40" />
          <input
            name="title"
            required
            maxLength={200}
            placeholder="New daily habit — e.g. Read 20 minutes…"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
          />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black">
          {pending ? <LoaderCircle className="animate-spin" size={16} aria-label="Adding habit" /> : "Add"}
        </button>
      </form>
      {message && <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}
