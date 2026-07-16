"use client";

import { type FormEvent, useState } from "react";
import { Check, Circle, X } from "lucide-react";
import { deleteItem, toggleGoalMilestone } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import type { GoalView } from "@/lib/goals";

export function GoalCard({ initialGoal }: { initialGoal: GoalView }) {
  const [goal, setGoal] = useState(initialGoal);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function toggle(event: FormEvent<HTMLFormElement>, milestoneId: string) {
    event.preventDefault();
    if (pending.has(milestoneId)) return;
    const previous = goal;
    const milestones = goal.payload.milestones.map((milestone) =>
      milestone.id === milestoneId ? { ...milestone, done: !milestone.done } : milestone,
    );
    const completed =
      milestones.filter((milestone) => milestone.done).length +
      goal.linked.filter((item) => item.done).length;
    setGoal({
      ...goal,
      payload: { ...goal.payload, milestones },
      completed,
      progress: goal.total ? completed / goal.total : 0,
    });
    setPending((current) => new Set(current).add(milestoneId));
    try {
      await toggleGoalMilestone(new FormData(event.currentTarget));
    } catch {
      setGoal(previous);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(milestoneId);
        return next;
      });
    }
  }

  return (
    <article className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-semibold">{goal.title}</h2>
            <span className="text-xs text-black/40 dark:text-white/40">{goal.payload.horizon}</span>
            {goal.payload.targetDate && (
              <span className="text-xs text-black/40 dark:text-white/40">by {formatDay(goal.payload.targetDate)}</span>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${goal.progress * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            {goal.completed}/{goal.total || 0} steps complete
          </p>
        </div>
        <form action={deleteItem}>
          <input type="hidden" name="itemId" value={goal.itemId} />
          <button aria-label={`Delete goal ${goal.title}`} className="rounded p-1 text-black/30 hover:text-red-500 dark:text-white/30">
            <X size={14} />
          </button>
        </form>
      </div>

      {goal.payload.milestones.length > 0 && (
        <div className="mt-4 space-y-1">
          {goal.payload.milestones.map((milestone) => (
            <form key={milestone.id} onSubmit={(event) => toggle(event, milestone.id)}>
              <input type="hidden" name="itemId" value={goal.itemId} />
              <input type="hidden" name="milestoneId" value={milestone.id} />
              <button disabled={pending.has(milestone.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/[.03] disabled:opacity-60 dark:hover:bg-white/[.04] ${milestone.done ? "text-black/40 line-through dark:text-white/40" : ""}`}>
                {milestone.done ? <Check size={15} className="text-emerald-500" /> : <Circle size={15} className="text-black/25 dark:text-white/25" />}
                {milestone.title}
              </button>
            </form>
          ))}
        </div>
      )}

      {goal.linked.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-3 dark:border-white/10">
          {goal.linked.map((item) => (
            <span key={item.itemId} className={`rounded-full px-2.5 py-1 text-xs ${item.done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-black/5 dark:bg-white/10"}`}>
              {item.title} · {item.detail}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
