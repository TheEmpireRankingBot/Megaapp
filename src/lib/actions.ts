"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/user";
import {
  dayEnd,
  dayKey,
  dayNoon,
  dayStart,
  nextDueKey,
  nextRenewalKey,
  todayKey,
} from "@/lib/dates";
import { computeCurrentStreak } from "@/lib/data";
import { parseCapture } from "@/lib/capture";
import {
  getActiveGroceryList,
  getMealPlanForWeek,
  mealPlanDays,
  type GroceryItem,
  type RecipePayload,
} from "@/lib/meals";
import { weekStartKey } from "@/lib/review";
import { sendPush } from "@/lib/notifications";

const MODULE_PATHS = [
  "/today",
  "/tasks",
  "/habits",
  "/journal",
  "/money",
  "/health",
  "/review",
  "/meals",
];
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

/** Delete any item the user owns (task, subscription, …); cascades. */
export async function deleteItem(formData: FormData) {
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
// Money
// ---------------------------------------------------------------------------

async function insertExpense(
  userId: string,
  amount: number,
  note: string,
  category: string | null,
  day?: string,
  itemId?: string,
) {
  const db = await getDb();
  const [entry] = await db
    .insert(schema.entries)
    .values({
      userId,
      module: "money",
      type: "expense",
      occurredAt: day ? dayNoon(day) : new Date(),
      value: String(amount),
      note,
      itemId,
    })
    .returning();
  await db.insert(schema.transactions).values({
    entryId: entry.id,
    amount: String(amount),
    category: category ?? "other",
  });
}

export async function logExpense(formData: FormData) {
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;
  const note = String(formData.get("note") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const day = String(formData.get("day") ?? "").trim() || undefined;
  const user = await getCurrentUser();
  await insertExpense(user.id, amount, note, category, day);
  revalidateAll();
}

export async function createSubscription(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const cadence = String(formData.get("cadence") ?? "monthly");
  const next = String(formData.get("next") ?? "").trim();
  if (
    !name ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (cadence !== "monthly" && cadence !== "yearly") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(next)
  )
    return;
  const category = String(formData.get("category") ?? "bills");

  const user = await getCurrentUser();
  const db = await getDb();
  const [item] = await db
    .insert(schema.items)
    .values({
      userId: user.id,
      module: "money",
      type: "subscription",
      title: name,
      payload: { amount, cadence, nextRenewalKey: next, category },
    })
    .returning();
  // Mirror the renewal into the shared reminders system (plan §3) so
  // notifications can pick it up once a delivery channel exists.
  await db.insert(schema.reminders).values({
    userId: user.id,
    itemId: item.id,
    schedule: cadence,
    nextFireAt: dayStart(next),
  });
  revalidateAll();
}

/** Log the renewal as an expense and advance the next renewal date. */
export async function subscriptionPaid(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();

  const [item] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.type, "subscription"),
      ),
    )
    .limit(1);
  if (!item) return;

  const p = item.payload as {
    amount: number;
    cadence: "monthly" | "yearly";
    nextRenewalKey: string;
    category: string;
  };
  await insertExpense(user.id, p.amount, item.title, p.category, undefined, item.id);

  const next = nextRenewalKey(p.nextRenewalKey, p.cadence);
  await db
    .update(schema.items)
    .set({ payload: { ...p, nextRenewalKey: next }, updatedAt: new Date() })
    .where(eq(schema.items.id, item.id));
  await db
    .update(schema.reminders)
    .set({ nextFireAt: dayStart(next) })
    .where(eq(schema.reminders.itemId, item.id));
  revalidateAll();
}

