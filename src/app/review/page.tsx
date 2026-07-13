import { getCurrentUser } from "@/lib/user";
import {
  formatWeekRange,
  getRecentReviews,
  getReviewForWeek,
  getWeekStats,
  weekStartKey,
} from "@/lib/review";
import { MOODS } from "@/lib/data";
import { formatSGD } from "@/lib/money";
import { saveReview } from "@/lib/actions";
import { todayKey } from "@/lib/dates";

export const metadata = { title: "Weekly review" };
export const dynamic = "force-dynamic";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

const PROMPTS = [
  { name: "wins", label: "What went well?" },
  { name: "challenges", label: "What didn't?" },
  { name: "focus", label: "Focus for next week" },
] as const;

export default async function ReviewPage() {
  const user = await getCurrentUser();
  const weekStart = weekStartKey(todayKey());
  const [stats, review, recent] = await Promise.all([
    getWeekStats(user.id, weekStart),
    getReviewForWeek(user.id, weekStart),
    getRecentReviews(user.id),
  ]);
  const past = recent.filter((r) => r.weekStart !== weekStart);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Weekly review</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {formatWeekRange(weekStart)} — here&apos;s what your week actually
          looked like.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Tasks">
          <p>
            <span className="text-xl font-bold tabular-nums">
              {stats.tasksCompleted.length}
            </span>{" "}
            completed
            {stats.overdueNow > 0 && (
              <span className="text-red-500"> · {stats.overdueNow} overdue</span>
            )}
          </p>
          {stats.tasksCompleted.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-black/50 dark:text-white/50">
              {stats.tasksCompleted.slice(0, 4).map((t, i) => (
                <li key={i} className="truncate">
                  ✓ {t.title}
                </li>
              ))}
              {stats.tasksCompleted.length > 4 && (
                <li>…and {stats.tasksCompleted.length - 4} more</li>
              )}
            </ul>
          )}
        </Stat>

        <Stat label="Habits">
          {stats.habits.length === 0 ? (
            <p className="text-black/45 dark:text-white/45">No habits yet.</p>
          ) : (
            <ul className="space-y-1">
              {stats.habits.map((h) => (
                <li key={h.title} className="flex items-center justify-between gap-2">
                  <span className="truncate">{h.title}</span>
                  <span
                    className={`tabular-nums text-xs ${
                      h.days >= 6
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : h.days >= 3
                          ? "text-black/60 dark:text-white/60"
                          : "text-red-500"
                    }`}
                  >
                    {h.days}/7
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Stat>

        <Stat label="Mood & journal">
          {stats.journalDays === 0 ? (
            <p className="text-black/45 dark:text-white/45">
              No journal entries this week.
            </p>
          ) : (
            <p>
              {stats.avgMood !== null && (
                <span className="mr-1 text-xl">
                  {MOODS[Math.round(stats.avgMood) - 1]}
                </span>
              )}
              journaled{" "}
              <span className="font-bold tabular-nums">{stats.journalDays}</span>
              /7 days
            </p>
          )}
        </Stat>

        <Stat label="Money">
          <p>
            <span className="text-xl font-bold tabular-nums">
              {formatSGD(stats.moneyTotal)}
            </span>{" "}
            spent
            {stats.topCategory && (
              <span className="text-black/50 dark:text-white/50">
                {" "}
                · mostly {stats.topCategory}
              </span>
            )}
          </p>
        </Stat>

        <Stat label="Body">
          <p>
            <span className="font-bold tabular-nums">{stats.workouts}</span>{" "}
            workouts
            {stats.avgSleep !== null && (
              <> · {stats.avgSleep.toFixed(1)}h avg sleep</>
            )}
            {stats.weightDelta !== null && (
              <>
                {" "}
                · {stats.weightDelta > 0 ? "+" : ""}
                {stats.weightDelta.toFixed(1)}kg
              </>
            )}
          </p>
        </Stat>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Reflection
          </h2>
          <Link href="/assistant" className="text-xs text-black/45 underline-offset-2 hover:underline dark:text-white/45">draft with Assistant</Link>
        </div>
        <form action={saveReview} className="space-y-3">
          {PROMPTS.map((p) => (
            <label key={p.name} className="block">
              <span className="text-sm font-medium">{p.label}</span>
              <textarea
                name={p.name}
                rows={2}
                defaultValue={review?.[p.name] ?? ""}
                className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
              />
            </label>
          ))}
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
          >
            {review ? "Update review" : "Save review"}
          </button>
        </form>
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Past weeks
          </h2>
          {past.map((r) => (
            <article
              key={r.entryId}
              className="space-y-1 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10"
            >
              <p className="text-xs font-medium text-black/45 dark:text-white/45">
                {formatWeekRange(r.weekStart)}
              </p>
              {r.wins && <p>👍 {r.wins}</p>}
              {r.challenges && <p>👎 {r.challenges}</p>}
              {r.focus && <p>🎯 {r.focus}</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
import Link from "next/link";
