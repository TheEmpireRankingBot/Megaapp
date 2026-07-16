"use client";

import { type FormEvent, useState } from "react";
import { archiveHabit } from "@/lib/actions";
import type { HabitView } from "@/lib/data";
import { HabitAdd } from "@/components/habit-add";
import { HabitRow } from "@/components/habit-row";

export function HabitsClient({ initialHabits }: { initialHabits: HabitView[] }) {
  const [habits, setHabits] = useState(initialHabits);
  const [archiveError, setArchiveError] = useState("");

  async function archive(event: FormEvent<HTMLFormElement>, habit: HabitView) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setArchiveError("");
    setHabits((current) => current.filter((candidate) => candidate.habitId !== habit.habitId));
    try {
      await archiveHabit(formData);
    } catch {
      setHabits((current) =>
        current.some((candidate) => candidate.habitId === habit.habitId)
          ? current
          : [...current, habit],
      );
      setArchiveError(`Couldn’t archive ${habit.title}. Try again.`);
    }
  }

  return (
    <>
      <HabitAdd
        onCreated={(habit) =>
          setHabits((current) =>
            current.some((candidate) => candidate.habitId === habit.habitId)
              ? current
              : [...current, habit],
          )
        }
      />

      {habits.length === 0 ? (
        <p className="text-sm text-black/45 dark:text-white/45">
          No habits yet. Keep them small and daily — a streak you can actually
          protect beats an ambitious one you can&apos;t.
        </p>
      ) : (
        <div className="space-y-1">
          {habits.map((habit) => (
            <div key={habit.habitId} className="group flex items-center gap-2">
              <div className="flex-1">
                <HabitRow habit={habit} />
              </div>
              <form onSubmit={(event) => archive(event, habit)}>
                <input type="hidden" name="itemId" value={habit.itemId} />
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

      {archiveError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {archiveError}
        </p>
      )}
    </>
  );
}
