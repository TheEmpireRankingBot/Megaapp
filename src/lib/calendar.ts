import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayEnd, dayKey, dayStart, todayKey } from "@/lib/dates";

export type CalendarEventPayload = {
  startAt: string;
  endAt?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
};

export type CalendarEvent = CalendarEventPayload & {
  itemId: string;
  title: string;
  start: Date;
  end: Date | null;
  day: string;
};

function toEvent(row: typeof schema.items.$inferSelect): CalendarEvent | null {
  const payload = row.payload as Partial<CalendarEventPayload>;
  if (typeof payload.startAt !== "string") return null;
  const start = new Date(payload.startAt);
  const end = typeof payload.endAt === "string" ? new Date(payload.endAt) : null;
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) return null;
  return {
    itemId: row.id,
    title: row.title,
    startAt: payload.startAt,
    endAt: payload.endAt,
    allDay: payload.allDay === true,
    location: typeof payload.location === "string" ? payload.location : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : undefined,
    start,
    end,
    day: dayKey(start),
  };
}

export async function getCalendarEvents(
  userId: string,
  fromDay = todayKey(),
  toDay = addDays(todayKey(), 30),
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "calendar"),
        eq(schema.items.type, "event"),
        eq(schema.items.status, "active"),
      ),
    );
  const from = dayStart(fromDay);
  const to = dayEnd(toDay);
  return rows
    .map(toEvent)
    .filter((event): event is CalendarEvent => Boolean(event && event.start >= from && event.start <= to))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type PlanningBrief = {
  agenda: CalendarEvent[];
  topGoal: {
    itemId: string;
    title: string;
    targetDate: string | null;
    done: number;
    total: number;
  } | null;
};

/** One Today-screen query for calendar + goal nudges. */
export async function getPlanningBrief(userId: string): Promise<PlanningBrief> {
  const db = await getDb();
  const today = todayKey();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        inArray(schema.items.module, ["calendar", "goals"]),
        eq(schema.items.status, "active"),
      ),
    );
  const agenda = rows
    .filter((row) => row.module === "calendar" && row.type === "event")
    .map(toEvent)
    .filter((event): event is CalendarEvent => event?.day === today)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const goals = rows
    .filter((row) => row.module === "goals" && row.type === "goal")
    .map((row) => {
      const payload = row.payload as {
        targetDate?: unknown;
        milestones?: { done?: unknown }[];
      };
      const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
      const targetDate =
        typeof payload.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.targetDate)
          ? payload.targetDate
          : null;
      return {
        itemId: row.id,
        title: row.title,
        targetDate,
        done: milestones.filter((milestone) => milestone.done === true).length,
        total: milestones.length,
      };
    })
    .sort((a, b) => (a.targetDate ?? "9999-99-99").localeCompare(b.targetDate ?? "9999-99-99"));

  return { agenda, topGoal: goals[0] ?? null };
}
