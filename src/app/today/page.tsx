import Link from "next/link";
import { getCurrentUser } from "@/lib/user";
import { getTodayData, MOODS } from "@/lib/data";
import { formatSGD, getSubscriptions } from "@/lib/money";
import { getReviewForWeek, reviewDue, weekStartKey } from "@/lib/review";
import { formatDay, formatTime, isSunday, TIMEZONE, todayKey } from "@/lib/dates";
import { ProgressRing } from "@/components/progress-ring";
import { TaskRow } from "@/components/task-row";
import { HabitRow } from "@/components/habit-row";
import { QuickCapture } from "@/components/quick-capture";
import { NotificationControl } from "@/components/notification-control";
import { getPlanningBrief } from "@/lib/calendar";
import { DatabaseZap, Search as SearchIcon } from "lucide-react";
import { getLifeAdminBrief } from "@/lib/life-admin";

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
  const [data, subs, weekReview, planning, lifeAdmin] = await Promise.all([
    getTodayData(user.id),
    getSubscriptions(user.id),
    getReviewForWeek(user.id, weekStartKey(todayKey())),
    getPlanningBrief(user.id),
    getLifeAdminBrief(user.id),
  ]);
  const { taskGroups, habits, journal, score } = data;
  const renewingSoon = subs.list.filter((s) => s.daysUntil <= 7);
  const promptReview = reviewDue() && !weekReview;
  const promptMealPlan = isSunday();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

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
        <div className="flex items-center gap-3">
          <Link
            href="/import"
            aria-label="Import data"
            className="rounded-lg p-2 text-black/45 hover:bg-black/5 hover:text-black dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <DatabaseZap size={17} />
          </Link>
          <Link
            href="/search"
            aria-label="Search Megaapp"
            className="rounded-lg p-2 text-black/45 hover:bg-black/5 hover:text-black dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <SearchIcon size={17} />
          </Link>
          <ProgressRing key={`${score.done}-${score.total}`} done={score.done} total={score.total} />
        </div>
      </header>

      <QuickCapture />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Agenda
          </h2>
          <Link href="/calendar" className="text-xs text-black/45 underline-offset-2 hover:underline dark:text-white/45">
            calendar
          </Link>
        </div>
        {planning.agenda.length === 0 ? (
          <Link href="/calendar" className="block rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-black/45 dark:border-white/15 dark:text-white/45">
            Nothing scheduled today — add an event →
          </Link>
        ) : (
          <div className="space-y-1">
            {planning.agenda.slice(0, 3).map((event) => (
              <Link key={event.itemId} href="/calendar" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/[.03] dark:hover:bg-white/[.04]">
                <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-black/50 dark:text-white/50">
                  {event.allDay ? "All day" : formatTime(event.start)}
                </span>
                <span className="truncate text-sm font-medium">{event.title}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {planning.topGoal && (
        <Link href="/goals" className="block rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">Current goal</p>
              <p className="mt-1 font-medium">{planning.topGoal.title}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {planning.topGoal.done}/{planning.topGoal.total || 0}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${planning.topGoal.total ? (planning.topGoal.done / planning.topGoal.total) * 100 : 0}%` }}
            />
          </div>
        </Link>
      )}

      {(lifeAdmin.nextTrip || lifeAdmin.nextBirthday || lifeAdmin.dueMaintenance || lifeAdmin.staleContact) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Life admin</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {lifeAdmin.nextTrip && <Link href="/travel" className="rounded-xl border border-black/10 p-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"><p className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Next trip</p><p className="mt-1 font-medium">{lifeAdmin.nextTrip.title}</p><p className="text-xs text-black/50 dark:text-white/50">{formatDay(lifeAdmin.nextTrip.startDate)} · {lifeAdmin.nextTrip.packed}/{lifeAdmin.nextTrip.total} packed</p></Link>}
            {lifeAdmin.nextBirthday && <Link href="/people" className="rounded-xl border border-black/10 p-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"><p className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Birthday</p><p className="mt-1 font-medium">{lifeAdmin.nextBirthday.name}</p><p className="text-xs text-black/50 dark:text-white/50">{formatDay(lifeAdmin.nextBirthday.key)} · {lifeAdmin.nextBirthday.daysUntil === 0 ? "today" : `${lifeAdmin.nextBirthday.daysUntil}d`}</p></Link>}
            {lifeAdmin.dueMaintenance && <Link href="/home" className="rounded-xl border border-amber-500/25 bg-amber-500/[.04] p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Maintenance</p><p className="mt-1 font-medium">{lifeAdmin.dueMaintenance.title}</p><p className="text-xs text-black/50 dark:text-white/50">{lifeAdmin.dueMaintenance.daysUntil < 0 ? `${-lifeAdmin.dueMaintenance.daysUntil}d overdue` : formatDay(lifeAdmin.dueMaintenance.dueDate)}</p></Link>}
            {lifeAdmin.staleContact && <Link href="/people" className="rounded-xl border border-black/10 p-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"><p className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Reconnect</p><p className="mt-1 font-medium">Message {lifeAdmin.staleContact.name}</p><p className="text-xs text-black/50 dark:text-white/50">{lifeAdmin.staleContact.days} days since last contact</p></Link>}
          </div>
        </section>
      )}

      {vapidPublicKey && (
        <NotificationControl vapidPublicKey={vapidPublicKey} />
      )}

      {promptReview && (
        <Link
          href="/review"
          className="block rounded-xl border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
        >
          <span className="font-medium">🗓️ Close out the week</span>{" "}
          <span className="text-black/50 dark:text-white/50">
            — your weekly review is drafted from this week&apos;s data, just add
            three thoughts →
          </span>
        </Link>
      )}

      {promptMealPlan && (
        <Link
          href="/meals"
          className="block rounded-xl border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
        >
          <span className="font-medium">🍽️ Plan the week&apos;s dinners</span>{" "}
          <span className="text-black/50 dark:text-white/50">
            — choose seven meals and turn them into one grocery list →
          </span>
        </Link>
      )}

      {renewingSoon.length > 0 && (
        <Link
          href="/money"
          className="block rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm transition-colors hover:bg-amber-500/10"
        >
          <span className="font-medium text-amber-700 dark:text-amber-400">
            💳 Coming up:
          </span>{" "}
          {renewingSoon
            .map(
              (s) =>
                `${s.name} ${formatSGD(s.amount)} ${
                  s.daysUntil < 0
                    ? `(overdue ${-s.daysUntil}d)`
                    : s.daysUntil === 0
                      ? "(today)"
                      : `(in ${s.daysUntil}d)`
                }`,
            )
            .join(" · ")}
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Tasks
        </h2>
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

      <Link
        href="/insights"
        className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
      >
        <span>
          <span className="font-medium">See what your data is revealing</span>{" "}
          <span className="text-black/50 dark:text-white/50">— 12 weeks of patterns</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <Link
        href="/assistant"
        className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
      >
        <span>
          <span className="font-medium">Ask your personal planning assistant</span>{" "}
          <span className="text-black/50 dark:text-white/50">— read-only answers from your data</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <Link
        href="/lists"
        className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
      >
        <span>
          <span className="font-medium">Choose what to read or watch next</span>{" "}
          <span className="text-black/50 dark:text-white/50">— your backlog</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
