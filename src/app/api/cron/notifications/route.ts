import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  addDays,
  dayEnd,
  dayKey,
  dayStart,
  nextRenewalKey,
  singaporeHour,
  todayKey,
} from "@/lib/dates";
import { getHabits, getTodayData } from "@/lib/data";
import { formatSGD, type SubscriptionPayload } from "@/lib/money";
import {
  isWebPushConfigured,
  sendPushToSubscriptions,
  type PushPayload,
  type StoredPushSubscription,
} from "@/lib/notifications";
import { getReviewForWeek, reviewDue, weekStartKey } from "@/lib/review";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SubscriptionMap = Map<string, StoredPushSubscription[]>;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function deliverComputed(
  userId: string,
  subscriptions: StoredPushSubscription[],
  sentKeys: Set<string>,
  key: string,
  payload: PushPayload,
) {
  if (sentKeys.has(key)) return 0;
  const delivered = await sendPushToSubscriptions(userId, subscriptions, payload);
  if (delivered === 0) return 0;
  const db = await getDb();
  await db.insert(schema.entries).values({
    userId,
    module: "notifications",
    type: "sent",
    occurredAt: new Date(),
    payload: { key, tag: payload.tag },
  });
  sentKeys.add(key);
  return delivered;
}

async function deliverDueReminders(
  subscriptionsByUser: SubscriptionMap,
  now: Date,
) {
  const db = await getDb();
  const due = await db
    .select({ reminder: schema.reminders, item: schema.items })
    .from(schema.reminders)
    .leftJoin(schema.items, eq(schema.reminders.itemId, schema.items.id))
    .where(
      and(
        isNotNull(schema.reminders.nextFireAt),
        lte(schema.reminders.nextFireAt, now),
      ),
    );

  let delivered = 0;
  for (const { reminder, item } of due) {
    const subscriptions = subscriptionsByUser.get(reminder.userId) ?? [];
    if (subscriptions.length === 0) continue;
    const details = item?.payload as Partial<SubscriptionPayload> | undefined;
    const body =
      typeof details?.amount === "number"
        ? `${formatSGD(details.amount)} is due. Open Money when you’ve paid it.`
        : "A saved reminder is due. Open Megaapp to check it.";
    const count = await sendPushToSubscriptions(reminder.userId, subscriptions, {
      title: item ? `${item.title} renews today` : "Megaapp reminder",
      body,
      url: item?.module === "money" ? "/money" : "/today",
      tag: `reminder-${reminder.id}`,
    });
    if (count === 0) continue;
    delivered += count;

    let nextFireAt: Date | null = null;
    if (
      reminder.nextFireAt &&
      (reminder.schedule === "monthly" || reminder.schedule === "yearly")
    ) {
      nextFireAt = dayStart(
        nextRenewalKey(dayKey(reminder.nextFireAt), reminder.schedule),
      );
    }
    await db
      .update(schema.reminders)
      .set({ nextFireAt })
      .where(eq(schema.reminders.id, reminder.id));
  }
  return delivered;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return Response.json(
      { ok: false, error: "Web Push environment variables are incomplete." },
      { status: 503 },
    );
  }

  const db = await getDb();
  const now = new Date();
  const today = todayKey();
  const hour = singaporeHour(now);
  const subscriptions = await db.select().from(schema.pushSubscriptions);
  const subscriptionsByUser: SubscriptionMap = new Map();
  for (const subscription of subscriptions) {
    const list = subscriptionsByUser.get(subscription.userId) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.userId, list);
  }
  if (subscriptionsByUser.size === 0) {
    return Response.json({ ok: true, devices: 0, delivered: 0 });
  }

  const userIds = [...subscriptionsByUser.keys()];
  const sentRows = await db
    .select({ userId: schema.entries.userId, payload: schema.entries.payload })
    .from(schema.entries)
    .where(
      and(
        inArray(schema.entries.userId, userIds),
        eq(schema.entries.module, "notifications"),
        eq(schema.entries.type, "sent"),
        gte(schema.entries.occurredAt, dayStart(addDays(today, -7))),
        lte(schema.entries.occurredAt, dayEnd(today)),
      ),
    );
  const sentByUser = new Map<string, Set<string>>();
  for (const row of sentRows) {
    const key = (row.payload as { key?: unknown }).key;
    if (typeof key !== "string") continue;
    const keys = sentByUser.get(row.userId) ?? new Set<string>();
    keys.add(key);
    sentByUser.set(row.userId, keys);
  }

  let delivered = await deliverDueReminders(subscriptionsByUser, now);
  for (const [userId, devices] of subscriptionsByUser) {
    const sentKeys = sentByUser.get(userId) ?? new Set<string>();

    // The route supports a morning run on paid plans or another scheduler.
    if (hour >= 6 && hour <= 10) {
      const data = await getTodayData(userId);
      const openTasks = data.taskGroups.overdue.length + data.taskGroups.today.length;
      const openHabits = data.habits.filter((habit) => !habit.checkedToday).length;
      delivered += await deliverComputed(
        userId,
        devices,
        sentKeys,
        `morning:${today}`,
        {
          title: "Your day in Megaapp",
          body: `${openTasks} task${openTasks === 1 ? "" : "s"} and ${openHabits} habit${openHabits === 1 ? "" : "s"} waiting.`,
          url: "/today",
          tag: "morning-brief",
        },
      );
    }

    if (hour >= 20) {
      const habits = await getHabits(userId);
      const atRisk = habits.filter(
        (habit) => !habit.checkedToday && habit.streakCurrent >= 3,
      );
      if (atRisk.length > 0) {
        const first = atRisk[0];
        delivered += await deliverComputed(
          userId,
          devices,
          sentKeys,
          `streak-risk:${today}`,
          {
            title: `${first.streakCurrent}-day streak at risk`,
            body:
              atRisk.length === 1
                ? `${first.title} is still unchecked — one tap keeps it alive.`
                : `${first.title} and ${atRisk.length - 1} more are still unchecked.`,
            url: "/today",
            tag: "streak-risk",
          },
        );
      }
    }

    if (hour >= 18 && reviewDue(today)) {
      const review = await getReviewForWeek(userId, weekStartKey(today));
      if (!review) {
        delivered += await deliverComputed(
          userId,
          devices,
          sentKeys,
          `weekly-review:${weekStartKey(today)}`,
          {
            title: "Close out your week",
            body: "Your weekly review is ready — add three thoughts while the week is fresh.",
            url: "/review",
            tag: "weekly-review",
          },
        );
      }
    }
  }

  return Response.json({
    ok: true,
    devices: subscriptions.length,
    users: subscriptionsByUser.size,
    delivered,
    singaporeHour: hour,
  });
}
