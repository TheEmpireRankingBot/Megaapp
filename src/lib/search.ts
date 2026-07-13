import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey } from "@/lib/dates";

const MODULE_HREF: Record<string, string> = {
  tasks: "/tasks",
  habits: "/habits",
  journal: "/journal",
  money: "/money",
  health: "/health",
  review: "/review",
  meals: "/meals",
  calendar: "/calendar",
  goals: "/goals",
  lists: "/lists",
  travel: "/travel",
  people: "/people",
  home: "/home",
  assistant: "/assistant",
};

export type SearchResult = {
  id: string;
  title: string;
  detail: string;
  module: string;
  href: string;
  day: string | null;
};

export async function searchAll(userId: string, rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2) return [];
  const db = await getDb();
  const pattern = `%${query}%`;
  const [items, entries] = await Promise.all([
    db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.status, "active"),
          ne(schema.items.module, "vault"),
          ilike(schema.items.title, pattern),
        ),
      )
      .orderBy(desc(schema.items.updatedAt))
      .limit(30),
    db
      .select()
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.userId, userId),
          or(ilike(schema.entries.note, pattern), ilike(schema.entries.type, pattern)),
        ),
      )
      .orderBy(desc(schema.entries.occurredAt))
      .limit(30),
  ]);

  return [
    ...items.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.type.replaceAll("_", " "),
      module: item.module,
      href: MODULE_HREF[item.module] ?? "/today",
      day: null,
    })),
    ...entries.map((entry) => ({
      id: entry.id,
      title: entry.note?.trim() || entry.type.replaceAll("_", " "),
      detail: entry.type.replaceAll("_", " "),
      module: entry.module,
      href: MODULE_HREF[entry.module] ?? "/today",
      day: dayKey(entry.occurredAt),
    })),
  ].slice(0, 50);
}
