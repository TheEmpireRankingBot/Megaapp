# Megaapp

A personal **Life OS** — one app for everything: tasks, habits, health, money, meals, notes, goals, travel, people, and more.

## Status

🏗️ **Building — daily loop, money, health, meals, reviews, Auth, and Web Push are shipped. Insights, Calendar, Goals, Lists & Media, and global Search are built locally.** The master plan (vision, module catalog, roadmap) lives in [`docs/PLAN.md`](docs/PLAN.md). The engineering handover — architecture, exact data shapes, conventions, verification workflow, and build-ready specs for what's next — lives in [`docs/HANDOVER.md`](docs/HANDOVER.md); agents should also read [`AGENTS.md`](AGENTS.md).

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

No configuration needed: without a `DATABASE_URL`, the app runs on an embedded Postgres ([PGlite](https://pglite.dev)) persisted to `.pglite/`, and migrations apply automatically on first connection. To use a real Postgres (e.g. Supabase), set `DATABASE_URL` and run `npm run db:migrate`.

Schema lives in [`src/db/schema.ts`](src/db/schema.ts); after changing it, run `npm run db:generate` to produce a migration. Everything you own is exportable as JSON at [`/api/export`](http://localhost:3000/api/export).

**Auth:** local development with no Supabase variables keeps the zero-config single user. When Supabase variables are present, every app route requires a verified cookie-backed Supabase session and the authenticated email maps to its own `users` row.

## Deploy

The app is a standard Next.js project; the intended setup (plan §4) is Vercel + Supabase:

1. Create a [Supabase](https://supabase.com) project and copy its Postgres connection string (Session pooler).
2. Run migrations against it once: `DATABASE_URL="postgres://…" npm run db:migrate`.
3. In Supabase Auth → URL Configuration, set the Site URL to your deployed origin and allow both `/auth/callback` and `/auth/confirm` on that origin.
4. For the most reliable SSR magic link, set the Magic Link email template button URL to: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
5. Generate a Web Push key pair once with `npx web-push generate-vapid-keys --json`. In Vercel, add the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key as `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as a contact such as `mailto:you@example.com`. Never expose the private key.
6. Generate a separate random value (at least 16 characters) for `CRON_SECRET`. Vercel automatically uses it to authorize the notification cron in `vercel.json`.
7. Import the repo on [Vercel](https://vercel.com/new) and add all variables above plus `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon keys are also accepted). Use `npm run db:migrate && npm run build` as the Build Command so new migrations apply before the app starts.
8. In Vercel Settings → Functions, choose the same region as the Supabase database; cross-region database calls make every screen feel slow.
9. Deploy, request a sign-in link, then open the URL on your phone → Add to Home Screen. Enable notifications from Today. iPhone Web Push requires the installed Home Screen app.

The committed Hobby-compatible schedule runs once daily at 21:00 Singapore time. The cron route also supports morning briefs if a paid plan or another scheduler invokes it between 06:00 and 10:00 Singapore time.

## The short version

- **What:** a single mobile-first web app (PWA) that replaces a scattered todo app, habit tracker, budgeting spreadsheet, notes app, and meal planner.
- **How:** every module is a thin view over shared primitives (items, entries, tags, reminders), so features compound instead of sprawling.
- **Order:** daily loop first (today view, tasks, habits, journal) → money & health → planning (meals, calendar, reviews) → long tail → AI insights over your own data.
- **Stack (proposed):** Next.js + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + auth), Drizzle, Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and the open decisions that need input.
