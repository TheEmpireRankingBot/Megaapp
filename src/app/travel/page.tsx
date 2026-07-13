import { Check, Luggage, MapPin, Plane, Plus, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import {
  BUILTIN_PACKING_TEMPLATES,
  getTravelData,
} from "@/lib/travel";
import {
  addItineraryStop,
  addTripPackingItem,
  createPackingTemplate,
  createTrip,
  deleteItem,
  toggleTripPackingItem,
} from "@/lib/actions";

export const metadata = { title: "Travel" };
export const dynamic = "force-dynamic";

export default async function TravelPage() {
  const user = await getCurrentUser();
  const { trips, templates } = await getTravelData(user.id);
  const today = todayKey();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Travel</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Turn one packing template into a ready-to-go trip.
        </p>
      </header>

      <form action={createTrip} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Plan a trip</h2>
        <div className="flex flex-wrap gap-2">
          <input name="title" required placeholder="Trip name" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <input name="destination" required placeholder="Destination" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <select name="templateId" aria-label="Packing template" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black">
            {Object.entries(BUILTIN_PACKING_TEMPLATES).map(([id, template]) => <option key={id} value={id}>{template.label}</option>)}
            {templates.map((template) => <option key={template.itemId} value={template.itemId}>{template.title}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs text-black/50 dark:text-white/50">Start <input name="startDate" type="date" required defaultValue={addDays(today, 14)} className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm text-foreground dark:border-white/15 dark:[color-scheme:dark]" /></label>
          <label className="flex flex-1 items-center gap-2 text-xs text-black/50 dark:text-white/50">End <input name="endDate" type="date" required defaultValue={addDays(today, 16)} className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm text-foreground dark:border-white/15 dark:[color-scheme:dark]" /></label>
          <input name="notes" placeholder="Notes (optional)" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Create trip</button>
        </div>
      </form>

      <details className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <summary className="cursor-pointer text-sm font-medium">Create a reusable packing template</summary>
        <form action={createPackingTemplate} className="mt-3 flex flex-wrap gap-2">
          <input name="title" required placeholder="Template name" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <textarea name="items" required rows={3} placeholder={'One item per line\nPassport\nCharger'} className="min-w-56 flex-[2] rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <button className="self-end rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/15">Save template</button>
        </form>
      </details>

      {trips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <Plane className="mx-auto text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">No trip yet. Plan the next escape and Megaapp will remember the packing.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => (
            <article key={trip.itemId} className="space-y-5 rounded-xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"><MapPin size={13} /> {trip.payload.destination}</p>
                  <h2 className="mt-1 text-lg font-semibold">{trip.title}</h2>
                  <p className="text-sm text-black/50 dark:text-white/50">{formatDay(trip.payload.startDate)} – {formatDay(trip.payload.endDate)} · {trip.daysUntil > 0 ? `${trip.daysUntil} days to go` : trip.daysUntil === 0 ? "starts today" : "in progress or past"}</p>
                </div>
                <form action={deleteItem}><input type="hidden" name="itemId" value={trip.itemId} /><button aria-label={`Delete ${trip.title}`} className="p-1 text-black/30 hover:text-red-500 dark:text-white/30"><X size={15} /></button></form>
              </div>

              <section>
                <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><Luggage size={15} /> Packing</span><span className="tabular-nums text-black/50 dark:text-white/50">{trip.packed}/{trip.total}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${trip.total ? (trip.packed / trip.total) * 100 : 0}%` }} /></div>
                <div className="mt-3 grid gap-1 sm:grid-cols-2">
                  {trip.payload.packingItems.map((packing) => (
                    <form key={packing.id} action={toggleTripPackingItem}>
                      <input type="hidden" name="itemId" value={trip.itemId} /><input type="hidden" name="packingId" value={packing.id} />
                      <button className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/[.04] ${packing.done ? "text-black/40 line-through dark:text-white/40" : ""}`}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${packing.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 dark:border-white/20"}`}>{packing.done && <Check size={11} />}</span>{packing.name}
                      </button>
                    </form>
                  ))}
                </div>
                <form action={addTripPackingItem} className="mt-2 flex gap-2"><input type="hidden" name="itemId" value={trip.itemId} /><input name="name" required placeholder="Add packing item" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10" /><button aria-label="Add packing item" className="rounded-lg border border-black/10 px-3 dark:border-white/10"><Plus size={15} /></button></form>
              </section>

              <section>
                <h3 className="text-sm font-medium">Itinerary</h3>
                {trip.payload.itinerary.length > 0 && <div className="mt-2 space-y-1">{trip.payload.itinerary.map((stop) => <div key={stop.id} className="flex gap-3 rounded-lg bg-black/[.025] px-3 py-2 text-sm dark:bg-white/[.04]"><span className="w-24 shrink-0 text-xs text-black/50 dark:text-white/50">{formatDay(stop.day)} {stop.time}</span><span className="min-w-0"><span className="font-medium">{stop.title}</span>{stop.location && <span className="text-black/45 dark:text-white/45"> · {stop.location}</span>}</span></div>)}</div>}
                <form action={addItineraryStop} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="itemId" value={trip.itemId} />
                  <input name="day" type="date" required defaultValue={trip.payload.startDate} min={trip.payload.startDate} max={trip.payload.endDate} className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10 dark:[color-scheme:dark]" />
                  <input name="time" type="time" className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10 dark:[color-scheme:dark]" />
                  <input name="title" required placeholder="Plan or booking" className="min-w-36 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10" />
                  <input name="location" placeholder="Place" className="min-w-32 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10" />
                  <button className="rounded-lg border border-black/10 px-3 py-1.5 text-sm dark:border-white/10">Add stop</button>
                </form>
              </section>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
