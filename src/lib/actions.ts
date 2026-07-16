"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema, withTransaction } from "@/db";
import { getCurrentUser } from "@/lib/user";
import {
  addDays,
  addMonthsClamped,
  dayEnd,
  dayKey,
  dayNoon,
  dayStart,
  daysBetween,
  nextAnnualKey,
  nextDueKey,
  nextRenewalKey,
  todayKey,
  timeKey,
  zonedDateTime,
} from "@/lib/dates";
import { computeCurrentStreak, type HabitView } from "@/lib/data";
import type { SubscriptionView } from "@/lib/money";
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
import type { CalendarEventPayload } from "@/lib/calendar";
import type { GoalPayload } from "@/lib/goals";
import {
  MEDIA_KINDS,
  MEDIA_STATES,
  type MediaKind,
  type MediaPayload,
  type MediaState,
} from "@/lib/lists";
import {
  BUILTIN_PACKING_TEMPLATES,
  type PackingTemplatePayload,
  type TripPayload,
} from "@/lib/travel";
import type { PersonPayload } from "@/lib/people";
import type { HomeAssetPayload, MaintenancePayload } from "@/lib/home";
import type { VaultCipherPayload } from "@/lib/vault";
import {
  answerWithAssistant,
  getAssistantSnapshot,
  type AssistantReply,
} from "@/lib/assistant";
import {
  assistantActionAuditNote,
  parseAssistantActionProposal,
  validateAssistantActionProposal,
} from "@/lib/assistant-actions";
import {
  IMPORT_CONFIG,
  IMPORT_KINDS,
  importRecordFingerprint,
  validateImportBatch,
  type CalendarImportRecord,
  type ExpenseImportRecord,
  type HabitImportRecord,
  type ImportKind,
  type ImportRecord,
  type TaskImportRecord,
} from "@/lib/imports";

function revalidateAll(...paths: string[]) {
  // Dynamic routes are fresh on navigation; only refresh Today plus the
  // route containing the submitted form so the action response stays small.
  if (paths.length === 0) {
    revalidatePath("/", "layout");
    return;
  }
  for (const path of new Set(["/today", ...paths])) revalidatePath(path);
}

function redirectFresh(path: string): never {
  redirect(`${path}?updated=${Date.now()}`);
}

const MODULE_ROUTE: Record<string, string> = {
  tasks: "/tasks",
  habits: "/habits",
  journal: "/journal",
  money: "/money",
  health: "/health",
  review: "/review",
  meals: "/meals",
  calendar: "/calendar",
  goals: "/goals",
  lists: "/lists",
  travel: "/travel",
  people: "/people",
  home: "/home",
  vault: "/vault",
  assistant: "/assistant",
  imports: "/import",
};

function moduleRoute(module: string) {
  return MODULE_ROUTE[module] ?? "/today";
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
  revalidateAll("/tasks");
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
  revalidateAll("/tasks");
}

/** Delete any item the user owns (task, subscription, …); cascades. */
export async function deleteItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [owned] = await db
    .select({ module: schema.items.module })
    .from(schema.items)
    .where(and(eq(schema.items.id, itemId), eq(schema.items.userId, user.id)))
    .limit(1);
  if (!owned) return;
  await db
    .delete(schema.items)
    .where(and(eq(schema.items.id, itemId), eq(schema.items.userId, user.id)));
  revalidateAll(moduleRoute(owned.module));
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
  const [habit] = await db
    .insert(schema.habits)
    .values({ itemId: item.id })
    .returning();
  revalidateAll("/habits");
  return {
    habitId: habit.id,
    itemId: item.id,
    title,
    checkedToday: false,
    streakCurrent: 0,
    streakBest: 0,
    last7: Array.from({ length: 7 }, (_, index) => ({
      day: addDays(todayKey(), index - 6),
      checked: false,
    })),
  } satisfies HabitView;
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

  revalidateAll("/habits");
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
  revalidateAll("/habits");
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
  return entry;
}

