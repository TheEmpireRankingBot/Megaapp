"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/user";
import {
  dayEnd,
  dayKey,
  dayNoon,
  dayStart,
  nextDueKey,
  todayKey,
} from "@/lib/dates";
import { computeCurrentStreak } from "@/lib/data";

const MODULE_PATHS = ["/today", "/tasks", "/habits", "/journal"];
function revalidateAll() {
  for (const p of MODULE_PATHS) revalidatePath(p);
}

type Recurrence = "daily" | "weekly" | "monthly";
function parseRecurrence(v: FormDataEntryValue | null): Recurrence | null {
  return v === "daily" || v === "weekly" || v === "monthly" ? v : null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const due = String(formData.get("due") ?? "").trim(); // YYYY-MM-DD or ""
  const recurrence = parseRecurrence(formData.get("recurrence"));
  const priority = formData.get("priority") === "on" ? 1 : 0;

  const user = await getCurrentUser();
  const db = await getDb();
  const [item] = await db
    .insert(schema.items)
    .values({ userId: user.id, module: "tasks", type: "task", title })
    .returning();
  await db.insert(schema.tasks).values({
    itemId: item.id,
    dueAt: due ? dayNoon(due) : recurrence ? dayNoon(todayKey()) : null,
    recurrence,
    priority,
  });
  revalidateAll();
}

export async function toggleTask(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  const user = await getCurrentUser();
  const db = await getDb();

  const [row] = await db
    .select({
      task: schema.tasks,
      item: schema.items,
    })
    .from(schema.tasks)
    .innerJoin(schema.items, eq(schema.tasks.itemId, schema.items.id))
    .where(and(eq(schema.tasks.id, taskId), eq(schema.items.userId, user.id)))
    .limit(1);
  if (!row) return;

  const today = todayKey();
  const todaysCompletion = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        eq(schema.entries.module, "tasks"),
        eq(schema.entries.type, "completed"),
        eq(schema.entries.itemId, row.item.id),
        gte(schema.entries.occurredAt, dayStart(today)),
        lte(schema.entries.occurredAt, dayEnd(today)),
      ),
    )
    .limit(1);

  const alreadyDone = row.task.doneAt !== null || todaysCompletion.length > 0;

  if (alreadyDone) {
    // Undo. For recurring tasks, roll the due date back to what it was
    // before completion (stored on the completion entry).
    if (todaysCompletion.length > 0) {
      const payload = todaysCompletion[0].payload as { prevDueKey?: string };
      if (row.task.recurrence && payload.prevDueKey) {
        await db
          .update(schema.tasks)
          .set({ dueAt: dayNoon(payload.prevDueKey) })
          .where(eq(schema.tasks.id, taskId));
      }
      await db
        .delete(schema.entries)
        .where(eq(schema.entries.id, todaysCompletion[0].id));
    }
    await db
      .update(schema.tasks)
      .set({ doneAt: null })
      .where(eq(schema.tasks.id, taskId));
  } else {
    const prevDueKey = row.task.dueAt ? dayKey(row.task.dueAt) : null;
    if (row.task.recurrence) {
      // Completion advances the due date past today, anchored to the
      // original schedule; the task itself stays open.
      let next = prevDueKey ?? today;
      while (next <= today) {
        next = nextDueKey(next, row.task.recurrence as Recurrence);
      }
      await db
        .update(schema.tasks)
        .set({ dueAt: dayNoon(next) })
        .where(eq(schema.tasks.id, taskId));
    } else {
      await db
        .update(schema.tasks)
        .set({ doneAt: new Date() })
        .where(eq(schema.tasks.id, taskId));
    }
    await db.insert(schema.entries).values({
      userId: user.id,
      module: "tasks",
      type: "completed",
      occurredAt: new Date(),
      itemId: row.item.id,
      payload: prevDueKey ? { prevDueKey } : {},
    });
  }
  revalidateAll();
}

export async function deleteTask(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .delete(schema.items)
    .where(and(eq(schema.items.id, itemId), eq(schema.items.userId, user.id)));
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export async function createHabit(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [item] = await db
    .insert(schema.items)
    .values({ userId: user.id, module: "habits", type: "habit", title })
    .returning();
  await db.insert(schema.habits).values({ itemId: item.id });
  revalidateAll();
}

export async function toggleHabit(formData: FormData) {
  const habitId = String(formData.get("habitId") ?? "");
  if (!habitId) return;
  const user = await getCurrentUser();
  const db = await getDb();

  const [row] = await db
    .select({ habit: schema.habits, item: schema.items })
    .from(schema.habits)
    .innerJoin(schema.items, eq(schema.habits.itemId, schema.items.id))
    .where(and(eq(schema.habits.id, habitId), eq(schema.items.userId, user.id)))
    .limit(1);
  if (!row) return;

  const today = todayKey();
  const existing = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        eq(schema.entries.module, "habits"),
        eq(schema.entries.type, "checkin"),
        eq(schema.entries.itemId, row.item.id),
        gte(schema.entries.occurredAt, dayStart(today)),
        lte(schema.entries.occurredAt, dayEnd(today)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.entries).where(eq(schema.entries.id, existing[0].id));
  } else {
    await db.insert(schema.entries).values({
      userId: user.id,
      module: "habits",
      type: "checkin",
      occurredAt: new Date(),
      itemId: row.item.id,
    });
  }

  // Refresh the streak cache (best is monotonic; current is display-only
  // but cheap to keep roughly right).
  const checkins = await db
    .select({ occurredAt: schema.entries.occurredAt })
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        eq(schema.entries.module, "habits"),
        eq(schema.entries.type, "checkin"),
        eq(schema.entries.itemId, row.item.id),
      ),
    );
  const days = new Set(checkins.map((c) => dayKey(c.occurredAt)));
  const current = computeCurrentStreak(days, today);
  await db
    .update(schema.habits)
    .set({
      streakCurrent: current,
      streakBest: Math.max(row.habit.streakBest, current),
    })
    .where(eq(schema.habits.id, habitId));

  revalidateAll();
}

export async function archiveHabit(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .update(schema.items)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(schema.items.id, itemId), eq(schema.items.userId, user.id)));
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export async function saveJournal(formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  const moodRaw = formData.get("mood");
  const mood = moodRaw ? Number(moodRaw) : null;
  if (!note && !mood) return;

  const user = await getCurrentUser();
  const db = await getDb();
  const today = todayKey();

  const existing = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        eq(schema.entries.module, "journal"),
        eq(schema.entries.type, "journal"),
        gte(schema.entries.occurredAt, dayStart(today)),
        lte(schema.entries.occurredAt, dayEnd(today)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const prev = existing[0].payload as { mood?: number };
    await db
      .update(schema.entries)
      .set({ note, payload: { mood: mood ?? prev.mood } })
      .where(eq(schema.entries.id, existing[0].id));
  } else {
    await db.insert(schema.entries).values({
      userId: user.id,
      module: "journal",
      type: "journal",
      occurredAt: new Date(),
      note,
      payload: mood ? { mood } : {},
    });
  }
  revalidateAll();
}
