import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey, daysBetween, nextAnnualKey, todayKey } from "@/lib/dates";
import type { MaintenancePayload } from "@/lib/home";
import type { PersonPayload } from "@/lib/people";
import type { TripPayload } from "@/lib/travel";

export async function getLifeAdminBrief(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        inArray(schema.items.module, ["travel", "people", "home"]),
        eq(schema.items.status, "active"),
      ),
    );
  const today = todayKey();

  const nextTrip = rows
    .filter((row) => row.module === "travel" && row.type === "trip")
    .map((row) => ({ row, payload: row.payload as TripPayload }))
    .filter(({ payload }) => payload.endDate >= today)
    .sort((a, b) => a.payload.startDate.localeCompare(b.payload.startDate))[0];

  const nextBirthday = rows
    .filter((row) => row.module === "people" && row.type === "person")
    .map((row) => {
      const payload = row.payload as PersonPayload;
      const key = payload.birthday ? nextAnnualKey(payload.birthday, today) : null;
      return key ? { name: row.title, key, daysUntil: daysBetween(today, key) } : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.key.localeCompare(b.key))[0];

  const dueMaintenance = rows
    .filter((row) => row.module === "home" && row.type === "maintenance")
    .map((row) => ({ title: row.title, payload: row.payload as MaintenancePayload }))
    .filter(({ payload }) => daysBetween(today, payload.dueDate) <= 14)
    .sort((a, b) => a.payload.dueDate.localeCompare(b.payload.dueDate))[0];

  const staleContact = rows
    .filter((row) => row.module === "people" && row.type === "person")
    .map((row) => {
      const payload = row.payload as PersonPayload;
      const since = payload.lastContactKey ?? dayKey(row.createdAt);
      return {
        name: row.title,
        days: Math.max(0, daysBetween(since, today)),
        threshold: payload.checkInDays || 30,
      };
    })
    .filter((person) => person.days >= person.threshold)
    .sort((a, b) => b.days - a.days)[0];

  return {
    nextTrip: nextTrip
      ? {
          title: nextTrip.row.title,
          startDate: nextTrip.payload.startDate,
          daysUntil: daysBetween(today, nextTrip.payload.startDate),
          packed: nextTrip.payload.packingItems?.filter((item) => item.done).length ?? 0,
          total: nextTrip.payload.packingItems?.length ?? 0,
        }
      : null,
    nextBirthday: nextBirthday && nextBirthday.daysUntil <= 30 ? nextBirthday : null,
    dueMaintenance: dueMaintenance
      ? {
          title: dueMaintenance.title,
          dueDate: dueMaintenance.payload.dueDate,
          daysUntil: daysBetween(today, dueMaintenance.payload.dueDate),
        }
      : null,
    staleContact: staleContact ?? null,
  };
}