export async function logExpense(formData: FormData) {
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;
  const note = String(formData.get("note") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const day = String(formData.get("day") ?? "").trim() || undefined;
  const user = await getCurrentUser();
  await insertExpense(user.id, amount, note, category, day);
  revalidateAll("/money");
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
  revalidateAll("/money");
  return {
    itemId: item.id,
    name,
    amount,
    cadence,
    nextRenewalKey: next,
    category,
    daysUntil: daysBetween(todayKey(), next),
    monthlyEquivalent: cadence === "yearly" ? amount / 12 : amount,
  } satisfies SubscriptionView;
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
  revalidateAll("/money");
  return { nextRenewalKey: next, daysUntil: daysBetween(todayKey(), next) };
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
  revalidateAll("/money");
  redirectFresh("/money");
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
  revalidateAll("/health");
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
  const [owned] = await db
    .select({ module: schema.entries.module })
    .from(schema.entries)
    .where(and(eq(schema.entries.id, entryId), eq(schema.entries.userId, user.id)))
    .limit(1);
  if (!owned) return;
  await db
    .delete(schema.entries)
    .where(
      and(eq(schema.entries.id, entryId), eq(schema.entries.userId, user.id)),
    );
  revalidateAll(moduleRoute(owned.module));
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

  revalidateAll("/today");
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
  revalidateAll("/today");
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
  const [created] = await db
    .insert(schema.items)
    .values({
      userId: user.id,
      module: "meals",
      type: "recipe",
      title,
      payload: { ingredients, ...(link ? { link } : {}) },
    })
    .returning();
  revalidateAll("/meals");
  return {
    itemId: created.id,
    title,
    ingredients,
    ...(link ? { link } : {}),
  };
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
  let itemId: string;
  if (existing) {
    itemId = existing.itemId;
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
    const [created] = await db
      .insert(schema.items)
      .values({
        userId: user.id,
        module: "meals",
        type: "plan",
        title: weekStart,
        payload: { days },
      })
      .returning();
    itemId = created.id;
  }
  revalidateAll("/meals");
  return { itemId, weekStart, days };
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
  const items = generated.map((name) => ({
    name,
    done: doneByName.get(name.toLocaleLowerCase("en-SG")) ?? false,
  }));
  const itemId = await writeGroceryList(user.id, items);
  revalidateAll("/meals");
  return { itemId, items };
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
  revalidateAll("/meals");
}

// ---------------------------------------------------------------------------
// Calendar, goals, and lists — planning views over the shared items table.
// ---------------------------------------------------------------------------

export async function createCalendarEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const date = String(formData.get("date") ?? "");
  const allDay = formData.get("allDay") === "on";
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (!allDay && !/^\d{2}:\d{2}$/.test(startTime)) return;
  if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) return;

  const start = allDay ? dayStart(date) : zonedDateTime(date, startTime);
  const end = allDay ? dayEnd(date) : endTime ? zonedDateTime(date, endTime) : null;
  if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) return;

  const location = String(formData.get("location") ?? "").trim().slice(0, 200);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2_000);
  const payload: CalendarEventPayload = {
    startAt: start.toISOString(),
    endAt: end?.toISOString(),
    allDay,
    location: location || undefined,
    notes: notes || undefined,
  };
  const user = await getCurrentUser();
  const db = await getDb();
  await db.insert(schema.items).values({
    userId: user.id,
    module: "calendar",
    type: "event",
    title,
    payload,
  });
  revalidateAll("/calendar");
  redirectFresh("/calendar");
}

export async function createGoal(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const horizonRaw = String(formData.get("horizon") ?? "quarter");
  const horizon =
    horizonRaw === "month" || horizonRaw === "quarter" || horizonRaw === "year"
      ? horizonRaw
      : null;
  const targetDate = String(formData.get("targetDate") ?? "");
  if (!title || !horizon || (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate))) return;

  const user = await getCurrentUser();
  const db = await getDb();
  const requestedIds = [
    ...new Set(
      formData
        .getAll("linkedItemId")
        .map(String)
        .filter(Boolean),
    ),
  ].slice(0, 50);
  const ownedLinks = requestedIds.length
    ? await db
        .select({ id: schema.items.id })
        .from(schema.items)
        .where(
          and(
            eq(schema.items.userId, user.id),
            inArray(schema.items.id, requestedIds),
            inArray(schema.items.module, ["tasks", "habits"]),
          ),
        )
    : [];
  const milestones = String(formData.get("milestones") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((milestone, index) => ({
      id: `${Date.now().toString(36)}-${index}`,
      title: milestone.slice(0, 200),
      done: false,
    }));
  const payload: GoalPayload = {
    horizon,
    targetDate: targetDate || undefined,
    linkedItemIds: ownedLinks.map((item) => item.id),
    milestones,
  };
  await db.insert(schema.items).values({
    userId: user.id,
    module: "goals",
    type: "goal",
    title,
    payload,
  });
  revalidateAll("/goals");
  redirectFresh("/goals");
}

export async function toggleGoalMilestone(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!itemId || !milestoneId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "goals"),
        eq(schema.items.type, "goal"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as GoalPayload;
  if (!Array.isArray(payload.milestones)) return;
  const milestones = payload.milestones.map((milestone) =>
    milestone.id === milestoneId ? { ...milestone, done: !milestone.done } : milestone,
  );
  await db
    .update(schema.items)
    .set({ payload: { ...payload, milestones }, updatedAt: new Date() })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/goals");
}

export async function createMediaItem(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const kind = String(formData.get("kind") ?? "other") as MediaKind;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1_000);
  if (!title || !MEDIA_KINDS.includes(kind)) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const payload: MediaPayload = {
    kind,
    state: "backlog",
    notes: notes || undefined,
  };
  await db.insert(schema.items).values({
    userId: user.id,
    module: "lists",
    type: "media",
    title,
    payload,
  });
  revalidateAll("/lists");
  redirectFresh("/lists");
}

