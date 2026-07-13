import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getHabits } from "@/lib/data";

export type GoalMilestone = { id: string; title: string; done: boolean };
export type GoalPayload = {
  horizon: "month" | "quarter" | "year";
  targetDate?: string;
  linkedItemIds: string[];
  milestones: GoalMilestone[];
};

export type GoalView = {
  itemId: string;
  title: string;
  payload: GoalPayload;
  linked: {
    itemId: string;
    title: string;
    module: "tasks" | "habits";
    done: boolean;
    detail: string;
  }[];
  completed: number;
  total: number;
  progress: number;
};

function normalizePayload(payload: unknown): GoalPayload {
  const value = payload as Partial<GoalPayload>;
  const horizon =
    value.horizon === "month" || value.horizon === "quarter" || value.horizon === "year"
      ? value.horizon
      : "quarter";
  return {
    horizon,
    targetDate:
      typeof value.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.targetDate)
        ? value.targetDate
        : undefined,
    linkedItemIds: Array.isArray(value.linkedItemIds)
      ? value.linkedItemIds.filter((id): id is string => typeof id === "string")
      : [],
    milestones: Array.isArray(value.milestones)
      ? value.milestones
          .filter(
            (milestone): milestone is GoalMilestone =>
              typeof milestone?.id === "string" && typeof milestone.title === "string",
          )
          .map((milestone) => ({ ...milestone, done: milestone.done === true }))
      : [],
  };
}

export async function getGoalsData(userId: string) {
  const db = await getDb();
  const [goalRows, taskRows, habitViews] = await Promise.all([
    db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "goals"),
          eq(schema.items.type, "goal"),
          eq(schema.items.status, "active"),
        ),
      ),
    db
      .select({ itemId: schema.items.id, title: schema.items.title, doneAt: schema.tasks.doneAt })
      .from(schema.tasks)
      .innerJoin(schema.items, eq(schema.tasks.itemId, schema.items.id))
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.status, "active"),
        ),
      ),
    getHabits(userId),
  ]);

  const candidates = [
    ...taskRows.map((task) => ({
      itemId: task.itemId,
      title: task.title,
      module: "tasks" as const,
      done: task.doneAt !== null,
      detail: task.doneAt ? "completed" : "task",
    })),
    ...habitViews.map((habit) => ({
      itemId: habit.itemId,
      title: habit.title,
      module: "habits" as const,
      done: habit.streakCurrent >= 7,
      detail: habit.streakCurrent ? `${habit.streakCurrent}d streak` : "habit",
    })),
  ];
  const candidateById = new Map(candidates.map((candidate) => [candidate.itemId, candidate]));

  const goals: GoalView[] = goalRows.map((row) => {
    const payload = normalizePayload(row.payload);
    const linked = payload.linkedItemIds
      .map((id) => candidateById.get(id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const completed =
      payload.milestones.filter((milestone) => milestone.done).length +
      linked.filter((item) => item.done).length;
    const total = payload.milestones.length + linked.length;
    return {
      itemId: row.id,
      title: row.title,
      payload,
      linked,
      completed,
      total,
      progress: total ? completed / total : 0,
    };
  });
  goals.sort((a, b) =>
    (a.payload.targetDate ?? "9999-99-99").localeCompare(
      b.payload.targetDate ?? "9999-99-99",
    ),
  );
  return { goals, candidates };
}
