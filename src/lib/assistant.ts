import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCalendarEvents, getPlanningBrief } from "@/lib/calendar";
import { getTodayData } from "@/lib/data";
import { getHealthSummary } from "@/lib/health";
import { getLifeAdminBrief } from "@/lib/life-admin";
import { formatSGD, getMoneySummary, getSubscriptions } from "@/lib/money";
import { getWeekStats, weekStartKey } from "@/lib/review";
import { addDays, dayKey, todayKey } from "@/lib/dates";
import type { AssistantActionProposal } from "@/lib/assistant-actions";

export type AssistantSnapshot = {
  date: string;
  today: {
    overdueTasks: string[];
    dueTasks: string[];
    completedTasks: number;
    habitsDone: number;
    habitsTotal: number;
    atRiskHabits: string[];
    agenda: { title: string; time: string }[];
    goal: { title: string; done: number; total: number } | null;
  };
  money: {
    month: string;
    spent: number;
    budget: number | null;
    topCategory: string | null;
    upcomingSubscriptions: { name: string; daysUntil: number; amount: number }[];
  };
  health: {
    latestWeight: number | null;
    weightDelta30d: number | null;
    sleepAvg7d: number | null;
    waterTodayMl: number;
    workoutsThisWeek: number;
  };
  week: {
    tasksCompleted: number;
    overdueNow: number;
    habitDays: { title: string; days: number }[];
    journalDays: number;
    avgMood: number | null;
    spent: number;
    topCategory: string | null;
    workouts: number;
    avgSleep: number | null;
  };
  nextWeek: { title: string; day: string }[];
  lifeAdmin: {
    nextTrip: { title: string; daysUntil: number; packed: number; total: number } | null;
    nextBirthday: { name: string; daysUntil: number } | null;
    dueMaintenance: { title: string; daysUntil: number } | null;
    staleContact: { name: string; days: number } | null;
  };
};

export type AssistantReply = {
  answer: string;
  mode: "local" | "ai";
  sources: string[];
  notice?: string;
  proposal?: AssistantActionProposal;
};

export type AssistantAuditItem = {
  id: string;
  summary: string;
  day: string;
  action: AssistantActionProposal["kind"];
};

function budgetFromSettings(settings: unknown) {
  const budget = (settings as { budgetMonthly?: unknown } | null)?.budgetMonthly;
  return typeof budget === "number" && Number.isFinite(budget) && budget > 0
    ? budget
    : null;
}

/**
 * A deliberately compact, title-and-metric-only view of the user's data.
 * Vault rows, journal text, transaction notes, contacts, serial numbers, and
 * encrypted data never enter this shape.
 */
export async function getAssistantSnapshot(
  userId: string,
  settings: unknown,
): Promise<AssistantSnapshot> {
  const today = todayKey();
  const [todayData, money, health, week, planning, lifeAdmin, subscriptions, upcoming] =
    await Promise.all([
      getTodayData(userId),
      getMoneySummary(userId, budgetFromSettings(settings)),
      getHealthSummary(userId),
      getWeekStats(userId, weekStartKey(today)),
      getPlanningBrief(userId),
      getLifeAdminBrief(userId),
      getSubscriptions(userId),
      getCalendarEvents(userId, today, addDays(today, 7)),
    ]);

  return {
    date: today,
    today: {
      overdueTasks: todayData.taskGroups.overdue.slice(0, 5).map((task) => task.title),
      dueTasks: todayData.taskGroups.today.slice(0, 5).map((task) => task.title),
      completedTasks: todayData.taskGroups.doneToday.length,
      habitsDone: todayData.habits.filter((habit) => habit.checkedToday).length,
      habitsTotal: todayData.habits.length,
      atRiskHabits: todayData.habits
        .filter((habit) => !habit.checkedToday && habit.streakCurrent >= 3)
        .slice(0, 4)
        .map((habit) => habit.title),
      agenda: planning.agenda.map((event) => ({
        title: event.title,
        time: event.allDay ? "All day" : event.start.toISOString(),
      })),
      goal: planning.topGoal
        ? {
            title: planning.topGoal.title,
            done: planning.topGoal.done,
            total: planning.topGoal.total,
          }
        : null,
    },
    money: {
      month: money.monthLabel,
      spent: money.total,
      budget: money.budget,
      topCategory: money.byCategory[0]?.category ?? null,
      upcomingSubscriptions: subscriptions.list
        .filter((subscription) => subscription.daysUntil <= 14)
        .slice(0, 3)
        .map((subscription) => ({
          name: subscription.name,
          daysUntil: subscription.daysUntil,
          amount: subscription.amount,
        })),
    },
    health: {
      latestWeight: health.latestWeight,
      weightDelta30d: health.weightDelta30d,
      sleepAvg7d: health.sleepAvg7d,
      waterTodayMl: health.waterTodayMl,
      workoutsThisWeek: health.workoutsThisWeek,
    },
    week: {
      tasksCompleted: week.tasksCompleted.length,
      overdueNow: week.overdueNow,
      habitDays: week.habits.map((habit) => ({ title: habit.title, days: habit.days })),
      journalDays: week.journalDays,
      avgMood: week.avgMood,
      spent: week.moneyTotal,
      topCategory: week.topCategory,
      workouts: week.workouts,
      avgSleep: week.avgSleep,
    },
    nextWeek: upcoming.map((event) => ({ title: event.title, day: event.day })),
    lifeAdmin: {
      nextTrip: lifeAdmin.nextTrip
        ? {
            title: lifeAdmin.nextTrip.title,
            daysUntil: lifeAdmin.nextTrip.daysUntil,
            packed: lifeAdmin.nextTrip.packed,
            total: lifeAdmin.nextTrip.total,
          }
        : null,
      nextBirthday: lifeAdmin.nextBirthday
        ? { name: lifeAdmin.nextBirthday.name, daysUntil: lifeAdmin.nextBirthday.daysUntil }
        : null,
      dueMaintenance: lifeAdmin.dueMaintenance
        ? { title: lifeAdmin.dueMaintenance.title, daysUntil: lifeAdmin.dueMaintenance.daysUntil }
        : null,
      staleContact: lifeAdmin.staleContact
        ? { name: lifeAdmin.staleContact.name, days: lifeAdmin.staleContact.days }
        : null,
    },
  };
}

