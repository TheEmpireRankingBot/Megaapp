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
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/[.03] dark:hover:bg-white/[.04]">
      <form action={toggleHabit}>
        <input type="hidden" name="habitId" value={habit.habitId} />
        <button
          type="submit"
          aria-label={
            habit.checkedToday ? `Uncheck ${habit.title}` : `Check ${habit.title}`
          }
          className={`flex size-7 items-center justify-center rounded-full border transition-all ${
            habit.checkedToday
              ? "scale-105 border-emerald-500 bg-emerald-500 text-white"
              : "border-black/25 dark:border-white/30 hover:border-emerald-500"
          }`}
        >
          {habit.checkedToday && <Check size={16} strokeWidth={3} />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{habit.title}</p>
        <p className="flex items-center gap-1 text-xs text-black/45 dark:text-white/45">
          {habit.streakCurrent > 0 ? (
            <>
              <Flame size={12} className="text-orange-500" />
              {habit.streakCurrent} day streak
              {habit.streakBest > habit.streakCurrent &&
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
