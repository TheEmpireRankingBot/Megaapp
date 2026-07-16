import { getCurrentUser } from "@/lib/user";
import { getHabits } from "@/lib/data";
import { HabitsClient } from "@/components/habits-client";

export const metadata = { title: "Habits" };
export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await getCurrentUser();
  const habits = await getHabits(user.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Habits</h1>

      <HabitsClient initialHabits={habits} />

      <p className="text-xs text-black/40 dark:text-white/40">
        The seven dots are your last week, oldest to newest. Check-ins count
        toward the day they happen (Singapore time).
      </p>
    </div>
  );
}
