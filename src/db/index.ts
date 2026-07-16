import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";
import * as schema from "./schema";

export type Database =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

// DATABASE_URL set (Supabase/any Postgres) → postgres-js, migrations applied
// via `npm run db:migrate`. Unset (local dev) → embedded PGlite persisted to
// .pglite/, migrations applied automatically on first connection.
const globalForDb = globalThis as unknown as {
  megaappDb?: Promise<Database>;
};

async function createDb(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) {
    return drizzlePostgres(
      postgres(url, {
        prepare: false,
        max: 3,
        connect_timeout: 10,
        idle_timeout: 20,
      }),
      { schema },
    );
  }
  if (process.env.VERCEL || process.env.MEGAAPP_REQUIRE_EXTERNAL_DB === "1") {
    throw new Error(
      "DATABASE_URL is required for a hosted Megaapp. Embedded PGlite is only supported for local development.",
    );
  }
  const dataDirectory = process.env.PGLITE_DATA_DIR?.trim() || ".pglite";
  // The directory override is only for isolated local acceptance runs. The
  // Turbopack hint prevents the dynamic test path from tracing the whole repo.
  const client = new PGlite(
    path.resolve(/* turbopackIgnore: true */ process.cwd(), dataDirectory),
  );
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db;
}

export function getDb(): Promise<Database> {
  globalForDb.megaappDb ??= createDb();
  return globalForDb.megaappDb;
}

/** Run a callback atomically across both supported database drivers. */
export async function withTransaction<T>(
  callback: (transaction: Database) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  if (process.env.DATABASE_URL) {
    return (db as PostgresJsDatabase<typeof schema>).transaction((transaction) =>
      callback(transaction as unknown as Database),
    );
  }
  return (db as PgliteDatabase<typeof schema>).transaction((transaction) =>
    callback(transaction as unknown as Database),
  );
}

export { schema };