export async function setMonthlyBudget(formData: FormData) {
  const budget = Number(formData.get("budget"));
  const user = await getCurrentUser();
  const db = await getDb();
  const settings = { ...(user.settings as Record<string, unknown>) };
  if (Number.isFinite(budget) && budget > 0) settings.budgetMonthly = budget;
  else delete settings.budgetMonthly;
  await db
    .update(schema.users)
    .set({ settings })
    .where(eq(schema.users.id, user.id));
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

const HEALTH_TYPES = ["weight", "sleep", "water", "workout"] as const;
type HealthType = (typeof HEALTH_TYPES)[number];

async function insertHealth(
  userId: string,
  type: HealthType,
  value: number | null,
  note = "",
) {
  const db = await getDb();
  await db.insert(schema.entries).values({
    userId,
    module: "health",
    type,
    occurredAt: new Date(),
    value: value === null ? null : String(value),
    note,
  });
}

export async function logHealth(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  if (!HEALTH_TYPES.includes(type as HealthType)) return;
  const valueRaw = formData.get("value");
  const value =
    valueRaw !== null && String(valueRaw).trim() !== ""
      ? Number(valueRaw)
      : null;
  if (value !== null && (!Number.isFinite(value) || value <= 0)) return;
  const note = String(formData.get("note") ?? "").trim();
  if (value === null && !note) return;
  const user = await getCurrentUser();
  await insertHealth(user.id, type as HealthType, value, note);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Delete any log entry the user owns (expense, health log, …). */
export async function deleteEntry(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .delete(schema.entries)
    .where(
      and(eq(schema.entries.id, entryId), eq(schema.entries.userId, user.id)),
    );
  revalidateAll();
}

type PushSubscriptionInput = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function parsePushSubscription(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 8_000) return null;
  try {
    const parsed = JSON.parse(value) as PushSubscriptionInput;
    const endpoint = typeof parsed.endpoint === "string" ? parsed.endpoint : "";
    const p256dh =
      typeof parsed.keys?.p256dh === "string" ? parsed.keys.p256dh : "";
    const auth = typeof parsed.keys?.auth === "string" ? parsed.keys.auth : "";
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      endpoint.length > 4_096 ||
      !p256dh ||
      p256dh.length > 1_024 ||
      !auth ||
      auth.length > 1_024
    )
      return null;
    return { endpoint, p256dh, auth };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function savePushSubscription(formData: FormData) {
  const subscription = parsePushSubscription(formData.get("subscription"));
  if (!subscription) return { ok: false, message: "Invalid subscription." };

  const user = await getCurrentUser();
  const db = await getDb();
  const userAgent = String(formData.get("userAgent") ?? "").slice(0, 500) || null;
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, ...subscription, userAgent })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent,
        updatedAt: new Date(),
      },
    });

  const result = await sendPush(subscription, {
    title: "Megaapp notifications are on",
    body: "We’ll protect your streaks and remind you about what matters.",
    url: "/today",
    tag: "notifications-enabled",
  });
  if (result === "gone") {
    await db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, user.id),
          eq(schema.pushSubscriptions.endpoint, subscription.endpoint),
        ),
      );
    return { ok: false, message: "The browser subscription expired. Try again." };
  }

  revalidateAll();
  return result === "sent"
    ? { ok: true, message: "Notifications enabled — test sent." }
    : { ok: true, message: "Notifications enabled." };
}

export async function deletePushSubscription(formData: FormData) {
  const endpoint = String(formData.get("endpoint") ?? "");
  if (!endpoint || endpoint.length > 4_096) return { ok: false };
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, user.id),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Meals & groceries
// ---------------------------------------------------------------------------

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const name = value.trim().replace(/\s+/g, " ").slice(0, 120);
    const key = name.toLocaleLowerCase("en-SG");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export async function createRecipe(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const ingredients = uniqueNames(
    String(formData.get("ingredients") ?? "").split(/[\n,]+/),
  );
  const linkRaw = String(formData.get("link") ?? "").trim();
  if (!title || ingredients.length === 0) return;

  let link: string | undefined;
  if (linkRaw) {
    try {
      const url = new URL(linkRaw);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      link = url.toString();
    } catch {
      return;
    }
  }

  const user = await getCurrentUser();
  const db = await getDb();
  await db.insert(schema.items).values({
    userId: user.id,
    module: "meals",
    type: "recipe",
    title,
    payload: { ingredients, ...(link ? { link } : {}) },
  });
  revalidateAll();
}

export async function saveMealPlan(formData: FormData) {
  const user = await getCurrentUser();
  const db = await getDb();
  const weekStart = weekStartKey(todayKey());
  const selected = mealPlanDays(weekStart)
    .map((day) => [day, String(formData.get(`meal-${day}`) ?? "").trim()] as const)
    .filter(([, value]) => Boolean(value));

  const requestedIds = [...new Set(selected.map(([, value]) => value))];
  const recipeRows = requestedIds.length
    ? await db
        .select({ id: schema.items.id })
        .from(schema.items)
        .where(
          and(
            eq(schema.items.userId, user.id),
            eq(schema.items.module, "meals"),
            eq(schema.items.type, "recipe"),
            eq(schema.items.status, "active"),
            inArray(schema.items.id, requestedIds),
          ),
        )
    : [];
  const ownedRecipeIds = new Set(recipeRows.map((row) => row.id));
  const days = Object.fromEntries(
    selected
      .filter(([, value]) => ownedRecipeIds.has(value))
      .map(([day, dinner]) => [day, { dinner }]),
  );

  const existing = await getMealPlanForWeek(user.id, weekStart);
  if (existing) {
    await db
      .update(schema.items)
      .set({ payload: { days }, updatedAt: new Date() })
      .where(
        and(
          eq(schema.items.id, existing.itemId),
          eq(schema.items.userId, user.id),
        ),
      );
  } else {
    await db.insert(schema.items).values({
      userId: user.id,
      module: "meals",
      type: "plan",
      title: weekStart,
      payload: { days },
    });
  }
  revalidateAll();
}

async function writeGroceryList(userId: string, items: GroceryItem[]) {
  const db = await getDb();
  const existing = await getActiveGroceryList(userId);
  if (existing) {
    await db
      .update(schema.items)
      .set({ payload: { items }, updatedAt: new Date() })
      .where(
        and(eq(schema.items.id, existing.itemId), eq(schema.items.userId, userId)),
      );
    return existing.itemId;
  }
  const [created] = await db
    .insert(schema.items)
    .values({
      userId,
      module: "meals",
      type: "grocery",
      title: "Groceries",
      payload: { items },
    })
    .returning();
  return created.id;
}

