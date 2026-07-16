import { Plane } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { addDays, todayKey } from "@/lib/dates";
import {
  BUILTIN_PACKING_TEMPLATES,
  getTravelData,
} from "@/lib/travel";
import {
  createPackingTemplate,
  createTrip,
} from "@/lib/actions";
import { TripCardClient } from "@/components/trip-card-client";

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
            <TripCardClient key={trip.itemId} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