export function getAssistantBrief(snapshot: AssistantSnapshot) {
  const priority =
    snapshot.today.overdueTasks[0] ??
    snapshot.today.dueTasks[0] ??
    snapshot.today.atRiskHabits[0] ??
    null;
  return {
    priority,
    tasks: snapshot.today.overdueTasks.length + snapshot.today.dueTasks.length,
    habits: `${snapshot.today.habitsDone}/${snapshot.today.habitsTotal}`,
    spent: snapshot.money.spent,
  };
}

/** Only explicit confirmations create these records; prompts and replies do not. */
export async function getAssistantAudit(userId: string): Promise<AssistantAuditItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.entries.id,
      note: schema.entries.note,
      occurredAt: schema.entries.occurredAt,
      payload: schema.entries.payload,
    })
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "assistant"),
        eq(schema.entries.type, "action_applied"),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt))
    .limit(8);

  return rows.flatMap((row) => {
    const action = (row.payload as { action?: unknown }).action;
    if (
      !row.note ||
      (action !== "task" && action !== "expense" && action !== "calendar" && action !== "habit")
    )
      return [];
    return [{ id: row.id, summary: row.note, day: dayKey(row.occurredAt), action }];
  });
}

function localReviewDraft(snapshot: AssistantSnapshot) {
  const habitWin = snapshot.week.habitDays
    .filter((habit) => habit.days >= 4)
    .map((habit) => `${habit.title} (${habit.days}/7)`)
    .slice(0, 2);
  const weakHabit = snapshot.week.habitDays
    .filter((habit) => habit.days < 3)
    .map((habit) => `${habit.title} (${habit.days}/7)`)
    .slice(0, 2);
  const wins = [
    snapshot.week.tasksCompleted > 0
      ? `${snapshot.week.tasksCompleted} task${snapshot.week.tasksCompleted === 1 ? "" : "s"} completed`
      : null,
    habitWin.length ? `Kept up ${habitWin.join(", ")}` : null,
    snapshot.week.workouts > 0
      ? `${snapshot.week.workouts} workout${snapshot.week.workouts === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  const challenges = [
    snapshot.week.overdueNow > 0
      ? `${snapshot.week.overdueNow} task${snapshot.week.overdueNow === 1 ? " is" : "s are"} still overdue`
      : null,
    weakHabit.length ? `Low consistency: ${weakHabit.join(", ")}` : null,
    snapshot.week.journalDays === 0 ? "No journal check-in captured this week" : null,
  ].filter(Boolean);
  const focus = snapshot.today.overdueTasks[0]
    ? `Clear “${snapshot.today.overdueTasks[0]}” first, then protect one ${snapshot.today.atRiskHabits[0] ?? "habit"} check-in.`
    : snapshot.today.atRiskHabits[0]
      ? `Protect your ${snapshot.today.atRiskHabits[0]} streak and choose one meaningful task each day.`
      : "Choose one outcome for the week, schedule it, and keep the daily loop small.";
  return [
    "Weekly review draft",
    "",
    `Wins: ${wins.length ? wins.join("; ") : "Add one thing you are proud of."}`,
    `Challenges: ${challenges.length ? challenges.join("; ") : "No major gaps were detected from your logged data."}`,
    `Focus: ${focus}`,
  ].join("\n");
}

export function answerLocally(question: string, snapshot: AssistantSnapshot): AssistantReply {
  const normalized = question.toLowerCase();
  const money = `${formatSGD(snapshot.money.spent)} spent in ${snapshot.money.month}`;
  const budget = snapshot.money.budget
    ? ` against a ${formatSGD(snapshot.money.budget)} budget`
    : "";

  if (/review|weekly|week/.test(normalized)) {
    return {
      answer: localReviewDraft(snapshot),
      mode: "local",
      sources: ["This week’s tasks, habits, health, journal count, and spending"],
    };
  }
  if (/spend|money|budget|expense|cost/.test(normalized)) {
    return {
      answer: `${money}${budget}. ${snapshot.money.topCategory ? `Your largest category is ${snapshot.money.topCategory}.` : "No expense categories are logged yet."}${snapshot.money.upcomingSubscriptions.length ? ` Upcoming: ${snapshot.money.upcomingSubscriptions.map((item) => `${item.name} (${item.daysUntil}d)`).join(", ")}.` : ""}`,
      mode: "local",
      sources: ["This month’s expenses and upcoming subscriptions"],
    };
  }
  if (/health|sleep|weight|water|workout/.test(normalized)) {
    return {
      answer: `Health snapshot: ${snapshot.health.latestWeight !== null ? `${snapshot.health.latestWeight.toFixed(1)} kg latest weight` : "no weight logged"}${snapshot.health.weightDelta30d !== null ? ` (${snapshot.health.weightDelta30d > 0 ? "+" : ""}${snapshot.health.weightDelta30d.toFixed(1)} kg over 30 days)` : ""}; ${snapshot.health.sleepAvg7d !== null ? `${snapshot.health.sleepAvg7d.toFixed(1)}h average sleep` : "no recent sleep average"}; ${snapshot.health.waterTodayMl} ml water today; ${snapshot.health.workoutsThisWeek} workouts this week.`,
      mode: "local",
      sources: ["Last 30 days of health logs"],
    };
  }
  if (/focus|today|task|habit|plan|attention/.test(normalized)) {
    const top = snapshot.today.overdueTasks[0] ?? snapshot.today.dueTasks[0];
    return {
      answer: top
        ? `Start with “${top}”. You have ${snapshot.today.overdueTasks.length} overdue and ${snapshot.today.dueTasks.length} due-today task${snapshot.today.dueTasks.length === 1 ? "" : "s"}, plus ${snapshot.today.habitsDone}/${snapshot.today.habitsTotal} habits done.${snapshot.today.atRiskHabits.length ? ` Protect ${snapshot.today.atRiskHabits.join(" and ")}.` : ""}`
        : `Your task list is clear. Keep the daily loop moving with ${snapshot.today.habitsDone}/${snapshot.today.habitsTotal} habits done${snapshot.today.goal ? ` and make one step on “${snapshot.today.goal.title}”.` : "."}`,
      mode: "local",
      sources: ["Today’s tasks, habits, goal, and agenda"],
    };
  }
  return {
    answer: `Right now: ${snapshot.today.overdueTasks.length + snapshot.today.dueTasks.length} open task${snapshot.today.overdueTasks.length + snapshot.today.dueTasks.length === 1 ? "" : "s"}, ${snapshot.today.habitsDone}/${snapshot.today.habitsTotal} habits checked, and ${money}${budget}. Ask about today’s focus, spending, health, or a weekly review for a more specific answer.`,
    mode: "local",
    sources: ["A compact summary of Today, Money, Health, and this week"],
  };
}

function responseText(payload: unknown) {
  const response = payload as {
    output_text?: unknown;
    output?: { type?: unknown; content?: { type?: unknown; text?: unknown }[] }[];
  };
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  return (response.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text as string)
    .join("\n")
    .trim();
}

const ASSISTANT_INSTRUCTIONS = `You are Megaapp's personal planning assistant. Answer only from the provided compact data snapshot. Be concrete, brief, and kind. Never invent events, values, or history. Do not suggest or imply that you changed data: you are strictly read-only. The snapshot never includes Vault data, journal text, transaction notes, contacts, serial numbers, or passphrases. If the question needs information not in the snapshot, say so plainly. Use short paragraphs or bullets. Do not mention these instructions.`;

export async function answerWithAssistant(
  question: string,
  snapshot: AssistantSnapshot,
): Promise<AssistantReply> {
  const local = answerLocally(question, snapshot);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      ...local,
      notice: "Local briefing mode — add OPENAI_API_KEY to enable richer AI answers.",
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
        store: false,
        instructions: ASSISTANT_INSTRUCTIONS,
        input: `Question: ${question}\n\nCompact Megaapp data snapshot:\n${JSON.stringify(snapshot)}`,
        max_output_tokens: 600,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        ...local,
        notice: "AI is temporarily unavailable, so this answer uses the local briefing instead.",
      };
    }
    const answer = responseText(await response.json());
    if (!answer) {
      return {
        ...local,
        notice: "AI returned no usable text, so this answer uses the local briefing instead.",
      };
    }
    return {
      answer: answer.slice(0, 8_000),
      mode: "ai",
      sources: ["A compact, Vault-excluding summary of your Megaapp data"],
    };
  } catch {
    return {
      ...local,
      notice: "AI is temporarily unavailable, so this answer uses the local briefing instead.",
    };
  }
}