export async function updateMediaState(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const state = String(formData.get("state") ?? "") as MediaState;
  if (!itemId || !MEDIA_STATES.includes(state)) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "lists"),
        eq(schema.items.type, "media"),
      ),
    )
    .limit(1);
  if (!row) return;
  await db
    .update(schema.items)
    .set({
      payload: { ...(row.payload as MediaPayload), state },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/lists");
}

export async function rateMediaItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const rating = Number(formData.get("rating"));
  if (!itemId || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "lists"),
        eq(schema.items.type, "media"),
      ),
    )
    .limit(1);
  if (!row) return;
  await db
    .update(schema.items)
    .set({
      payload: { ...(row.payload as MediaPayload), rating },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/lists");
}

// ---------------------------------------------------------------------------
// Travel, people, home, and vault â€” the long-tail life-admin suite.
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createPackingTemplate(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const items = [
    ...new Set(
      String(formData.get("items") ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean),
    ),
  ].slice(0, 60);
  if (!title || items.length === 0) return;
  const user = await getCurrentUser();
  const db = await getDb();
  await db.insert(schema.items).values({
    userId: user.id,
    module: "travel",
    type: "packing_template",
    title,
    payload: { items } satisfies PackingTemplatePayload,
  });
  revalidateAll("/travel");
  redirectFresh("/travel");
}

export async function createTrip(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const destination = String(formData.get("destination") ?? "").trim().slice(0, 160);
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const templateId = String(formData.get("templateId") ?? "builtin:weekend");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2_000);
  if (
    !title ||
    !destination ||
    !DATE_RE.test(startDate) ||
    !DATE_RE.test(endDate) ||
    endDate < startDate
  )
    return;
  const user = await getCurrentUser();
  const db = await getDb();
  let names: string[] = [];
  if (templateId in BUILTIN_PACKING_TEMPLATES) {
    names = [
      ...BUILTIN_PACKING_TEMPLATES[
        templateId as keyof typeof BUILTIN_PACKING_TEMPLATES
      ].items,
    ];
  } else if (templateId) {
    const [template] = await db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.id, templateId),
          eq(schema.items.userId, user.id),
          eq(schema.items.module, "travel"),
          eq(schema.items.type, "packing_template"),
        ),
      )
      .limit(1);
    if (template) {
      const payload = template.payload as PackingTemplatePayload;
      if (Array.isArray(payload.items)) names = payload.items;
    }
  }
  const payload: TripPayload = {
    destination,
    startDate,
    endDate,
    notes: notes || undefined,
    packingItems: names.slice(0, 60).map((name) => ({
      id: crypto.randomUUID(),
      name,
      done: false,
    })),
    itinerary: [],
  };
  const [item] = await db
    .insert(schema.items)
    .values({ userId: user.id, module: "travel", type: "trip", title, payload })
    .returning();
  await db.insert(schema.reminders).values({
    userId: user.id,
    itemId: item.id,
    schedule: "once",
    nextFireAt: dayStart(addDays(startDate, -1)),
  });
  revalidateAll("/travel");
  redirectFresh("/travel");
}

