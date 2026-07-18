# Megaapp

A personal **Life OS** — one app for everything: tasks, habits, health, money, meals, notes, goals, travel, people, and more.

## Status

🏗️ **Building — Phases 0–4 plus Auth, Web Push, offline Quick Capture, Insights, Search, Assistant Actions, and a CSV Import Center are built. Quick Capture opens in a dead zone, queues safely on-device, preserves the capture time, and retries idempotently on reconnect. Tasks, expenses, habits, and local calendar events can also be previewed, validated, deduplicated, and imported in confirmed CSV batches. The Assistant optionally uses OpenAI when configured and never includes Vault data.** The master plan (vision, module catalog, roadmap) lives in [`docs/PLAN.md`](docs/PLAN.md). The engineering handover — architecture, exact data shapes, conventions, verification workflow, and build-ready specs for what's next — lives in [`docs/HANDOVER.md`](docs/HANDOVER.md); agents should also read [`AGENTS.md`](AGENTS.md).

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

Before an alpha release, run `npm run lint`, `npm run build`, and `npm run alpha:check`. GitHub Actions repeats those gates plus the full clean-browser suite on pushes and pull requests. The complete clean-database and production acceptance procedure is in [`docs/ALPHA.md`](docs/ALPHA.md).

No configuration needed: without a `DATABASE_URL`, the app runs on an embedded Postgres ([PGlite](https://pglite.dev)) persisted to `.pglite/`, and migrations apply automatically on first connection. To use a real Postgres (e.g. Supabase), set `DATABASE_URL` and run `npm run db:migrate`.

Schema lives in [`src/db/schema.ts`](src/db/schema.ts); after changing it, run `npm run db:generate` to produce a migration. Everything you own is exportable as JSON at [`/api/export`](http://localhost:3000/api/export).

**Access:** Megaapp opens directly in automatic single-user mode. It reuses the oldest `users` row so existing owner data is preserved. This is convenient for a private deployment, but a publicly reachable URL has no application-level sign-in gate.

## Deploy

The app is a standard Next.js project; the intended setup (plan §4) is Vercel + Supabase:

1. Create a [Supabase](https://supabase.com) project and copy its Postgres connection string (Session pooler).
2. Run migrations against it once: `DATABASE_URL="postgres://…" npm run db:migrate`.
3. Generate a Web Push key pair once with `npx web-push generate-vapid-keys --json`. In Vercel, add the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key as `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as a contact such as `mailto:you@example.com`. Never expose the private key.
4. Generate a separate random value (at least 16 characters) for `CRON_SECRET`. Vercel automatically uses it to authorize the notification cron in `vercel.json`.
5. Optional Assistant AI: add `OPENAI_API_KEY` to Vercel. It uses the Responses API with `store: false` and the default `gpt-5.4-mini` model; set `OPENAI_MODEL` to override it. Without this key, `/assistant` stays fully usable in local briefing mode and sends nothing to an AI provider.
6. Import the repo on [Vercel](https://vercel.com/new) and add `DATABASE_URL` plus the notification variables above. Use `npm run db:migrate && npm run build` as the Build Command so new migrations apply before the app starts.
7. In Vercel Settings → Functions, choose the same region as the Supabase database; cross-region database calls make every screen feel slow.
8. Deploy and open the URL on your phone → Add to Home Screen. Enable notifications from Today. iPhone Web Push requires the installed Home Screen app.

After deploy, run `BASE_URL=https://your-app.vercel.app npm run alpha:production-smoke`. It verifies external database health, direct app access, push configuration, cron authorization, and public PWA assets without changing production data. Hosted deployments fail closed when `DATABASE_URL` is missing.

The committed Hobby-compatible schedule runs once daily at 21:00 Singapore time. The cron route also supports morning briefs if a paid plan or another scheduler invokes it between 06:00 and 10:00 Singapore time.

## The short version

- **What:** a single mobile-first web app (PWA) that replaces a scattered todo app, habit tracker, budgeting spreadsheet, notes app, and meal planner.
- **How:** every module is a thin view over shared primitives (items, entries, tags, reminders), so features compound instead of sprawling.
- **Order:** daily loop first (today view, tasks, habits, journal) → money & health → planning (meals, calendar, reviews) → long tail → AI insights over your own data.
- **Stack:** Next.js + TypeScript, Tailwind, Supabase Postgres, Drizzle, Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and the open decisions that need input.
