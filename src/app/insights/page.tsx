import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getInsights, INSIGHT_WINDOW_DAYS, type Relationship } from "@/lib/insights";
import { formatSGD } from "@/lib/money";
import {
  HabitHeatmap,
  RelationshipChart,
  WeeklySpendChart,
} from "@/components/insight-charts";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

function relationshipLabel(relationship: Relationship) {
  if (relationship.samples < 5) {
    return `Keep logging — ${5 - relationship.samples} more matched day${relationship.samples === 4 ? "" : "s"} for a first comparison.`;
  }
  if (relationship.coefficient === null) return "Not enough variation yet.";
  const strength = Math.abs(relationship.coefficient);
  if (strength < 0.25) return "No clear relationship in this window.";
  const direction = relationship.coefficient > 0 ? "positive" : "inverse";
  return `${strength >= 0.5 ? "Strong" : "Modest"} ${direction} pattern across ${relationship.samples} matched days.`;
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 px-6 text-center text-sm text-black/45 dark:border-white/10 dark:text-white/45">
      {children}
    </div>
  );
}

export default async function InsightsPage() {
  const user = await getCurrentUser();
  const data = await getInsights(user.id);
  const sleepHours = data.sleepMood.points.map((point) => point.x);
  const sleepMin = sleepHours.length ? Math.max(0, Math.floor(Math.min(...sleepHours) - 1)) : 4;
  const sleepMax = sleepHours.length ? Math.ceil(Math.max(...sleepHours) + 1) : 10;
  const totalSpend = data.weeklySpend.reduce((sum, week) => sum + week.amount, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Patterns from your last {INSIGHT_WINDOW_DAYS} days — clues, never verdicts.
        </p>
      </header>

      <section
        className={`rounded-xl border p-5 ${
          data.headline.tone === "emerald"
            ? "border-emerald-500/30 bg-emerald-500/[.06]"
            : "border-black/10 dark:border-white/10"
        }`}
      >
        <div className="flex items-start gap-3">
          <Lightbulb
            size={20}
            className={
              data.headline.tone === "emerald"
                ? "mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                : "mt-0.5 shrink-0 text-amber-500"
            }
          />
          <div>
            <p className="font-semibold">{data.headline.title}</p>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {data.headline.detail}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Habit consistency
            </h2>
            <p className="mt-1 text-xs text-black/45 dark:text-white/45">
              Each square is one day; darker means more of your active habits were done.
            </p>
          </div>
          <Link
            href="/habits"
            className="text-xs text-black/45 underline-offset-2 hover:underline dark:text-white/45"
          >
            manage habits
          </Link>
        </div>
        <HabitHeatmap days={data.heatmap} />
        {data.habits.length > 0 ? (
          <div className="grid gap-2 border-t border-black/10 pt-3 sm:grid-cols-2 dark:border-white/10">
            {data.habits.slice(0, 4).map((habit) => (
              <div key={habit.itemId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-black/65 dark:text-white/65">{habit.title}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {Math.round(habit.rate * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/45 dark:text-white/45">
            Create a small daily habit to start the consistency map.
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Weekly spend
            </h2>
            <span className="text-xs tabular-nums text-black/45 dark:text-white/45">
              {formatSGD(totalSpend)} / 8 weeks
            </span>
          </div>
          <WeeklySpendChart weeks={data.weeklySpend} />
          <p className="text-xs text-black/45 dark:text-white/45">
            The emerald bar is the current partial week.
          </p>
        </article>

        <article className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Mood &amp; habits
          </h2>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            Journal mood compared with habit completion on the same day.
          </p>
          {data.moodHabit.points.length >= 2 ? (
            <RelationshipChart
              points={data.moodHabit.points.map((point) => ({ ...point, x: point.x * 100 }))}
              xMin={0}
              xMax={100}
              xStartLabel="0%"
              xEndLabel="100%"
              xLabel="habit completion"
            />
          ) : (
            <EmptyChart>Log moods and habit check-ins on the same days to reveal this pattern.</EmptyChart>
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            {relationshipLabel(data.moodHabit)}
          </p>
        </article>

        <article className="rounded-xl border border-black/10 p-4 lg:col-span-2 dark:border-white/10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Sleep → next-day mood
          </h2>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            Sleep logged on one day matched to your journal mood the following day.
          </p>
          {data.sleepMood.points.length >= 2 ? (
            <RelationshipChart
              points={data.sleepMood.points}
              xMin={sleepMin}
              xMax={sleepMax}
              xStartLabel={`${sleepMin}h`}
              xEndLabel={`${sleepMax}h`}
              xLabel="hours of sleep"
            />
          ) : (
            <EmptyChart>
              Log sleep and tomorrow&apos;s mood for a few nights to compare them.
            </EmptyChart>
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            {relationshipLabel(data.sleepMood)}
          </p>
        </article>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 text-xs text-black/45 dark:border-white/10 dark:text-white/45">
        <span>
          Coverage: {data.coverage.moodDays} mood days · {data.coverage.sleepNights} sleep nights · {data.coverage.expenses} expenses · {data.coverage.habitCheckins} habit check-ins
        </span>
        <Link href="/today" className="flex items-center gap-1 font-medium hover:text-black dark:hover:text-white">
          Keep logging <ArrowRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