async function appendGroceryItem(userId: string, name: string) {
  const cleanName = uniqueNames([name])[0];
  if (!cleanName) return;
  const existing = await getActiveGroceryList(userId);
  const current = existing?.items ?? [];
  if (current.some((item) => item.name.toLocaleLowerCase("en-SG") === cleanName.toLocaleLowerCase("en-SG"))) return;
  await writeGroceryList(userId, [...current, { name: cleanName, done: false }]);
}

export async function generateGroceryList() {
  const user = await getCurrentUser();
  const db = await getDb();
  const plan = await getMealPlanForWeek(user.id, weekStartKey(todayKey()));
  if (!plan) return;

  const recipeIds = [
    ...new Set(
      Object.values(plan.days)
        .map((day) => day.dinner)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const recipes = recipeIds.length
    ? await db
        .select({ id: schema.items.id, payload: schema.items.payload })
        .from(schema.items)
        .where(
          and(
            eq(schema.items.userId, user.id),
            eq(schema.items.module, "meals"),
            eq(schema.items.type, "recipe"),
            inArray(schema.items.id, recipeIds),
          ),
        )
    : [];
  const generated = uniqueNames(
    recipes.flatMap((recipe) => {
      const payload = recipe.payload as Partial<RecipePayload>;
      return Array.isArray(payload.ingredients) ? payload.ingredients : [];
    }),
  );
  const existing = await getActiveGroceryList(user.id);
  const doneByName = new Map(
    (existing?.items ?? []).map((item) => [
      item.name.toLocaleLowerCase("en-SG"),
      item.done,
    ]),
  );
  await writeGroceryList(
    user.id,
    generated.map((name) => ({
      name,
      done: doneByName.get(name.toLocaleLowerCase("en-SG")) ?? false,
    })),
  );
  revalidateAll();
}

export async function toggleGroceryItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const index = Number(formData.get("index"));
  if (!itemId || !Number.isInteger(index) || index < 0) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "meals"),
        eq(schema.items.type, "grocery"),
        eq(schema.items.status, "active"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as { items?: GroceryItem[] };
  if (!Array.isArray(payload.items) || index >= payload.items.length) return;
  const items = payload.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, done: !item.done } : item,
  );
  await db
    .update(schema.items)
    .set({ payload: { items }, updatedAt: new Date() })
    .where(eq(schema.items.id, row.id));
  revalidateAll();
}

// Quick Capture v2: one input, many destinations (src/lib/capture.ts).
export async function quickCapture(formData: FormData) {
  const parsed = parseCapture(String(formData.get("text") ?? ""));
  if (!parsed) return;
  const user = await getCurrentUser();
  const db = await getDb();

  switch (parsed.kind) {
    case "expense":
      await insertExpense(user.id, parsed.amount, parsed.note, parsed.category);
      break;
    case "weight":
      await insertHealth(user.id, "weight", parsed.kg);
      break;
    case "sleep":
      await insertHealth(user.id, "sleep", parsed.hours);
      break;
    case "water":
      await insertHealth(user.id, "water", parsed.ml);
      break;
    case "workout":
      await insertHealth(user.id, "workout", parsed.minutes, parsed.note);
      break;
    case "grocery":
      await appendGroceryItem(user.id, parsed.name);
      break;
    case "task": {
      const dueKey =
        parsed.due === "today"
          ? todayKey()
          : parsed.due === "tomorrow"
            ? nextDueKey(todayKey(), "daily")
            : null;
      const [item] = await db
        .insert(schema.items)
        .values({
          userId: user.id,
          module: "tasks",
          type: "task",
          title: parsed.title,
        })
        .returning();
      await db.insert(schema.tasks).values({
        itemId: item.id,
        dueAt: dueKey ? dayNoon(dueKey) : null,
        priority: parsed.priority,
      });
      break;
    }
  }
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Weekly review — one reflection per week, upserted like the journal.
// ---------------------------------------------------------------------------

export async function saveReview(formData: FormData) {
  const wins = String(formData.get("wins") ?? "").trim();
  const challenges = String(formData.get("challenges") ?? "").trim();
  const focus = String(formData.get("focus") ?? "").trim();
  if (!wins && !challenges && !focus) return;

  const user = await getCurrentUser();
  const db = await getDb();
  const { weekStartKey } = await import("@/lib/review");
  const weekStart = weekStartKey(todayKey());
  const payload = { weekStart, wins, challenges, focus };

  const existing = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        eq(schema.entries.module, "review"),
        eq(schema.entries.type, "weekly"),
        gte(schema.entries.occurredAt, dayStart(weekStart)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.entries)
      .set({ payload })
      .where(eq(schema.entries.id, existing[0].id));
  } else {
    await db.insert(schema.entries).values({
      userId: user.id,
      module: "review",
      type: "weekly",
      occurredAt: new Date(),
      payload,
    });
  }
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
