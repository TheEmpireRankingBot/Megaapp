import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getHabits } from "@/lib/data";
import { createHabit, archiveHabit } from "@/lib/actions";
import { HabitRow } from "@/components/habit-row";

export const metadata = { title: "Habits" };
export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await getCurrentUser();
  const habits = await getHabits(user.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Habits</h1>

      <form action={createHabit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 py-2 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
          <Plus size={16} className="shrink-0 text-black/40 dark:text-white/40" />
          <input
            name="title"
            placeholder="New daily habit — e.g. Read 20 minutes…"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
          />
        </div>
      </form>

      {habits.length === 0 ? (
        <p className="text-sm text-black/45 dark:text-white/45">
          No habits yet. Keep them small and daily — a streak you can actually
          protect beats an ambitious one you can&apos;t.
        </p>
      ) : (
        <div className="space-y-1">
          {habits.map((h) => (
            <div key={h.habitId} className="group flex items-center gap-2">
              <div className="flex-1">
                <HabitRow habit={h} />
              </div>
              <form action={archiveHabit}>
                <input type="hidden" name="itemId" value={h.itemId} />
                <button
                  type="submit"
                  className="rounded px-2 py-1 text-xs text-black/35 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-white/35"
                >
                  archive
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-black/40 dark:text-white/40">
        The seven dots are your last week, oldest to newest. Check-ins count
        toward the day they happen (Singapore time).
      </p>
    </div>
  );
}
