import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  addDays,
  dayEnd,
  dayKey,
  dayStart,
  daysBetween,
  formatCompactDay,
  lastNDays,
  todayKey,
} from "@/lib/dates";
import { formatSGD } from "@/lib/money";
import { weekStartKey } from "@/lib/review";

export const INSIGHT_WINDOW_DAYS = 84;

export type HeatmapDay = {
  day: string;
  rate: number | null;
  checked: number;
  total: number;
};

export type RelationshipPoint = {
  day: string;
  x: number;
  y: number;
};

export type Relationship = {
  coefficient: number | null;
  samples: number;
  points: RelationshipPoint[];
};

export type HabitConsistency = {
  itemId: string;
  title: string;
  checkedDays: number;
  eligibleDays: number;
  rate: number;
};

export type InsightData = {
  headline: { title: string; detail: string; tone: "emerald" | "neutral" };
  heatmap: HeatmapDay[];
  habits: HabitConsistency[];
  weeklySpend: { weekStart: string; label: string; amount: number }[];
  moodHabit: Relationship;
  sleepMood: Relationship;
  coverage: {
    moodDays: number;
    sleepNights: number;
    expenses: number;
    habitCheckins: number;
  };
};

function pearson(points: RelationshipPoint[]) {
  if (points.length < 2) return null;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let xSquares = 0;
  let ySquares = 0;
  for (const point of points) {
    const x = point.x - xMean;
    const y = point.y - yMean;
    numerator += x * y;
    xSquares += x * x;
    ySquares += y * y;
  }
  const denominator = Math.sqrt(xSquares * ySquares);
  return denominator === 0 ? null : numerator / denominator;
}

