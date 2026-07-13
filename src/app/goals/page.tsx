import { Check, Circle, Target, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getGoalsData } from "@/lib/goals";
import { createGoal, deleteItem, toggleGoalMilestone } from "@/lib/actions";
import { formatDay } from "@/lib/dates";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const { goals, candidates } = await getGoalsData(user.id);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Turn a direction into milestones, tasks, and habits you can actually finish.
        </p>
      </header>

      <form action={createGoal} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          New goal
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            name="title"
            required
            placeholder="What are you aiming for?"
            className="min-w-52 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <select name="horizon" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black">
            <option value="month">this month</option>
            <option value="quarter">this quarter</option>
            <option value="year">this year</option>
          </select>
          <input
            name="targetDate"
            type="date"
            aria-label="Target date"
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:[color-scheme:dark]"
          />
        </div>
        <textarea
          name="milestones"
          rows={3}
          placeholder={"Milestones — one per line\nBook the course\nFinish the first project"}
          className="w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none dark:border-white/15"
        />
        {candidates.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-black/50 dark:text-white/50">
              Link existing tasks and habits
            </legend>
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {candidates.map((candidate) => (
                <label key={candidate.itemId} className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs dark:border-white/10">
                  <input type="checkbox" name="linkedItemId" value={candidate.itemId} />
                  {candidate.title}
                  <span className="text-black/35 dark:text-white/35">{candidate.module}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
          Create goal
        </button>
      </form>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <Target className="mx-auto text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">
            Start with one goal and two milestones. Small enough to move this week.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <article key={goal.itemId} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
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
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${goal.progress * 100}%` }} />
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
                    <form key={milestone.id} action={toggleGoalMilestone}>
                      <input type="hidden" name="itemId" value={goal.itemId} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/[.04] ${milestone.done ? "text-black/40 line-through dark:text-white/40" : ""}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}
