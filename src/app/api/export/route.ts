import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// Full JSON export of everything the current user owns. Plan principle #4:
// no feature ships without export support — this endpoint must grow with
// every new table.
export async function GET() {
  const user = await getCurrentUser();
  const db = await getDb();

  const [items, entries, tags, reminders, pushSubscriptions] = await Promise.all([
    db.select().from(schema.items).where(eq(schema.items.userId, user.id)),
    db.select().from(schema.entries).where(eq(schema.entries.userId, user.id)),
    db.select().from(schema.tags).where(eq(schema.tags.userId, user.id)),
    db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.userId, user.id)),
    db
      .select({
        id: schema.pushSubscriptions.id,
        endpoint: schema.pushSubscriptions.endpoint,
        userAgent: schema.pushSubscriptions.userAgent,
        createdAt: schema.pushSubscriptions.createdAt,
        updatedAt: schema.pushSubscriptions.updatedAt,
      })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, user.id)),
  ]);

  const itemIds = items.map((i) => i.id);
  const entryIds = entries.map((e) => e.id);
  const tagIds = tags.map((t) => t.id);

  const [tasks, habits, transactions, itemTags, entryTags] = await Promise.all([
    itemIds.length
      ? db.select().from(schema.tasks).where(inArray(schema.tasks.itemId, itemIds))
      : Promise.resolve([]),
    itemIds.length
      ? db.select().from(schema.habits).where(inArray(schema.habits.itemId, itemIds))
      : Promise.resolve([]),
    entryIds.length
      ? db
          .select()
          .from(schema.transactions)
          .where(inArray(schema.transactions.entryId, entryIds))
      : Promise.resolve([]),
    tagIds.length
      ? db
          .select()
          .from(schema.itemTags)
          .where(inArray(schema.itemTags.tagId, tagIds))
      : Promise.resolve([]),
    tagIds.length
      ? db
          .select()
          .from(schema.entryTags)
          .where(inArray(schema.entryTags.tagId, tagIds))
      : Promise.resolve([]),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "megaapp-export-v1",
    user: { id: user.id, email: user.email, name: user.name, settings: user.settings },
    items,
    entries,
    tags,
    itemTags,
    entryTags,
    reminders,
    // Encryption keys are deliberately excluded; they are delivery secrets,
    // not useful user data. Endpoint metadata remains visible in the export.
    pushSubscriptions,
    tasks,
    habits,
    transactions,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="megaapp-export-${
        new Date().toISOString().slice(0, 10)
      }.json"`,
    },
  });
}