export async function toggleTripPackingItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const packingId = String(formData.get("packingId") ?? "");
  if (!itemId || !packingId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "travel"),
        eq(schema.items.type, "trip"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as TripPayload;
  if (!Array.isArray(payload.packingItems)) return;
  await db
    .update(schema.items)
    .set({
      payload: {
        ...payload,
        packingItems: payload.packingItems.map((packing) =>
          packing.id === packingId ? { ...packing, done: !packing.done } : packing,
        ),
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/travel");
  redirectFresh("/travel");
}

export async function addTripPackingItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!itemId || !name) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "travel"),
        eq(schema.items.type, "trip"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as TripPayload;
  const packingItems = Array.isArray(payload.packingItems) ? payload.packingItems : [];
  if (packingItems.length >= 100 || packingItems.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
  await db
    .update(schema.items)
    .set({
      payload: {
        ...payload,
        packingItems: [...packingItems, { id: crypto.randomUUID(), name, done: false }],
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/travel");
  redirectFresh("/travel");
}

export async function addItineraryStop(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const day = String(formData.get("day") ?? "");
  const time = String(formData.get("time") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const location = String(formData.get("location") ?? "").trim().slice(0, 160);
  if (!itemId || !title || !DATE_RE.test(day) || (time && !/^\d{2}:\d{2}$/.test(time))) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "travel"),
        eq(schema.items.type, "trip"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as TripPayload;
  if (day < payload.startDate || day > payload.endDate) return;
  const itinerary = Array.isArray(payload.itinerary) ? payload.itinerary : [];
  if (itinerary.length >= 100) return;
  await db
    .update(schema.items)
    .set({
      payload: {
        ...payload,
        itinerary: [
          ...itinerary,
          {
            id: crypto.randomUUID(),
            day,
            time: time || undefined,
            title,
            location: location || undefined,
          },
        ].sort((a, b) => `${a.day}${a.time ?? ""}`.localeCompare(`${b.day}${b.time ?? ""}`)),
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/travel");
  redirectFresh("/travel");
}

export async function createPerson(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const relationship = String(formData.get("relationship") ?? "").trim().slice(0, 100);
  const birthday = String(formData.get("birthday") ?? "");
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 200);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2_000);
  const checkInDays = Number(formData.get("checkInDays") ?? 30);
  if (!name || (birthday && !DATE_RE.test(birthday)) || ![7, 14, 30, 60, 90].includes(checkInDays)) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const payload: PersonPayload = {
    relationship: relationship || undefined,
    birthday: birthday || undefined,
    contact: contact || undefined,
    notes: notes || undefined,
    checkInDays,
    giftIdeas: [],
  };
  const [item] = await db
    .insert(schema.items)
    .values({ userId: user.id, module: "people", type: "person", title: name, payload })
    .returning();
  if (birthday) {
    await db.insert(schema.reminders).values({
      userId: user.id,
      itemId: item.id,
      schedule: "yearly",
      nextFireAt: dayStart(nextAnnualKey(birthday)),
    });
  }
  revalidateAll("/people");
  redirectFresh("/people");
}

export async function logPersonContact(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1_000);
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "people"),
        eq(schema.items.type, "person"),
      ),
    )
    .limit(1);
  if (!row) return;
  await db
    .update(schema.items)
    .set({
      payload: { ...(row.payload as PersonPayload), lastContactKey: todayKey() },
      updatedAt: new Date(),
    })
    .where(eq(schema.items.id, row.id));
  await db.insert(schema.entries).values({
    userId: user.id,
    module: "people",
    type: "contact",
    occurredAt: new Date(),
    note: note || `Caught up with ${row.title}`,
    itemId: row.id,
  });
  revalidateAll("/people");
  redirectFresh("/people");
}

export async function addGiftIdea(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const idea = String(formData.get("idea") ?? "").trim().slice(0, 200);
  if (!itemId || !idea) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(and(eq(schema.items.id, itemId), eq(schema.items.userId, user.id), eq(schema.items.module, "people")))
    .limit(1);
  if (!row) return;
  const payload = row.payload as PersonPayload;
  const ideas = Array.isArray(payload.giftIdeas) ? payload.giftIdeas : [];
  if (ideas.length >= 30 || ideas.some((value) => value.toLowerCase() === idea.toLowerCase())) return;
  await db
    .update(schema.items)
    .set({ payload: { ...payload, giftIdeas: [...ideas, idea] }, updatedAt: new Date() })
    .where(eq(schema.items.id, row.id));
  revalidateAll("/people");
  redirectFresh("/people");
}

export async function createHomeAsset(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const category = String(formData.get("category") ?? "other").trim().slice(0, 80);
  const serial = String(formData.get("serial") ?? "").trim().slice(0, 200);
  const purchaseDate = String(formData.get("purchaseDate") ?? "");
  const warrantyEnd = String(formData.get("warrantyEnd") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2_000);
  if (!title || (purchaseDate && !DATE_RE.test(purchaseDate)) || (warrantyEnd && !DATE_RE.test(warrantyEnd))) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const payload: HomeAssetPayload = {
    category: category || "other",
    serial: serial || undefined,
    purchaseDate: purchaseDate || undefined,
    warrantyEnd: warrantyEnd || undefined,
    notes: notes || undefined,
  };
  await db.insert(schema.items).values({ userId: user.id, module: "home", type: "asset", title, payload });
  revalidateAll("/home");
  redirectFresh("/home");
}

export async function createMaintenanceItem(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const assetItemId = String(formData.get("assetItemId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const cadenceMonths = Number(formData.get("cadenceMonths") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2_000);
  if (!title || !DATE_RE.test(dueDate) || ![0, 1, 3, 6, 12].includes(cadenceMonths)) return;
  const user = await getCurrentUser();
  const db = await getDb();
  let ownedAssetId: string | undefined;
  if (assetItemId) {
    const [asset] = await db
      .select({ id: schema.items.id })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.id, assetItemId),
          eq(schema.items.userId, user.id),
          eq(schema.items.module, "home"),
          eq(schema.items.type, "asset"),
        ),
      )
      .limit(1);
    ownedAssetId = asset?.id;
  }
  const payload: MaintenancePayload = {
    assetItemId: ownedAssetId,
    dueDate,
    cadenceMonths: cadenceMonths || undefined,
    notes: notes || undefined,
    completedCount: 0,
  };
  const [item] = await db
    .insert(schema.items)
    .values({ userId: user.id, module: "home", type: "maintenance", title, payload })
    .returning();
  await db.insert(schema.reminders).values({
    userId: user.id,
    itemId: item.id,
    schedule: cadenceMonths ? `months:${cadenceMonths}` : "once",
    nextFireAt: dayStart(dueDate),
  });
  revalidateAll("/home");
  redirectFresh("/home");
}

export async function completeMaintenance(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.id, itemId),
        eq(schema.items.userId, user.id),
        eq(schema.items.module, "home"),
        eq(schema.items.type, "maintenance"),
        eq(schema.items.status, "active"),
      ),
    )
    .limit(1);
  if (!row) return;
  const payload = row.payload as MaintenancePayload;
  await db.insert(schema.entries).values({
    userId: user.id,
    module: "home",
    type: "maintenance_completed",
    occurredAt: new Date(),
    note: row.title,
    itemId: row.id,
    payload: { dueDate: payload.dueDate },
  });
  if (payload.cadenceMonths) {
    let next = payload.dueDate;
    while (next <= todayKey()) next = addMonthsClamped(next, payload.cadenceMonths);
    await db
      .update(schema.items)
      .set({
        payload: { ...payload, dueDate: next, completedCount: (payload.completedCount || 0) + 1 },
        updatedAt: new Date(),
      })
      .where(eq(schema.items.id, row.id));
    await db
      .update(schema.reminders)
      .set({ nextFireAt: dayStart(next) })
      .where(and(eq(schema.reminders.userId, user.id), eq(schema.reminders.itemId, row.id)));
  } else {
    await db.update(schema.items).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.items.id, row.id));
    await db
      .update(schema.reminders)
      .set({ nextFireAt: null })
      .where(and(eq(schema.reminders.userId, user.id), eq(schema.reminders.itemId, row.id)));
  }
  revalidateAll("/home");
  redirectFresh("/home");
}

