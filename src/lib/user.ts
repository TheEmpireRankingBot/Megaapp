import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getPasswordAccessConfig, SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken } from "@/lib/session";

// Megaapp is intentionally single-user. Reuse the oldest row so removing the
// auth boundary preserves data created by the previous Supabase-backed owner.
async function getSingleUser() {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.users)
    .values({ email: "me@megaapp.local", name: "Me" })
    .onConflictDoNothing({ target: schema.users.email })
    .returning();
  if (created) return created;

  const [concurrent] = await db
    .select()
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt))
    .limit(1);
  if (!concurrent) throw new Error("Unable to create the Megaapp user row.");
  return concurrent;
}

export async function getCurrentUser() {
  if (getPasswordAccessConfig()) {
    const cookieStore = await cookies();
    if (!(await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value))) redirect("/login");
  }
  return getSingleUser();
}
