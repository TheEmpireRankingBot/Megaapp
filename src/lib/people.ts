import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey, daysBetween, nextAnnualKey, todayKey } from "@/lib/dates";

export type PersonPayload = {
  relationship?: string;
  birthday?: string;
  contact?: string;
  notes?: string;
  lastContactKey?: string;
  checkInDays: number;
  giftIdeas: string[];
};

export type Person = {
  itemId: string;
  name: string;
  payload: PersonPayload;
  nextBirthday: string | null;
  birthdayInDays: number | null;
  daysSinceContact: number;
  needsContact: boolean;
};

function normalize(payload: unknown): PersonPayload {
  const value = (payload ?? {}) as Partial<PersonPayload>;
  return {
    relationship: typeof value.relationship === "string" ? value.relationship : undefined,
    birthday: typeof value.birthday === "string" ? value.birthday : undefined,
    contact: typeof value.contact === "string" ? value.contact : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
    lastContactKey: typeof value.lastContactKey === "string" ? value.lastContactKey : undefined,
    checkInDays:
      typeof value.checkInDays === "number" && value.checkInDays >= 7
        ? value.checkInDays
        : 30,
    giftIdeas: Array.isArray(value.giftIdeas) ? value.giftIdeas : [],
  };
}

export async function getPeople(userId: string): Promise<Person[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "people"),
        eq(schema.items.type, "person"),
        eq(schema.items.status, "active"),
      ),
    )
    .orderBy(asc(schema.items.title));
  const today = todayKey();
  return rows.map((row) => {
    const payload = normalize(row.payload);
    const contactKey = payload.lastContactKey ?? dayKey(row.createdAt);
    const daysSinceContact = Math.max(0, daysBetween(contactKey, today));
    const nextBirthday = payload.birthday ? nextAnnualKey(payload.birthday, today) : null;
    return {
      itemId: row.id,
      name: row.title,
      payload,
      nextBirthday,
      birthdayInDays: nextBirthday ? daysBetween(today, nextBirthday) : null,
      daysSinceContact,
      needsContact: daysSinceContact >= payload.checkInDays,
    };
  });
}
