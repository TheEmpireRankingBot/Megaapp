import { getDb, schema } from "@/db";

// Phase 0 runs single-user with no login: the first users row is "you",
// seeded on first touch. Real auth (Supabase) replaces this in a later
// phase — every query already scopes by userId, so the swap is contained
// to this function.
export async function getCurrentUser() {
  const db = await getDb();
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db
    .insert(schema.users)
    .values({ email: "me@megaapp.local", name: "Me" })
    .returning();
  return created;
}