export async function createVaultItem(formData: FormData) {
  const salt = String(formData.get("salt") ?? "");
  const iv = String(formData.get("iv") ?? "");
  const ciphertext = String(formData.get("ciphertext") ?? "");
  const base64 = /^[A-Za-z0-9+/]+={0,2}$/;
  if (
    !base64.test(salt) ||
    !base64.test(iv) ||
    !base64.test(ciphertext) ||
    salt.length > 100 ||
    iv.length > 100 ||
    ciphertext.length > 250_000
  )
    return;
  const user = await getCurrentUser();
  const db = await getDb();
  const payload: VaultCipherPayload = {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 250_000,
    salt,
    iv,
    ciphertext,
  };
  await db.insert(schema.items).values({
    userId: user.id,
    module: "vault",
    type: "secret",
    title: "Encrypted item",
    payload,
  });
  revalidateAll("/vault");
}

// ---------------------------------------------------------------------------
// CSV imports — previewed in the browser, then fully revalidated here.
// ---------------------------------------------------------------------------

export async function importCsvRecords(formData: FormData) {
  const kindRaw = String(formData.get("kind") ?? "");
  if (!IMPORT_KINDS.includes(kindRaw as ImportKind)) return;
  const kind = kindRaw as ImportKind;
  const raw = String(formData.get("records") ?? "");
  if (!raw || raw.length > 1_000_000) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const records = validateImportBatch(kind, value);
  if (!records) return;

  const user = await getCurrentUser();
  const db = await getDb();
  const existing = new Set<string>();

  if (kind === "tasks") {
    const rows = await db
      .select({ title: schema.items.title, dueAt: schema.tasks.dueAt })
      .from(schema.tasks)
      .innerJoin(schema.items, eq(schema.tasks.itemId, schema.items.id))
      .where(
        and(
          eq(schema.items.userId, user.id),
          eq(schema.items.module, "tasks"),
          eq(schema.items.type, "task"),
          eq(schema.items.status, "active"),
        ),
      );
    for (const row of rows) {
      existing.add(
        importRecordFingerprint({
          kind: "tasks",
          title: row.title,
          due: row.dueAt ? dayKey(row.dueAt) : null,
          priority: 0,
        }),
      );
    }
  } else if (kind === "expenses") {
    const expenseRecords = records.filter(
      (record): record is ExpenseImportRecord => record.kind === "expenses",
    );
    const days = expenseRecords.map((record) => record.day).sort();
    const rows = await db
      .select({
        occurredAt: schema.entries.occurredAt,
        note: schema.entries.note,
        amount: schema.transactions.amount,
        category: schema.transactions.category,
      })
      .from(schema.transactions)
      .innerJoin(schema.entries, eq(schema.transactions.entryId, schema.entries.id))
      .where(
        and(
          eq(schema.entries.userId, user.id),
          eq(schema.entries.module, "money"),
          eq(schema.entries.type, "expense"),
          gte(schema.entries.occurredAt, dayStart(days[0])),
          lte(schema.entries.occurredAt, dayEnd(days[days.length - 1])),
        ),
      );
    for (const row of rows) {
      existing.add(
        `${dayKey(row.occurredAt)}|${Number(row.amount).toFixed(2)}|${row.category ?? "other"}|${(row.note ?? "").toLowerCase()}`,
      );
    }
  } else if (kind === "habits") {
    const rows = await db
      .select({ title: schema.items.title })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, user.id),
          eq(schema.items.module, "habits"),
          eq(schema.items.type, "habit"),
          eq(schema.items.status, "active"),
        ),
      );
    for (const row of rows)
      existing.add(importRecordFingerprint({ kind: "habits", title: row.title }));
  } else {
    const rows = await db
      .select({ title: schema.items.title, payload: schema.items.payload })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, user.id),
          eq(schema.items.module, "calendar"),
          eq(schema.items.type, "event"),
          eq(schema.items.status, "active"),
        ),
      );
    for (const row of rows) {
      const payload = row.payload as Partial<CalendarEventPayload>;
      if (typeof payload.startAt !== "string") continue;
      const start = new Date(payload.startAt);
      if (Number.isNaN(start.getTime())) continue;
      existing.add(
        importRecordFingerprint({
          kind: "calendar",
          title: row.title,
          date: dayKey(start),
          startTime: payload.allDay ? null : timeKey(start),
          endTime: null,
          allDay: payload.allDay === true,
          location: "",
          notes: "",
        }),
      );
    }
  }

  const accepted: ImportRecord[] = [];
  for (const record of records) {
    const fingerprint = importRecordFingerprint(record);
    if (existing.has(fingerprint)) continue;
    existing.add(fingerprint);
    accepted.push(record);
  }

  const taskRecords = accepted.filter(
    (record): record is TaskImportRecord => record.kind === "tasks",
  );
  if (taskRecords.length) {
    const prepared = taskRecords.map((record) => ({ id: randomUUID(), record }));
    await db.insert(schema.items).values(
      prepared.map(({ id, record }) => ({
        id,
        userId: user.id,
        module: "tasks",
        type: "task",
        title: record.title,
      })),
    );
    await db.insert(schema.tasks).values(
      prepared.map(({ id, record }) => ({
        itemId: id,
        dueAt: record.due ? dayNoon(record.due) : null,
        recurrence: null,
        priority: record.priority,
      })),
    );
  }

  const expenseRecords = accepted.filter(
    (record): record is ExpenseImportRecord => record.kind === "expenses",
  );
  if (expenseRecords.length) {
    const prepared = expenseRecords.map((record) => ({ id: randomUUID(), record }));
    await db.insert(schema.entries).values(
      prepared.map(({ id, record }) => ({
        id,
        userId: user.id,
        module: "money",
        type: "expense",
        occurredAt: dayNoon(record.day),
        value: String(record.amount),
        note: record.note,
      })),
    );
    await db.insert(schema.transactions).values(
      prepared.map(({ id, record }) => ({
        entryId: id,
        amount: String(record.amount),
        category: record.category,
      })),
    );
  }

  const habitRecords = accepted.filter(
    (record): record is HabitImportRecord => record.kind === "habits",
  );
  if (habitRecords.length) {
    const prepared = habitRecords.map((record) => ({ id: randomUUID(), record }));
    await db.insert(schema.items).values(
      prepared.map(({ id, record }) => ({
        id,
        userId: user.id,
        module: "habits",
        type: "habit",
        title: record.title,
      })),
    );
    await db.insert(schema.habits).values(prepared.map(({ id }) => ({ itemId: id })));
  }

  const calendarRecords = accepted.filter(
    (record): record is CalendarImportRecord => record.kind === "calendar",
  );
  if (calendarRecords.length) {
    await db.insert(schema.items).values(
      calendarRecords.map((record) => {
        const start = record.allDay
          ? dayStart(record.date)
          : zonedDateTime(record.date, record.startTime as string);
        const end = record.allDay
          ? dayEnd(record.date)
          : record.endTime
            ? zonedDateTime(record.date, record.endTime)
            : null;
        const payload: CalendarEventPayload = {
          startAt: start.toISOString(),
          endAt: end?.toISOString(),
          allDay: record.allDay,
          location: record.location || undefined,
          notes: record.notes || undefined,
        };
        return {
          id: randomUUID(),
          userId: user.id,
          module: "calendar",
          type: "event",
          title: record.title,
          payload,
        };
      }),
    );
  }

  const imported = accepted.length;
  const skipped = records.length - imported;
  const config = IMPORT_CONFIG[kind];
  const noun = imported === 1 ? config.singular : config.label.toLowerCase();
  const duplicateText = skipped
    ? `; ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`
    : "";
  const note = imported
    ? `Imported ${imported} ${noun} from CSV${duplicateText}`
    : `No new ${config.label.toLowerCase()} imported; ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`;
  await db.insert(schema.entries).values({
    userId: user.id,
    module: "imports",
    type: "batch_applied",
    occurredAt: new Date(),
    note,
    payload: { kind, imported, skipped },
  });
  revalidateAll("/import");
  const query = new URLSearchParams({
    kind,
    imported: String(imported),
    skipped: String(skipped),
  });
  redirect(`/import?${query.toString()}`);
}

