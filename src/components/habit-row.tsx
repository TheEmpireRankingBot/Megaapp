"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame } from "lucide-react";
import { toggleHabit } from "@/lib/actions";
import type { HabitView } from "@/lib/data";

export function HabitRow({
  habit,
  showWeek = true,
}: {
  habit: HabitView;
  showWeek?: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(habit.checkedToday);
  const [pending, setPending] = useState(false);
  const visibleStreak = checked
    ? Math.max(1, habit.streakCurrent)
    : habit.checkedToday
      ? 0
      : habit.streakCurrent;

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/[.03] dark:hover:bg-white/[.04]">
      <form
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (pending) return;
          const formData = new FormData(event.currentTarget);
          const next = !checked;
          setChecked(next);
          setPending(true);
          window.dispatchEvent(new CustomEvent("megaapp:progress-delta", { detail: { delta: next ? 1 : -1 } }));
          try {
            await toggleHabit(formData);
            router.refresh();
          } catch {
            setChecked(!next);
            window.dispatchEvent(new CustomEvent("megaapp:progress-delta", { detail: { delta: next ? -1 : 1 } }));
          } finally {
            setPending(false);
          }
        }}
      >
        <input type="hidden" name="habitId" value={habit.habitId} />
        <button
          type="submit"
          disabled={pending}
          aria-label={
            checked ? `Uncheck ${habit.title}` : `Check ${habit.title}`
          }
          className={`flex size-7 items-center justify-center rounded-full border transition-all ${
            checked
              ? "scale-105 border-emerald-500 bg-emerald-500 text-white"
              : "border-black/25 dark:border-white/30 hover:border-emerald-500"
          }`}
        >
          {checked && <Check size={16} strokeWidth={3} />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{habit.title}</p>
        <p className="flex items-center gap-1 text-xs text-black/45 dark:text-white/45">
          {visibleStreak > 0 ? (
            <>
              <Flame size={12} className="text-orange-500" />
              {visibleStreak} day streak
              {habit.streakBest > visibleStreak &&
                ` · best ${habit.streakBest}`}
            </>
          ) : habit.streakBest > 0 ? (
            `best streak ${habit.streakBest} — start again today`
          ) : (
            "no streak yet — today's the day"
          )}
        </p>
      </div>

      {showWeek && (
        <div className="flex gap-1" aria-label="Last 7 days">
          {habit.last7.map(({ day, checked }) => (
            <span
              key={day}
              title={day}
              className={`size-2 rounded-full ${
                checked
                  ? "bg-emerald-500"
                  : "bg-black/10 dark:bg-white/15"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
