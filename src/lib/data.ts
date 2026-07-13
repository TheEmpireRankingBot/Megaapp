import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  addDays,
  dayEnd,
  dayKey,
  dayStart,
  lastNDays,
  todayKey,
} from "@/lib/dates";

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskView = {
  taskId: string;
  itemId: string;
  title: string;
  dueKey: string | null;
  recurrence: string | null;
  priority: number;
  done: boolean;
  completedToday: boolean;
};

export async function getActiveTasks(userId: string): Promise<TaskView[]> {
  const db = await getDb();
  const today = todayKey();

  const [rows, completions] = await Promise.all([
    db
      .select({
        taskId: schema.tasks.id,
        itemId: schema.items.id,
        title: schema.items.title,
        dueAt: schema.tasks.dueAt,
        recurrence: schema.tasks.recurrence,
        priority: schema.tasks.priority,
        doneAt: schema.tasks.doneAt,
      })
      .from(schema.tasks)
      .innerJoin(schema.items, eq(schema.tasks.itemId, schema.items.id))
      .where(
        and(eq(schema.items.userId, userId), eq(schema.items.status, "active")),
      ),
    // Which tasks were completed today (covers recurring tasks, whose doneAt
    // stays null because completion just advances the due date).
    db
      .select({ itemId: schema.entries.itemId })
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.userId, userId),
          eq(schema.entries.module, "tasks"),
          eq(schema.entries.type, "completed"),
          gte(schema.entries.occurredAt, dayStart(today)),
          lte(schema.entries.occurredAt, dayEnd(today)),
          isNotNull(schema.entries.itemId),
        ),
      ),
  ]);
  const completedTodayIds = new Set(completions.map((c) => c.itemId));

  return rows.map((r) => ({
    taskId: r.taskId,
    itemId: r.itemId,
    title: r.title,
    dueKey: r.dueAt ? dayKey(r.dueAt) : null,
    recurrence: r.recurrence,
    priority: r.priority,
    done: r.doneAt !== null,
    completedToday: completedTodayIds.has(r.itemId),
  }));
}

export type TaskGroups = {
  overdue: TaskView[];
  today: TaskView[];
  upcoming: TaskView[];
  someday: TaskView[];
  doneToday: TaskView[];
};

export function groupTasks(tasks: TaskView[]): TaskGroups {
  const today = todayKey();
  const open = tasks.filter((t) => !t.done);
  const byPriority = (a: TaskView, b: TaskView) =>
    b.priority - a.priority ||
    (a.dueKey ?? "9999").localeCompare(b.dueKey ?? "9999");

  return {
    overdue: open
      .filter((t) => t.dueKey !== null && t.dueKey < today && !t.completedToday)
      .sort(byPriority),
    today: open
      .filter((t) => t.dueKey === today && !t.completedToday)
      .sort(byPriority),
    upcoming: open
      .filter((t) => t.dueKey !== null && t.dueKey > today)
      .sort(byPriority),
    someday: open
      .filter((t) => t.dueKey === null && !t.completedToday)
      .sort(byPriority),
    doneToday: tasks.filter((t) => t.completedToday).sort(byPriority),
  };
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export type HabitView = {
  habitId: string;
  itemId: string;
  title: string;
  checkedToday: boolean;
  streakCurrent: number;
  streakBest: number;
  last7: { day: string; checked: boolean }[];
};

/** Consecutive checked days ending today (or yesterday — today isn't a miss
 *  until it's over). */
export function computeCurrentStreak(
  checkedDays: Set<string>,
  today: string,
): number {
  let streak = 0;
  let cursor = checkedDays.has(today) ? today : addDays(today, -1);
  while (checkedDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getHabits(userId: string): Promise<HabitView[]> {
  const db = await getDb();
  const today = todayKey();
  const windowStart = dayStart(addDays(today, -120));

  const [rows, checkins] = await Promise.all([
    db
      .select({
        habitId: schema.habits.id,
        itemId: schema.items.id,
        title: schema.items.title,
        streakBest: schema.habits.streakBest,
        createdAt: schema.items.createdAt,
      })
      .from(schema.habits)
      .innerJoin(schema.items, eq(schema.habits.itemId, schema.items.id))
      .where(
        and(eq(schema.items.userId, userId), eq(schema.items.status, "active")),
      ),
    db
      .select({
        itemId: schema.entries.itemId,
        occurredAt: schema.entries.occurredAt,
      })
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.userId, userId),
          eq(schema.entries.module, "habits"),
          eq(schema.entries.type, "checkin"),
          gte(schema.entries.occurredAt, windowStart),
        ),
      ),
  ]);

  const byHabit = new Map<string, Set<string>>();
  for (const c of checkins) {
    if (!c.itemId) continue;
    const set = byHabit.get(c.itemId) ?? new Set<string>();
    set.add(dayKey(c.occurredAt));
    byHabit.set(c.itemId, set);
  }

  const week = lastNDays(7);
  return rows
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => {
      const checked = byHabit.get(r.itemId) ?? new Set<string>();
      const current = computeCurrentStreak(checked, today);
      return {
        habitId: r.habitId,
        itemId: r.itemId,
        title: r.title,
        checkedToday: checked.has(today),
        streakCurrent: current,
        streakBest: Math.max(r.streakBest, current),
        last7: week.map((day) => ({ day, checked: checked.has(day) })),
      };
    });
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export type JournalView = {
  entryId: string;
  day: string;
  note: string;
  mood: number | null;
};

export const MOODS = ["😞", "😕", "😐", "🙂", "😄"] as const;

export async function getJournalForDay(
  userId: string,
  day: string,
): Promise<JournalView | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "journal"),
        eq(schema.entries.type, "journal"),
        gte(schema.entries.occurredAt, dayStart(day)),
        lte(schema.entries.occurredAt, dayEnd(day)),
      ),
    )
    .limit(1);
  if (!row) return null;
  const payload = row.payload as { mood?: number };
  return {
    entryId: row.id,
    day: dayKey(row.occurredAt),
    note: row.note ?? "",
    mood: payload.mood ?? null,
  };
}

export async function getRecentJournal(
  userId: string,
  limit = 14,
): Promise<JournalView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "journal"),
        eq(schema.entries.type, "journal"),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt))
    .limit(limit);
  return rows.map((row) => {
    const payload = row.payload as { mood?: number };
    return {
      entryId: row.id,
      day: dayKey(row.occurredAt),
      note: row.note ?? "",
      mood: payload.mood ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Today dashboard — the sticky loop in one query bundle.
// ---------------------------------------------------------------------------

export type TodayData = {
  taskGroups: TaskGroups;
  habits: HabitView[];
  journal: JournalView | null;
  /** Day score: habits checked + tasks done + journal written, over totals. */
  score: { done: number; total: number };
};

export async function getTodayData(userId: string): Promise<TodayData> {
  const [tasks, habits, journal] = await Promise.all([
    getActiveTasks(userId),
    getHabits(userId),
    getJournalForDay(userId, todayKey()),
  ]);
  const taskGroups = groupTasks(tasks);

  const taskTotal =
    taskGroups.overdue.length +
    taskGroups.today.length +
    taskGroups.doneToday.length;
  const done =
    taskGroups.doneToday.length +
    habits.filter((h) => h.checkedToday).length +
    (journal ? 1 : 0);
  const total = taskTotal + habits.length + 1; // +1 = today's journal

  return { taskGroups, habits, journal, score: { done, total } };
}