// ---------------------------------------------------------------------------
// Assistant — proposals stay read-only until a separate explicit confirmation.
// Questions and replies are never persisted locally.
// ---------------------------------------------------------------------------

export async function askAssistant(formData: FormData): Promise<AssistantReply> {
  const question = String(formData.get("question") ?? "").trim().slice(0, 800);
  if (!question) {
    return {
      answer: "Ask about today’s focus, spending, health, or your weekly review.",
      mode: "local",
      sources: ["Your compact Megaapp summary"],
    };
  }

  // Recognized commands are handled before the heavier dashboard snapshot and
  // never reach an external provider. They still cannot write without confirm.
  const proposal = parseAssistantActionProposal(question);
  if (proposal) {
    return {
      answer: "I prepared a draft from your command. Review it below; nothing changes until you confirm.",
      mode: "local",
      sources: ["Your requested action details"],
      proposal,
    };
  }

  const user = await getCurrentUser();
  const snapshot = await getAssistantSnapshot(user.id, user.settings);
  return answerWithAssistant(question, snapshot);
}

export async function confirmAssistantAction(
  formData: FormData,
): Promise<{ id: string; summary: string; day: string; action: "task" | "expense" | "calendar" | "habit" } | null> {
  const raw = String(formData.get("proposal") ?? "");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const proposal = validateAssistantActionProposal(value);
  if (!proposal) return null;

  const user = await getCurrentUser();
  const db = await getDb();
  let itemId: string | undefined;
  let targetEntryId: string | undefined;

  switch (proposal.kind) {
    case "task": {
      const [item] = await db
        .insert(schema.items)
        .values({ userId: user.id, module: "tasks", type: "task", title: proposal.title })
        .returning();
      await db.insert(schema.tasks).values({
        itemId: item.id,
        dueAt: proposal.dueKey ? dayNoon(proposal.dueKey) : null,
        recurrence: null,
        priority: 0,
      });
      itemId = item.id;
      break;
    }
    case "expense": {
      const entry = await insertExpense(
        user.id,
        proposal.amount,
        proposal.note,
        proposal.category,
        proposal.day,
      );
      targetEntryId = entry.id;
      break;
    }
    case "calendar": {
      const start = proposal.startTime
        ? zonedDateTime(proposal.date, proposal.startTime)
        : dayStart(proposal.date);
      if (Number.isNaN(start.getTime())) return null;
      const payload: CalendarEventPayload = {
        startAt: start.toISOString(),
        allDay: proposal.startTime === null,
      };
      const [item] = await db
        .insert(schema.items)
        .values({
          userId: user.id,
          module: "calendar",
          type: "event",
          title: proposal.title,
          payload,
        })
        .returning();
      itemId = item.id;
      break;
    }
    case "habit": {
      const [item] = await db
        .insert(schema.items)
        .values({ userId: user.id, module: "habits", type: "habit", title: proposal.title })
        .returning();
      await db.insert(schema.habits).values({ itemId: item.id });
      itemId = item.id;
      break;
    }
  }

  const summary = assistantActionAuditNote(proposal);
  const [audit] = await db
    .insert(schema.entries)
    .values({
      userId: user.id,
      module: "assistant",
      type: "action_applied",
      occurredAt: new Date(),
      note: summary,
      itemId,
      payload: {
        action: proposal.kind,
        targetEntryId,
      },
    })
    .returning();
  revalidateAll("/assistant");
  return { id: audit.id, summary, day: dayKey(audit.occurredAt), action: proposal.kind };
}

