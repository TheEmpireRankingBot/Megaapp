import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

async function getLocalUser() {
  const db = await getDb();
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db
    .insert(schema.users)
    .values({ email: "me@megaapp.local", name: "Me" })
    .returning();
  return created;
}

// With Supabase configured, map the verified Auth session to the app's users
// row by email. Without env vars, retain the zero-config local single user.
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return getLocalUser();

  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: new Error("Supabase is unavailable") };
  const authUser = data.user;
  if (error || !authUser?.email) redirect("/login");

  const email = authUser.email.toLowerCase();
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) return existing;

  const metadataName = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim().slice(0, 100)
      : email.split("@")[0];
  const [created] = await db
    .insert(schema.users)
    .values({ email, name })
    .onConflictDoNothing({ target: schema.users.email })
    .returning();
  if (created) return created;

  const [concurrent] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (!concurrent) throw new Error("Unable to create the authenticated user row.");
  return concurrent;
}
