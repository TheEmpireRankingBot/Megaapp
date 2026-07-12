import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayKey, dayStart, lastNDays, todayKey } from "@/lib/dates";

export const WATER_GOAL_ML = 2000;

export type HealthLog = {
  entryId: string;
  day: string;
  type: string;
  value: number | null;
  note: string;
};

export type HealthSummary = {
  /** kg series over the last 30 days, oldest first (one point per day, last wins). */
  weightSeries: { day: string; kg: number }[];
  latestWeight: number | null;
  weightDelta30d: number | null;
  /** hours per day for the last 7 days, null = not logged. */
  sleepWeek: { day: string; hours: number | null }[];
  sleepAvg7d: number | null;
  waterTodayMl: number;
  workoutsThisWeek: number;
  recent: HealthLog[];
};

export async function getHealthSummary(userId: string): Promise<HealthSummary> {
  const db = await getDb();
  const today = todayKey();
  const windowStart = dayStart(addDays(today, -30));

  const rows = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "health"),
        gte(schema.entries.occurredAt, windowStart),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt));

  const weightByDay = new Map<string, number>();
  const sleepByDay = new Map<string, number>();
  let waterTodayMl = 0;
  let workoutsThisWeek = 0;
  const week = new Set(lastNDays(7));

  // rows are newest-first; first write per day wins = latest log of the day.
  for (const r of rows) {
    const day = dayKey(r.occurredAt);
    const value = r.value === null ? null : Number(r.value);
    if (r.type === "weight" && value !== null && !weightByDay.has(day)) {
      weightByDay.set(day, value);
    } else if (r.type === "sleep" && value !== null && !sleepByDay.has(day)) {
      sleepByDay.set(day, value);
    } else if (r.type === "water" && value !== null && day === today) {
      waterTodayMl += value;
    } else if (r.type === "workout" && week.has(day)) {
      workoutsThisWeek += 1;
    }
  }

  const weightSeries = [...weightByDay.entries()]
    .map(([day, kg]) => ({ day, kg }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const latestWeight =
    weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].kg : null;
  const weightDelta30d =
    weightSeries.length > 1 ? latestWeight! - weightSeries[0].kg : null;

  const sleepWeek = lastNDays(7).map((day) => ({
    day,
    hours: sleepByDay.get(day) ?? null,
  }));
  const sleepLogged = sleepWeek.filter((d) => d.hours !== null);
  const sleepAvg7d =
    sleepLogged.length > 0
      ? sleepLogged.reduce((s, d) => s + (d.hours ?? 0), 0) / sleepLogged.length
      : null;

  return {
    weightSeries,
    latestWeight,
    weightDelta30d,
    sleepWeek,
    sleepAvg7d,
    waterTodayMl,
    workoutsThisWeek,
    recent: rows.slice(0, 20).map((r) => ({
      entryId: r.id,
      day: dayKey(r.occurredAt),
      type: r.type,
      value: r.value === null ? null : Number(r.value),
      note: r.note ?? "",
    })),
  };
}
