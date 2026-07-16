"use client";

import { type FormEvent, useState } from "react";
import { Check, Luggage, MapPin, Plus, X } from "lucide-react";
import {
  addTripPackingItem,
  deleteItem,
  toggleTripPackingItem,
} from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import type { PackingItem, TravelTrip } from "@/lib/travel";
import { ItineraryClient } from "@/components/itinerary-client";

export function TripCardClient({ trip }: { trip: TravelTrip }) {
  const [packingItems, setPackingItems] = useState(trip.payload.packingItems);
  const [busyPackingId, setBusyPackingId] = useState<string | null>(null);
  const [addingPacking, setAddingPacking] = useState(false);
  const [message, setMessage] = useState("");
  const packed = packingItems.filter((item) => item.done).length;
  const total = packingItems.length;

  async function togglePacking(event: FormEvent<HTMLFormElement>, packing: PackingItem) {
    event.preventDefault();
    if (busyPackingId || addingPacking) return;
    const previous = packingItems;
    setBusyPackingId(packing.id);
    setMessage("");
    setPackingItems((current) =>
      current.map((item) =>
        item.id === packing.id ? { ...item, done: !item.done } : item,
      ),
    );
    try {
      const updated = await toggleTripPackingItem(new FormData(event.currentTarget));
      if (!updated) throw new Error("Packing item was not updated");
    } catch {
      setPackingItems(previous);
      setMessage(`Couldn’t update ${packing.name}. Try again.`);
    } finally {
      setBusyPackingId(null);
    }
  }

  async function addPacking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyPackingId || addingPacking) return;
    const form = event.currentTarget;
    setAddingPacking(true);
    setMessage("");
    try {
      const created = await addTripPackingItem(new FormData(form));
      if (!created) throw new Error("Packing item was not created");
      setPackingItems((current) => [...current, created]);
      form.reset();
    } catch {
      setMessage("Couldn’t add the packing item. Try a different name.");
    } finally {
      setAddingPacking(false);
    }
  }

  return (
    <article className="space-y-5 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            <MapPin size={13} /> {trip.payload.destination}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{trip.title}</h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            {formatDay(trip.payload.startDate)} – {formatDay(trip.payload.endDate)} ·{" "}
            {trip.daysUntil > 0
              ? `${trip.daysUntil} days to go`
              : trip.daysUntil === 0
                ? "starts today"
                : "in progress or past"}
          </p>
        </div>
        <form action={deleteItem}>
          <input type="hidden" name="itemId" value={trip.itemId} />
          <button
            aria-label={`Delete ${trip.title}`}
            className="p-1 text-black/30 hover:text-red-500 dark:text-white/30"
          >
            <X size={15} />
          </button>
        </form>
      </div>

      <section>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Luggage size={15} /> Packing
          </span>
          <span className="tabular-nums text-black/50 dark:text-white/50">
            {packed}/{total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width]"
            style={{ width: `${total ? (packed / total) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3 grid gap-1 sm:grid-cols-2">
          {packingItems.map((packing) => (
            <form key={packing.id} onSubmit={(event) => togglePacking(event, packing)}>
              <input type="hidden" name="itemId" value={trip.itemId} />
              <input type="hidden" name="packingId" value={packing.id} />
              <button
                disabled={busyPackingId !== null || addingPacking}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/[.03] disabled:cursor-wait disabled:opacity-60 dark:hover:bg-white/[.04] ${packing.done ? "text-black/40 line-through dark:text-white/40" : ""}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${packing.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 dark:border-white/20"}`}
                >
                  {packing.done && <Check size={11} />}
                </span>
                {packing.name}
              </button>
            </form>
          ))}
        </div>
        <form onSubmit={addPacking} className="mt-2 flex gap-2">
          <input type="hidden" name="itemId" value={trip.itemId} />
          <input
            name="name"
            required
            disabled={busyPackingId !== null || addingPacking}
            placeholder="Add packing item"
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/10"
          />
          <button
            disabled={busyPackingId !== null || addingPacking}
            aria-label="Add packing item"
            className="rounded-lg border border-black/10 px-3 disabled:opacity-50 dark:border-white/10"
          >
            <Plus size={15} />
          </button>
        </form>
      </section>

      <ItineraryClient
        itemId={trip.itemId}
        startDate={trip.payload.startDate}
        endDate={trip.payload.endDate}
        initialStops={trip.payload.itinerary}
      />

      {message && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{message}</p>}
    </article>
  );
}
