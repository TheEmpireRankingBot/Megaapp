import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only needed for `drizzle-kit migrate` against a real Postgres
    // (e.g. Supabase). Local PGlite dev migrates itself at startup.
    url: process.env.DATABASE_URL ?? "",
  },
});