function relationship(points: RelationshipPoint[]): Relationship {
  return { coefficient: pearson(points), samples: points.length, points };
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function makeHeadline(
  moodHabit: Relationship,
  sleepMood: Relationship,
  weeklySpend: InsightData["weeklySpend"],
  habits: HabitConsistency[],
  coverage: InsightData["coverage"],
): InsightData["headline"] {
  const positivePatterns = [
    sleepMood.samples >= 5 && (sleepMood.coefficient ?? 0) >= 0.25
      ? {
          score: sleepMood.coefficient ?? 0,
          title: "Better sleep and better moods move together",
          detail: `Across ${sleepMood.samples} matched nights, more sleep lined up with a better mood the next day. It’s a pattern, not proof of cause.`,
        }
      : null,
    moodHabit.samples >= 7 && (moodHabit.coefficient ?? 0) >= 0.25
      ? {
          score: moodHabit.coefficient ?? 0,
          title: "Your habits and mood move together",
          detail: `Across ${moodHabit.samples} journal days, higher habit completion lined up with a better mood. Keep logging to see if it holds.`,
        }
      : null,
  ].filter((pattern): pattern is NonNullable<typeof pattern> => pattern !== null);
  const strongest = positivePatterns.sort((a, b) => b.score - a.score)[0];
  if (strongest) return { ...strongest, tone: "emerald" };

  // Compare the last three completed weeks with the three before them. The
  // current partial week is deliberately excluded to avoid a false drop.
  const prior = weeklySpend.slice(1, 4).map((week) => week.amount);
  const recent = weeklySpend.slice(4, 7).map((week) => week.amount);
  const priorAverage = average(prior);
  const recentAverage = average(recent);
  if (priorAverage > 0 && prior.some(Boolean) && recent.some(Boolean)) {
    const change = (recentAverage - priorAverage) / priorAverage;
    if (Math.abs(change) >= 0.15) {
      const direction = change > 0 ? "up" : "down";
      return {
        title: `Your weekly spending is trending ${direction}`,
        detail: `The last three completed weeks averaged ${formatSGD(recentAverage)}, ${Math.round(Math.abs(change) * 100)}% ${direction} from the three before.`,
        tone: change < 0 ? "emerald" : "neutral",
      };
    }
  }

  const best = habits.find((habit) => habit.eligibleDays >= 7);
  if (best) {
    return {
      title: `${best.title} is your steadiest habit`,
      detail: `You checked it on ${Math.round(best.rate * 100)}% of eligible days in this 12-week view.`,
      tone: best.rate >= 0.7 ? "emerald" : "neutral",
    };
  }

  const totalSignals =
    coverage.moodDays +
    coverage.sleepNights +
    coverage.expenses +
    coverage.habitCheckins;
  return totalSignals === 0
    ? {
        title: "Your patterns will appear here",
        detail: "Log a mood, sleep, an expense, or a habit check-in. Insights get useful as ordinary days add up.",
        tone: "neutral",
      }
    : {
        title: "Your first pattern is taking shape",
        detail: `${totalSignals} signals are in the 12-week view. A few more ordinary days will make comparisons meaningful.`,
        tone: "neutral",
      };
}

export async function getInsights(userId: string): Promise<InsightData> {
  const db = await getDb();
  const today = todayKey();
  const days = lastNDays(INSIGHT_WINDOW_DAYS);
  const firstDay = days[0];

  const [entries, habitRows] = await Promise.all([
    db
      .select()
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.userId, userId),
          inArray(schema.entries.module, ["habits", "journal", "money", "health"]),
          gte(schema.entries.occurredAt, dayStart(firstDay)),
          lte(schema.entries.occurredAt, dayEnd(today)),
        ),
      ),
    db
      .select({
        itemId: schema.items.id,
        title: schema.items.title,
        createdAt: schema.items.createdAt,
      })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "habits"),
          eq(schema.items.type, "habit"),
          eq(schema.items.status, "active"),
        ),
      ),
  ]);

  const habits = habitRows.map((habit) => ({
    ...habit,
    createdKey: dayKey(habit.createdAt),
  }));
  const activeHabitIds = new Set(habits.map((habit) => habit.itemId));
  const moodByDay = new Map<string, number>();
  const sleepByDay = new Map<string, number[]>();
  const spendByDay = new Map<string, number>();
  const checksByDay = new Map<string, Set<string>>();
  let expenses = 0;
  let habitCheckins = 0;

  for (const entry of entries) {
    const day = dayKey(entry.occurredAt);
    if (entry.module === "journal" && entry.type === "journal") {
      const mood = (entry.payload as { mood?: unknown }).mood;
      if (typeof mood === "number" && mood >= 1 && mood <= 5) {
        moodByDay.set(day, mood);
      }
    } else if (entry.module === "health" && entry.type === "sleep") {
      const hours = Number(entry.value);
      if (Number.isFinite(hours) && hours > 0) {
        const values = sleepByDay.get(day) ?? [];
        values.push(hours);
        sleepByDay.set(day, values);
      }
    } else if (entry.module === "money" && entry.type === "expense") {
      const amount = Number(entry.value);
      if (Number.isFinite(amount) && amount > 0) {
        spendByDay.set(day, (spendByDay.get(day) ?? 0) + amount);
        expenses += 1;
      }
    } else if (
      entry.module === "habits" &&
      entry.type === "checkin" &&
      entry.itemId &&
      activeHabitIds.has(entry.itemId)
    ) {
      const ids = checksByDay.get(day) ?? new Set<string>();
      if (!ids.has(entry.itemId)) habitCheckins += 1;
      ids.add(entry.itemId);
      checksByDay.set(day, ids);
    }
  }

  const heatmap = days.map((day): HeatmapDay => {
    const eligible = habits.filter((habit) => habit.createdKey <= day);
    const checkedIds = checksByDay.get(day) ?? new Set<string>();
    const checked = eligible.filter((habit) => checkedIds.has(habit.itemId)).length;
    return {
      day,
      checked,
      total: eligible.length,
      rate: eligible.length ? checked / eligible.length : null,
    };
  });
  const heatmapByDay = new Map(heatmap.map((day) => [day.day, day]));

  const moodHabitPoints = [...moodByDay.entries()]
    .map(([day, mood]) => {
      const rate = heatmapByDay.get(day)?.rate;
      return rate === null || rate === undefined ? null : { day, x: rate, y: mood };
    })
    .filter((point): point is RelationshipPoint => point !== null)
    .sort((a, b) => a.day.localeCompare(b.day));

  const sleepMoodPoints = [...sleepByDay.entries()]
    .map(([day, hours]) => {
      const mood = moodByDay.get(addDays(day, 1));
      return mood === undefined
        ? null
        : { day, x: average(hours), y: mood };
    })
    .filter((point): point is RelationshipPoint => point !== null)
    .sort((a, b) => a.day.localeCompare(b.day));

  const currentWeek = weekStartKey(today);
  const weekStarts = Array.from({ length: 8 }, (_, index) =>
    addDays(currentWeek, (index - 7) * 7),
  );
  const spendByWeek = new Map(weekStarts.map((week) => [week, 0]));
  for (const [day, amount] of spendByDay) {
    const week = weekStartKey(day);
    if (spendByWeek.has(week)) spendByWeek.set(week, (spendByWeek.get(week) ?? 0) + amount);
  }
  const weeklySpend = weekStarts.map((weekStart) => ({
    weekStart,
    label: formatCompactDay(weekStart),
    amount: spendByWeek.get(weekStart) ?? 0,
  }));

  const habitConsistency = habits
    .map((habit): HabitConsistency => {
      const eligibleStart = habit.createdKey > firstDay ? habit.createdKey : firstDay;
      const eligibleDays = Math.max(0, daysBetween(eligibleStart, today) + 1);
      const checkedDays = days.filter(
        (day) => day >= habit.createdKey && checksByDay.get(day)?.has(habit.itemId),
      ).length;
      return {
        itemId: habit.itemId,
        title: habit.title,
        checkedDays,
        eligibleDays,
        rate: eligibleDays ? checkedDays / eligibleDays : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.checkedDays - a.checkedDays);

  const moodHabit = relationship(moodHabitPoints);
  const sleepMood = relationship(sleepMoodPoints);
  const coverage = {
    moodDays: moodByDay.size,
    sleepNights: sleepByDay.size,
    expenses,
    habitCheckins,
  };

  return {
    headline: makeHeadline(moodHabit, sleepMood, weeklySpend, habitConsistency, coverage),
    heatmap,
    habits: habitConsistency,
    weeklySpend,
    moodHabit,
    sleepMood,
    coverage,
  };
}
