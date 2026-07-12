import Link from "next/link";
import { getCurrentUser } from "@/lib/user";
import { getTodayData, MOODS } from "@/lib/data";
import { TIMEZONE } from "@/lib/dates";
import { ProgressRing } from "@/components/progress-ring";
import { TaskRow } from "@/components/task-row";
import { HabitRow } from "@/components/habit-row";
import { QuickAddTask } from "@/components/quick-add-task";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nudge(done: number, total: number) {
  const left = total - done;
  if (total <= 1) return "Add a task or a habit to start your day.";
  if (left === 0) return "Perfect day — everything done. 🎉";
  if (done === 0) return `${left} things today. First one's the hardest.`;
  if (left === 1) return "One left. Finish the day strong.";
  return `${left} to go — keep it moving.`;
}

export default async function TodayPage() {
  const user = await getCurrentUser();
  const data = await getTodayData(user.id);
  const { taskGroups, habits, journal, score } = data;

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-SG", {
      timeZone: TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const dateLabel = now.toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const openTasks = [...taskGroups.overdue, ...taskGroups.today];
  const perfect = score.total > 1 && score.done >= score.total;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">{dateLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(hour)}, {user.name}
          </h1>
          <p
            className={`mt-1 text-sm ${
              perfect
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "text-black/50 dark:text-white/50"
            }`}
          >
            {nudge(score.done, score.total)}
          </p>
        </div>
        <ProgressRing done={score.done} total={score.total} />
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Tasks
        </h2>
        <QuickAddTask defaultDueToday />
        {openTasks.length === 0 && taskGroups.doneToday.length === 0 ? (
          <p className="px-2 py-1 text-sm text-black/45 dark:text-white/45">
            Nothing on the list for today.
          </p>
        ) : (
          <div>
            {openTasks.map((t) => (
              <TaskRow key={t.taskId} task={t} />
            ))}
            {taskGroups.doneToday.map((t) => (
              <TaskRow key={t.taskId} task={t} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Habits
          </h2>
          <Link
            href="/habits"
            className="text-xs text-black/45 underline-offset-2 hover:underline dark:text-white/45"
          >
            manage
          </Link>
        </div>
        {habits.length === 0 ? (
          <p className="px-2 py-1 text-sm text-black/45 dark:text-white/45">
            No habits yet.{" "}
            <Link href="/habits" className="underline underline-offset-2">
              Create your first
            </Link>{" "}
            and start a streak.
          </p>
        ) : (
          <div>
            {habits.map((h) => (
              <HabitRow key={h.habitId} habit={h} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Journal
        </h2>
        {journal ? (
          <Link
            href="/journal"
            className="block rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
          >
            <p className="text-sm">
              {journal.mood && (
                <span className="mr-2">{MOODS[journal.mood - 1]}</span>
              )}
              <span className="text-black/70 dark:text-white/70">
                {journal.note.length > 140
                  ? `${journal.note.slice(0, 140)}…`
                  : journal.note || "Mood logged."}
              </span>
            </p>
            <p className="mt-1 text-xs text-black/45 dark:text-white/45">
              Written ✓ — tap to edit
            </p>
          </Link>
        ) : (
          <Link
            href="/journal"
            className="block rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/50 transition-colors hover:bg-black/[.02] dark:border-white/15 dark:text-white/50 dark:hover:bg-white/[.03]"
          >
            How was today? Take 60 seconds to close the day →
          </Link>
        )}
      </section>
    </div>
  );
}
