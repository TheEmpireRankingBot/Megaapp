import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import {
  formatSGD,
  getMoneySummary,
  getSubscriptions,
} from "@/lib/money";
import {
  setMonthlyBudget,
  deleteEntry,
} from "@/lib/actions";
import { formatDay, todayKey } from "@/lib/dates";
import { ExpenseForm } from "@/components/expense-form";
import { SubscriptionsClient } from "@/components/subscriptions-client";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const user = await getCurrentUser();
  const settings = user.settings as { budgetMonthly?: number };
  const budget = settings.budgetMonthly ?? null;
  const [summary, subs] = await Promise.all([
    getMoneySummary(user.id, budget),
    getSubscriptions(user.id),
  ]);
  const budgetUsed = budget ? Math.min(summary.total / budget, 1) : 0;
  const overBudget = budget !== null && summary.total > budget;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Money</h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            {summary.monthLabel}
          </p>
        </div>
        <p className="text-right">
          <span className="block text-2xl font-bold tabular-nums">
            {formatSGD(summary.total)}
          </span>
          <span className="text-xs text-black/45 dark:text-white/45">
            spent this month
          </span>
        </p>
      </header>

      <section className="space-y-2">
        {budget !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
              <div
                className={`h-full rounded-full transition-all ${
                  overBudget ? "bg-red-500" : "bg-emerald-500"
                }`}
                style={{ width: `${budgetUsed * 100}%` }}
              />
            </div>
            <p
              className={`mt-1 text-xs ${
                overBudget
                  ? "font-medium text-red-500"
                  : "text-black/45 dark:text-white/45"
              }`}
            >
              {overBudget
                ? `${formatSGD(summary.total - budget)} over your ${formatSGD(budget)} budget`
                : `${formatSGD(budget - summary.total)} left of ${formatSGD(budget)}`}
            </p>
          </div>
        )}
        <form
          action={setMonthlyBudget}
          className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60"
        >
          <label htmlFor="budget">Monthly budget</label>
          <input
            id="budget"
            name="budget"
            type="number"
            step="1"
            min="0"
            defaultValue={budget ?? ""}
            placeholder="none"
            className="w-24 rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
          />
          <button
            type="submit"
            className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Set
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Log expense
        </h2>
        <ExpenseForm day={todayKey()} />
        <p className="text-[11px] text-black/35 dark:text-white/35">
          Or from Today&apos;s capture bar:{" "}
          <span className="font-mono">$14.50 lunch #food</span>
        </p>
      </section>

      <SubscriptionsClient initialList={subs.list} />

      {summary.byCategory.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            By category
          </h2>
          <div className="space-y-1.5">
            {summary.byCategory.map(({ category, amount }) => (
              <div key={category} className="flex items-center gap-3 text-sm">
                <span className="w-24 truncate text-black/60 dark:text-white/60">
                  {category}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-black/60 dark:bg-white/60"
                    style={{
                      width: `${(amount / summary.byCategory[0].amount) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums">
                  {formatSGD(amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recent
        </h2>
        {summary.recent.length === 0 ? (
          <p className="px-2 py-1 text-sm text-black/45 dark:text-white/45">
            No expenses logged this month. The first one takes ten seconds.
          </p>
        ) : (
          summary.recent.map((e) => (
            <div
              key={e.entryId}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/[.04]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{e.note || e.category}</p>
                <p className="text-xs text-black/45 dark:text-white/45">
                  {formatDay(e.day)} ·{" "}
                  <span className="rounded-full bg-black/5 px-1.5 dark:bg-white/10">
                    {e.category}
                  </span>
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatSGD(e.amount)}
              </span>
              <form action={deleteEntry}>
                <input type="hidden" name="entryId" value={e.entryId} />
                <button
                  type="submit"
                  aria-label="Delete expense"
                  className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-white/30"
                >
                  <X size={14} />
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
