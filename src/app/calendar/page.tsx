import { CalendarDays, MapPin, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getCalendarEvents } from "@/lib/calendar";
import { addDays, formatDay, formatTime, todayKey } from "@/lib/dates";
import { createCalendarEvent, deleteItem } from "@/lib/actions";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  const today = todayKey();
  const events = await getCalendarEvents(user.id, today, addDays(today, 30));
  const grouped = new Map<string, typeof events>();
  for (const event of events) {
    const list = grouped.get(event.day) ?? [];
    list.push(event);
    grouped.set(event.day, list);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Your next 30 days, with today&apos;s agenda pulled into the dashboard.
        </p>
      </header>

      <form
        action={createCalendarEvent}
        className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Add event
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            name="title"
            required
            placeholder="Event name"
            className="min-w-48 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15"
          />
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:[color-scheme:dark]"
          />
          <input
            name="startTime"
            type="time"
            defaultValue="09:00"
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:[color-scheme:dark]"
          />
          <input
            name="endTime"
            type="time"
            aria-label="End time"
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:[color-scheme:dark]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            name="location"
            placeholder="Location (optional)"
            className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <input
            name="notes"
            placeholder="Notes (optional)"
            className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <label className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
            <input name="allDay" type="checkbox" /> All day
          </label>
          <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
            Add
          </button>
        </div>
      </form>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <CalendarDays className="mx-auto text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">
            Nothing scheduled yet. Add the one event you don&apos;t want to forget.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped].map(([day, dayEvents]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                {formatDay(day)}
              </h2>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <article
                    key={event.itemId}
                    className="group flex items-start gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
                  >
                    <div className="w-20 shrink-0 text-sm font-medium tabular-nums">
                      {event.allDay ? "All day" : formatTime(event.start)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{event.title}</p>
                      {event.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-black/50 dark:text-white/50">
                          <MapPin size={12} /> {event.location}
                        </p>
                      )}
                      {event.notes && (
                        <p className="mt-1 text-sm text-black/55 dark:text-white/55">{event.notes}</p>
                      )}
                    </div>
                    <form action={deleteItem}>
                      <input type="hidden" name="itemId" value={event.itemId} />
                      <button
                        aria-label={`Delete event ${event.title}`}
                        className="rounded p-1 text-black/30 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-white/30"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
