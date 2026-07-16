"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { logExpense } from "@/lib/actions";
import { CATEGORIES } from "@/lib/categories";

export function ExpenseForm({ day }: { day: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [lastSaved, setLastSaved] = useState<{
    amount: string;
    note: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const amount = String(formData.get("amount") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    setPending(true);
    setMessage("");
    setLastSaved(null);
    try {
      await logExpense(formData);
      setLastSaved({ amount, note: note || "Expense" });
      form.reset();
      router.refresh();
    } catch {
      setMessage("Couldn’t log the expense. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="day" value={day} />
        <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className="w-24 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40" />
        <input name="note" placeholder="What was it?" autoComplete="off" className="min-w-40 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40" />
        <select name="category" className="rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/15 dark:bg-black">
          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-black">
          {pending ? <LoaderCircle className="animate-spin" size={16} aria-label="Logging expense" /> : "Log"}
        </button>
      </form>
      {lastSaved && (
        <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          Saved <span className="font-medium">{lastSaved.note}</span> (${lastSaved.amount}).
        </p>
      )}
      {message && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}
