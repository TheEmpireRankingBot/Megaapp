import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getHealthSummary, WATER_GOAL_ML } from "@/lib/health";
import { logHealth, deleteEntry } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import { Sparkline } from "@/components/sparkline";

export const metadata = { title: "Health" };
export const dynamic = "force-dynamic";

function LogForm({
  type,
  label,
  unit,
  step,
  withNote,
}: {
  type: string;
  label: string;
  unit: string;
  step: string;
  withNote?: boolean;
}) {
  return (
    <form
      action={logHealth}
      className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10"
    >
      <input type="hidden" name="type" value={type} />
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <input
          name="value"
          type="number"
          step={step}
          min="0"
          required={!withNote}
          placeholder={unit}
          className="w-full min-w-0 rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <button
          type="submit"
          className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
        >
          Log
        </button>
      </div>
      {withNote && (
        <input
          name="note"
          placeholder="What did you do?"
          autoComplete="off"
          className="w-full rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
      )}
    </form>
  );
}

const TYPE_LABELS: Record<string, (v: number | null, note: string) => string> = {
  weight: (v) => `Weight ${v} kg`,
  sleep: (v) => `Sleep ${v} h`,
  water: (v) => `Water ${v} ml`,
  workout: (v, note) => note || `Workout${v ? ` ${v} min` : ""}`,
};

export default async function HealthPage() {
  const user = await getCurrentUser();
  const s = await getHealthSummary(user.id);
  const waterPct = Math.min(s.waterTodayMl / WATER_GOAL_ML, 1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Health</h1>

      <section className="grid gap-3 sm:grid-cols-2">
        <LogForm type="weight" label="Weight" unit="kg" step="0.1" />
        <LogForm type="sleep" label="Sleep" unit="hours" step="0.1" />
        <LogForm type="water" label="Water" unit="ml" step="50" />
        <LogForm type="workout" label="Workout" unit="minutes" step="1" withNote />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Weight
          </p>
          {s.latestWeight === null ? (
            <p className="mt-2 text-sm text-black/45 dark:text-white/45">
              No weigh-ins yet.
            </p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {s.latestWeight} kg
                {s.weightDelta30d !== null && (
                  <span
                    className={`ml-2 text-sm font-medium ${
                      s.weightDelta30d <= 0 ? "text-emerald-600" : "text-black/50 dark:text-white/50"
                    }`}
                  >
                    {s.weightDelta30d > 0 ? "+" : ""}
                    {s.weightDelta30d.toFixed(1)} / 30d
                  </span>
                )}
              </p>
              <Sparkline points={s.weightSeries.map((p) => p.kg)} />
            </>
          )}
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Sleep — last 7 days
          </p>
          {s.sleepAvg7d === null ? (
            <p className="mt-2 text-sm text-black/45 dark:text-white/45">
              No sleep logged yet.
            </p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {s.sleepAvg7d.toFixed(1)} h{" "}
                <span className="text-sm font-medium text-black/50 dark:text-white/50">
                  average
                </span>
              </p>
              <div className="mt-2 flex h-12 items-end gap-1.5">
                {s.sleepWeek.map(({ day, hours }) => (
                  <div
                    key={day}
                    title={`${day}: ${hours ?? "—"} h`}
                    className={`flex-1 rounded-sm ${
                      hours === null
                        ? "h-1 bg-black/10 dark:bg-white/15"
                        : hours >= 7
                          ? "bg-emerald-500"
                          : "bg-amber-400"
                    }`}
                    style={
                      hours !== null
                        ? { height: `${Math.min(hours / 10, 1) * 100}%` }
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Water today
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {s.waterTodayMl}
            <span className="text-sm font-medium text-black/50 dark:text-white/50">
              {" "}
              / {WATER_GOAL_ML} ml
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div
              className={`h-full rounded-full transition-all ${
                waterPct >= 1 ? "bg-emerald-500" : "bg-sky-500"
              }`}
              style={{ width: `${waterPct * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Workouts this week
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {s.workoutsThisWeek}
          </p>
          <p className="text-xs text-black/45 dark:text-white/45">
            {s.workoutsThisWeek === 0
              ? "Zero so far — even 20 minutes counts."
              : "Keep showing up."}
          </p>
        </div>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recent logs
        </h2>
        {s.recent.length === 0 ? (
          <p className="px-2 py-1 text-sm text-black/45 dark:text-white/45">
            Nothing logged yet. Use the forms above, or the capture bar on
            Today: <span className="font-mono">weight 72.4</span>,{" "}
            <span className="font-mono">water 500</span>…
          </p>
        ) : (
          s.recent.map((e) => (
            <div
              key={e.entryId}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/[.04]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {(TYPE_LABELS[e.type] ?? (() => e.type))(e.value, e.note)}
                </p>
                <p className="text-xs text-black/45 dark:text-white/45">
                  {formatDay(e.day)}
                </p>
              </div>
              <form action={deleteEntry}>
                <input type="hidden" name="entryId" value={e.entryId} />
                <button
                  type="submit"
                  aria-label="Delete log"
                  className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-white/30"
                >
                  <X size={14} />
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
