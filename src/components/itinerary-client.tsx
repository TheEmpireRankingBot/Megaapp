"use client";

import { type FormEvent, useState } from "react";
import { addItineraryStop } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import type { ItineraryStop } from "@/lib/travel";

function sortStops(stops: ItineraryStop[]) {
  return [...stops].sort((left, right) =>
    `${left.day}${left.time ?? ""}`.localeCompare(`${right.day}${right.time ?? ""}`),
  );
}

export function ItineraryClient({
  itemId,
  startDate,
  endDate,
  initialStops,
}: {
  itemId: string;
  startDate: string;
  endDate: string;
  initialStops: ItineraryStop[];
}) {
  const [stops, setStops] = useState(initialStops);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function addStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    try {
      const created = await addItineraryStop(new FormData(form));
      if (!created) throw new Error("Itinerary stop was not created");
      setStops((current) => sortStops([...current, created]));
      form.reset();
    } catch {
      setMessage("Couldn’t add the itinerary stop. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h3 className="text-sm font-medium">Itinerary</h3>
      {stops.length > 0 && (
        <div className="mt-2 space-y-1">
          {stops.map((stop) => (
            <div
              key={stop.id}
              className="flex gap-3 rounded-lg bg-black/[.025] px-3 py-2 text-sm dark:bg-white/[.04]"
            >
              <span className="w-24 shrink-0 text-xs text-black/50 dark:text-white/50">
                {formatDay(stop.day)} {stop.time}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{stop.title}</span>
                {stop.location && (
                  <span className="text-black/45 dark:text-white/45"> · {stop.location}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={addStop} className="mt-2 flex flex-wrap gap-2">
        <fieldset disabled={pending} className="contents">
          <input type="hidden" name="itemId" value={itemId} />
          <input
            name="day"
            type="date"
            required
            defaultValue={startDate}
            min={startDate}
            max={endDate}
            className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm disabled:opacity-50 dark:border-white/10 dark:[color-scheme:dark]"
          />
          <input
            name="time"
            type="time"
            className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm disabled:opacity-50 dark:border-white/10 dark:[color-scheme:dark]"
          />
          <input
            name="title"
            required
            placeholder="Plan or booking"
            className="min-w-36 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/10"
          />
          <input
            name="location"
            placeholder="Place"
            className="min-w-32 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/10"
          />
          <button
            disabled={pending}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/10"
          >
            {pending ? "Adding…" : "Add stop"}
          </button>
        </fieldset>
      </form>
      {message && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{message}</p>}
    </section>
  );
}
