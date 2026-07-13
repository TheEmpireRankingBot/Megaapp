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
  const client = new PGlite(path.join(process.cwd(), ".pglite"));
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

export { schema };
