import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  addDays,
  dayEnd,
  dayKey,
  dayNoon,
  dayStart,
  todayKey,
} from "@/lib/dates";
import { getActiveTasks, groupTasks } from "@/lib/data";

/** Monday of the week containing `key` (weeks run Mon–Sun, SG time). */
export function weekStartKey(key: string): string {
  const dow = dayNoon(key).getUTCDay(); // weekday of the calendar date
  return addDays(key, -((dow + 6) % 7));
}

export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const fmt = (k: string) =>
    dayNoon(k).toLocaleDateString("en-SG", {
      timeZone: "Asia/Singapore",
      day: "numeric",
      month: "short",
    });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export type WeekStats = {
  weekStart: string;
  tasksCompleted: { title: string; day: string }[];
  overdueNow: number;
  habits: { title: string; days: number }[];
  journalDays: number;
  avgMood: number | null;
  moneyTotal: number;
  topCategory: string | null;
  workouts: number;
  avgSleep: number | null;
  weightDelta: number | null;
};

export async function getWeekStats(
  userId: string,
  weekStart: string,
): Promise<WeekStats> {
  const db = await getDb();
  const start = dayStart(weekStart);
  const end = dayEnd(addDays(weekStart, 6));

  const [entries, activeTasks, habitItems] = await Promise.all([
    db
      .select()
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.userId, userId),
          gte(schema.entries.occurredAt, start),
          lte(schema.entries.occurredAt, end),
        ),
      ),
    getActiveTasks(userId),
    db
      .select({ id: schema.items.id, title: schema.items.title })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "habits"),
          eq(schema.items.status, "active"),
        ),
      ),
  ]);

  // Titles for completed tasks (item may since be deleted → skip).
  const completedTaskIds = [
    ...new Set(
      entries
        .filter((e) => e.module === "tasks" && e.type === "completed" && e.itemId)
        .map((e) => e.itemId as string),
    ),
  ];
  const taskItems = completedTaskIds.length
    ? await db
        .select({ id: schema.items.id, title: schema.items.title })
        .from(schema.items)
        .where(inArray(schema.items.id, completedTaskIds))
    : [];
  const titleById = new Map(taskItems.map((t) => [t.id, t.title]));

  const tasksCompleted = entries
    .filter((e) => e.module === "tasks" && e.type === "completed" && e.itemId)
    .map((e) => ({
      title: titleById.get(e.itemId as string),
      day: dayKey(e.occurredAt),
    }))
    .filter((t): t is { title: string; day: string } => t.title !== undefined)
    .sort((a, b) => a.day.localeCompare(b.day));

  // Habit adherence: distinct checked days per habit within the week.
  const habitDays = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.module !== "habits" || e.type !== "checkin" || !e.itemId) continue;
    const set = habitDays.get(e.itemId) ?? new Set<string>();
    set.add(dayKey(e.occurredAt));
    habitDays.set(e.itemId, set);
  }
  const habits = habitItems.map((h) => ({
    title: h.title,
    days: habitDays.get(h.id)?.size ?? 0,
  }));

  const journalEntries = entries.filter(
    (e) => e.module === "journal" && e.type === "journal",
  );
  const moods = journalEntries
    .map((e) => (e.payload as { mood?: number }).mood)
    .filter((m): m is number => typeof m === "number");

  const expenses = entries.filter(
    (e) => e.module === "money" && e.type === "expense",
  );
  const moneyTotal = expenses.reduce((s, e) => s + Number(e.value ?? 0), 0);
  const catTotals = new Map<string, number>();
  if (expenses.length) {
    const txs = await db
      .select()
      .from(schema.transactions)
      .where(
        inArray(
          schema.transactions.entryId,
          expenses.map((e) => e.id),
        ),
      );
    for (const t of txs) {
      const c = t.category ?? "other";
      catTotals.set(c, (catTotals.get(c) ?? 0) + Number(t.amount));
    }
  }
  const topCategory =
    [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sleeps = entries
    .filter((e) => e.module === "health" && e.type === "sleep" && e.value !== null)
    .map((e) => Number(e.value));
  const weights = entries
    .filter((e) => e.module === "health" && e.type === "weight" && e.value !== null)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((e) => Number(e.value));

  return {
    weekStart,
    tasksCompleted,
    overdueNow: groupTasks(activeTasks).overdue.length,
    habits,
    journalDays: new Set(journalEntries.map((e) => dayKey(e.occurredAt))).size,
    avgMood: moods.length
      ? moods.reduce((s, m) => s + m, 0) / moods.length
      : null,
    moneyTotal,
    topCategory,
    workouts: entries.filter(
      (e) => e.module === "health" && e.type === "workout",
    ).length,
    avgSleep: sleeps.length
      ? sleeps.reduce((s, h) => s + h, 0) / sleeps.length
      : null,
    weightDelta:
      weights.length > 1 ? weights[weights.length - 1] - weights[0] : null,
  };
}

// ---------------------------------------------------------------------------
// The saved reflection — one entries row per week (module review).
// ---------------------------------------------------------------------------

export type ReviewPayload = {
  weekStart: string;
  wins: string;
  challenges: string;
  focus: string;
};

export type ReviewView = ReviewPayload & { entryId: string };

export async function getReviewForWeek(
  userId: string,
  weekStart: string,
): Promise<ReviewView | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "review"),
        eq(schema.entries.type, "weekly"),
        gte(schema.entries.occurredAt, dayStart(weekStart)),
        lte(schema.entries.occurredAt, dayEnd(addDays(weekStart, 6))),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { entryId: row.id, ...(row.payload as ReviewPayload) };
}

export async function getRecentReviews(
  userId: string,
  limit = 8,
): Promise<ReviewView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "review"),
        eq(schema.entries.type, "weekly"),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt))
    .limit(limit);
  return rows.map((r) => ({ entryId: r.id, ...(r.payload as ReviewPayload) }));
}

/** The Today card prompts the review on Saturday and Sunday. */
export function reviewDue(today = todayKey()): boolean {
  const dow = dayNoon(today).getUTCDay();
  return dow === 6 || dow === 0;
}
