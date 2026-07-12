# Megaapp

A personal **Life OS** — one app for everything: tasks, habits, health, money, meals, notes, goals, travel, people, and more.

## Status

🏗️ **Building — daily loop, money, health, and weekly reviews shipped.** The master plan (vision, module catalog, roadmap) lives in [`docs/PLAN.md`](docs/PLAN.md). The engineering handover — architecture, exact data shapes, conventions, verification workflow, and build-ready specs for what's next — lives in [`docs/HANDOVER.md`](docs/HANDOVER.md); agents should also read [`AGENTS.md`](AGENTS.md).

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

No configuration needed: without a `DATABASE_URL`, the app runs on an embedded Postgres ([PGlite](https://pglite.dev)) persisted to `.pglite/`, and migrations apply automatically on first connection. To use a real Postgres (e.g. Supabase), set `DATABASE_URL` and run `npm run db:migrate`.

Schema lives in [`src/db/schema.ts`](src/db/schema.ts); after changing it, run `npm run db:generate` to produce a migration. Everything you own is exportable as JSON at [`/api/export`](http://localhost:3000/api/export).

**Auth:** Phase 0 is single-user with no login — the first `users` row is seeded on first touch (see `src/lib/user.ts`). Supabase Auth replaces this in a later phase.

## Deploy

The app is a standard Next.js project; the intended setup (plan §4) is Vercel + Supabase:

1. Create a [Supabase](https://supabase.com) project and copy its Postgres connection string (Session pooler).
2. Run migrations against it once: `DATABASE_URL="postgres://…" npm run db:migrate`.
3. Import the repo on [Vercel](https://vercel.com/new), set the `DATABASE_URL` environment variable, deploy.
4. Open the URL on your phone → Add to Home Screen (the PWA manifest makes it install like an app).

⚠️ Until real auth lands, a deployed instance is open to anyone with the URL — protect it (Vercel deployment protection or a trusted-device-only URL) or keep it local.

## The short version

- **What:** a single mobile-first web app (PWA) that replaces a scattered todo app, habit tracker, budgeting spreadsheet, notes app, and meal planner.
- **How:** every module is a thin view over shared primitives (items, entries, tags, reminders), so features compound instead of sprawling.
- **Order:** daily loop first (today view, tasks, habits, journal) → money & health → planning (meals, calendar, reviews) → long tail → AI insights over your own data.
- **Stack (proposed):** Next.js + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + auth), Drizzle, Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and the open decisions that need input.
