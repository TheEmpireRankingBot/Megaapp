import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { daysBetween, todayKey } from "@/lib/dates";

export type PackingItem = {
  id: string;
  name: string;
  done: boolean;
};

export type ItineraryStop = {
  id: string;
  day: string;
  time?: string;
  title: string;
  location?: string;
};

export type TripPayload = {
  destination: string;
  startDate: string;
  endDate: string;
  notes?: string;
  packingItems: PackingItem[];
  itinerary: ItineraryStop[];
};

export type PackingTemplatePayload = { items: string[] };

export const BUILTIN_PACKING_TEMPLATES = {
  "builtin:weekend": {
    label: "Weekend essentials",
    items: ["Wallet", "Phone charger", "Toiletries", "Underwear", "Sleepwear", "Day outfit"],
  },
  "builtin:international": {
    label: "International trip",
    items: [
      "Passport",
      "Travel insurance",
      "Flight details",
      "Wallet",
      "Phone charger",
      "Power adapter",
      "Medication",
      "Toiletries",
      "Underwear",
      "Day outfits",
    ],
  },
} as const;

export type TravelTrip = {
  itemId: string;
  title: string;
  payload: TripPayload;
  daysUntil: number;
  packed: number;
  total: number;
};

export type TravelTemplate = {
  itemId: string;
  title: string;
  items: string[];
};

function normalizeTrip(payload: unknown): TripPayload {
  const value = (payload ?? {}) as Partial<TripPayload>;
  return {
    destination: typeof value.destination === "string" ? value.destination : "",
    startDate: typeof value.startDate === "string" ? value.startDate : todayKey(),
    endDate: typeof value.endDate === "string" ? value.endDate : todayKey(),
    notes: typeof value.notes === "string" ? value.notes : undefined,
    packingItems: Array.isArray(value.packingItems) ? value.packingItems : [],
    itinerary: Array.isArray(value.itinerary) ? value.itinerary : [],
  };
}

export async function getTravelData(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "travel"),
        eq(schema.items.status, "active"),
      ),
    )
    .orderBy(asc(schema.items.createdAt));

  const today = todayKey();
  const trips = rows
    .filter((row) => row.type === "trip")
    .map((row): TravelTrip => {
      const payload = normalizeTrip(row.payload);
      return {
        itemId: row.id,
        title: row.title,
        payload,
        daysUntil: daysBetween(today, payload.startDate),
        packed: payload.packingItems.filter((item) => item.done).length,
        total: payload.packingItems.length,
      };
    })
    .sort((a, b) => a.payload.startDate.localeCompare(b.payload.startDate));

  const templates = rows
    .filter((row) => row.type === "packing_template")
    .map((row): TravelTemplate => ({
      itemId: row.id,
      title: row.title,
      items: Array.isArray((row.payload as PackingTemplatePayload)?.items)
        ? (row.payload as PackingTemplatePayload).items
        : [],
    }));

  return { trips, templates };
}