// Quick Capture v2: one input, many destinations (src/lib/capture.ts).
export type QuickCaptureResult = {
  ok: boolean;
  status: "captured" | "duplicate" | "invalid";
};

function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return null;
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : null;
  }
  return null;
}

export async function quickCapture(formData: FormData): Promise<QuickCaptureResult> {
  const text = String(formData.get("text") ?? "").trim().slice(0, 500);
  const parsed = parseCapture(text);
  if (!parsed) return { ok: false, status: "invalid" };

  const suppliedClientId = String(formData.get("clientId") ?? "").trim();
  const clientId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    suppliedClientId,
  )
    ? suppliedClientId
    : randomUUID();
  const capturedAtInput = new Date(String(formData.get("capturedAt") ?? ""));
  const now = new Date();
  const capturedAt =
    Number.isFinite(capturedAtInput.getTime()) &&
    capturedAtInput.getTime() <= now.getTime() + 5 * 60_000 &&
    capturedAtInput.getTime() >= now.getTime() - 90 * 86_400_000
      ? capturedAtInput
      : now;
  const capturedDay = dayKey(capturedAt);
  const user = await getCurrentUser();

  try {
    await withTransaction(async (db) => {
      // The client UUID is the receipt primary key. Inserting it first makes
      // a replay fail inside the same transaction before any domain write.
      await db.insert(schema.entries).values({
        id: clientId,
        userId: user.id,
        module: "capture",
        type: "receipt",
        occurredAt: capturedAt,
        payload: { source: suppliedClientId ? "offline-capable" : "server" },
      });

      switch (parsed.kind) {
        case "expense": {
          const [entry] = await db.insert(schema.entries).values({
            userId: user.id,
            module: "money",
            type: "expense",
            occurredAt: capturedAt,
            value: String(parsed.amount),
            note: parsed.note,
          }).returning();
          await db.insert(schema.transactions).values({
            entryId: entry.id,
            amount: String(parsed.amount),
            category: parsed.category ?? "other",
          });
          break;
        }
        case "weight":
        case "sleep":
        case "water":
          await db.insert(schema.entries).values({
            userId: user.id,
            module: "health",
            type: parsed.kind,
            occurredAt: capturedAt,
            value: String(parsed.kind === "weight" ? parsed.kg : parsed.kind === "sleep" ? parsed.hours : parsed.ml),
          });
          break;
        case "workout":
          await db.insert(schema.entries).values({
            userId: user.id,
            module: "health",
            type: "workout",
            occurredAt: capturedAt,
            value: parsed.minutes === null ? null : String(parsed.minutes),
            note: parsed.note,
          });
          break;
        case "grocery": {
          const [grocery] = await db.select().from(schema.items).where(and(
            eq(schema.items.userId, user.id),
            eq(schema.items.module, "meals"),
            eq(schema.items.type, "grocery"),
            eq(schema.items.status, "active"),
          )).limit(1);
          const cleanName = uniqueNames([parsed.name])[0];
          if (!cleanName) break;
          const current = ((grocery?.payload as { items?: GroceryItem[] } | undefined)?.items ?? []);
          if (current.some((item) => item.name.toLocaleLowerCase("en-SG") === cleanName.toLocaleLowerCase("en-SG"))) break;
          if (grocery) {
            await db.update(schema.items).set({
              payload: { items: [...current, { name: cleanName, done: false }] },
              updatedAt: capturedAt,
            }).where(and(eq(schema.items.id, grocery.id), eq(schema.items.userId, user.id)));
          } else {
            await db.insert(schema.items).values({
              userId: user.id,
              module: "meals",
              type: "grocery",
              title: "Groceries",
              payload: { items: [{ name: cleanName, done: false }] },
              createdAt: capturedAt,
              updatedAt: capturedAt,
            });
          }
          break;
        }
        case "media":
          await db.insert(schema.items).values({
            userId: user.id,
            module: "lists",
            type: "media",
            title: parsed.title,
            payload: { kind: parsed.mediaKind, state: "backlog" },
            createdAt: capturedAt,
            updatedAt: capturedAt,
          });
          break;
        case "person": {
          const [person] = await db.select().from(schema.items).where(and(
            eq(schema.items.userId, user.id),
            eq(schema.items.module, "people"),
            eq(schema.items.type, "person"),
            eq(schema.items.title, parsed.name),
          )).limit(1);
          if (person && parsed.contacted) {
            await db.update(schema.items).set({
              payload: { ...(person.payload as PersonPayload), lastContactKey: capturedDay },
              updatedAt: capturedAt,
            }).where(and(eq(schema.items.id, person.id), eq(schema.items.userId, user.id)));
            await db.insert(schema.entries).values({
              userId: user.id,
              module: "people",
              type: "contact",
              occurredAt: capturedAt,
              note: `Caught up with ${person.title}`,
              itemId: person.id,
            });
          } else if (!person) {
            await db.insert(schema.items).values({
              userId: user.id,
              module: "people",
              type: "person",
              title: parsed.name,
              payload: { checkInDays: 30, giftIdeas: [], lastContactKey: parsed.contacted ? capturedDay : undefined } satisfies PersonPayload,
              createdAt: capturedAt,
              updatedAt: capturedAt,
            });
          }
          break;
        }
        case "maintenance": {
          const [item] = await db.insert(schema.items).values({
            userId: user.id,
            module: "home",
            type: "maintenance",
            title: parsed.title,
            payload: { dueDate: capturedDay, completedCount: 0 } satisfies MaintenancePayload,
            createdAt: capturedAt,
            updatedAt: capturedAt,
          }).returning();
          await db.insert(schema.reminders).values({
            userId: user.id,
            itemId: item.id,
            schedule: "once",
            nextFireAt: dayStart(capturedDay),
          });
          break;
        }
        case "task": {
          const dueKey = parsed.due === "today"
            ? capturedDay
            : parsed.due === "tomorrow"
              ? nextDueKey(capturedDay, "daily")
              : null;
          const [item] = await db.insert(schema.items).values({
            userId: user.id,
            module: "tasks",
            type: "task",
            title: parsed.title,
            createdAt: capturedAt,
            updatedAt: capturedAt,
          }).returning();
          await db.insert(schema.tasks).values({
            itemId: item.id,
            dueAt: dueKey ? dayNoon(dueKey) : null,
            priority: parsed.priority,
          });
          break;
        }
      }
    });
  } catch (error) {
    if (postgresErrorCode(error) !== "23505") throw error;
    const db = await getDb();
    const [receipt] = await db.select({ id: schema.entries.id }).from(schema.entries).where(and(
      eq(schema.entries.id, clientId),
      eq(schema.entries.userId, user.id),
      eq(schema.entries.module, "capture"),
      eq(schema.entries.type, "receipt"),
    )).limit(1);
    if (!receipt) throw error;
    return { ok: true, status: "duplicate" };
  }
  revalidateAll("/today");
  return { ok: true, status: "captured" };
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
  revalidateAll("/review");
  redirectFresh("/review");
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
  revalidateAll("/journal");
}
