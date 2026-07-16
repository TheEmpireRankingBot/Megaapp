import { Target } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getGoalsData } from "@/lib/goals";
import { createGoal } from "@/lib/actions";
import { GoalCard } from "@/components/goal-card";

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
            <GoalCard key={goal.itemId} initialGoal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}
