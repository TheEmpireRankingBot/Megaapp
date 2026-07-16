"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { createSubscription, deleteItem, subscriptionPaid } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import type { SubscriptionView } from "@/lib/money";

function formatSGD(amount: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount);
}

function renewalLabel(daysUntil: number, key: string) {
  if (daysUntil < 0)
    return { text: `overdue ${-daysUntil}d`, tone: "text-red-500 font-medium" };
  if (daysUntil === 0)
    return { text: "due today", tone: "text-amber-600 dark:text-amber-400 font-medium" };
  if (daysUntil <= 7)
    return { text: `renews in ${daysUntil}d`, tone: "text-amber-600 dark:text-amber-400" };
  return { text: `renews ${formatDay(key)}`, tone: "text-black/45 dark:text-white/45" };
}

function sortSubscriptions(list: SubscriptionView[]) {
  return [...list].sort((left, right) => left.daysUntil - right.daysUntil);
}

export function SubscriptionsClient({ initialList }: { initialList: SubscriptionView[] }) {
  const [list, setList] = useState(initialList);
  const [adding, setAdding] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const monthlyTotal = list.reduce((sum, subscription) => sum + subscription.monthlyEquivalent, 0);

  function setBusy(itemId: string, busy: boolean) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const form = event.currentTarget;
    setAdding(true);
    setMessage("");
    try {
      const created = await createSubscription(new FormData(form));
      if (!created) throw new Error("Subscription was not created");
      setList((current) => sortSubscriptions([...current, created]));
      form.reset();
    } catch {
      setMessage("Couldn’t add the subscription. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function markPaid(event: FormEvent<HTMLFormElement>, subscription: SubscriptionView) {
    event.preventDefault();
    if (busyIds.has(subscription.itemId)) return;
    const previous = list;
    setBusy(subscription.itemId, true);
    setMessage("");
    setList((current) =>
      sortSubscriptions(
        current.map((candidate) =>
          candidate.itemId === subscription.itemId
            ? { ...candidate, daysUntil: 1, nextRenewalKey: candidate.nextRenewalKey }
            : candidate,
        ),
      ),
    );
    try {
      const updated = await subscriptionPaid(new FormData(event.currentTarget));
      if (!updated) throw new Error("Subscription was not updated");
      setList((current) =>
        sortSubscriptions(
          current.map((candidate) =>
            candidate.itemId === subscription.itemId ? { ...candidate, ...updated } : candidate,
          ),
        ),
      );
    } catch {
      setList(previous);
      setMessage(`Couldn’t mark ${subscription.name} paid. Try again.`);
    } finally {
      setBusy(subscription.itemId, false);
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>, subscription: SubscriptionView) {
    event.preventDefault();
    if (busyIds.has(subscription.itemId)) return;
    const previous = list;
    setBusy(subscription.itemId, true);
    setMessage("");
    setList((current) => current.filter((candidate) => candidate.itemId !== subscription.itemId));
    try {
      await deleteItem(new FormData(event.currentTarget));
    } catch {
      setList(previous);
      setMessage(`Couldn’t delete ${subscription.name}. Try again.`);
    } finally {
      setBusy(subscription.itemId, false);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Subscriptions
        </h2>
        {list.length > 0 && (
          <span className="text-xs text-black/45 dark:text-white/45">
            ≈ {formatSGD(monthlyTotal)}/month
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <p className="px-2 text-sm text-black/45 dark:text-white/45">
          Track recurring costs — Netflix, gym, iCloud — and get warned before they renew.
        </p>
      ) : (
        <div className="space-y-1">
          {list.map((subscription) => {
            const label = renewalLabel(subscription.daysUntil, subscription.nextRenewalKey);
            const busy = busyIds.has(subscription.itemId);
            return (
              <div key={subscription.itemId} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/[.04]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{subscription.name}</p>
                  <p className={`text-xs ${label.tone}`}>{label.text}</p>
                </div>
                <span className="text-sm tabular-nums">
                  {formatSGD(subscription.amount)}
                  <span className="text-xs text-black/45 dark:text-white/45">/{subscription.cadence === "monthly" ? "mo" : "yr"}</span>
                </span>
                {subscription.daysUntil <= 0 && (
                  <form onSubmit={(event) => markPaid(event, subscription)}>
                    <input type="hidden" name="itemId" value={subscription.itemId} />
                    <button type="submit" disabled={busy} className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium disabled:opacity-40 dark:border-white/15">
                      Paid
                    </button>
                  </form>
                )}
                <form onSubmit={(event) => remove(event, subscription)}>
                  <input type="hidden" name="itemId" value={subscription.itemId} />
                  <button type="submit" disabled={busy} aria-label={`Delete subscription ${subscription.name}`} className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-20 dark:text-white/30">
                    <X size={14} />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-black/15 p-3 dark:border-white/15">
        <fieldset disabled={adding} className="contents">
          <input name="name" required placeholder="Name (e.g. Netflix)" autoComplete="off" className="min-w-32 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50 dark:border-white/15" />
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className="w-24 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm tabular-nums outline-none disabled:opacity-50 dark:border-white/15" />
          <select name="cadence" className="rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-black">
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-black/60 dark:text-white/60">
            next renewal
            <input type="date" name="next" required className="rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-50 dark:border-white/15 dark:[color-scheme:dark]" />
          </label>
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black">
            {adding ? <LoaderCircle className="animate-spin" size={16} aria-label="Adding subscription" /> : "Add"}
          </button>
        </fieldset>
      </form>

      {message && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{message}</p>}
    </section>
  );
}
