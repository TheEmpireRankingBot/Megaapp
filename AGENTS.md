# Megaapp — Agent Guide

Personal "life OS": one Next.js app for tasks, habits, journal, money, health, and weekly reviews. **Before building anything, read `docs/HANDOVER.md`** — it has the full architecture, exact data shapes, conventions, and build-ready specs for upcoming modules. `docs/PLAN.md` has the product vision and roadmap.

## Commands

```bash
npm run dev          # http://localhost:3000 — zero config (embedded PGlite DB in .pglite/)
npm run build        # typecheck + compile — must pass before any commit
npm run lint         # eslint — must pass before any commit
npm run db:generate  # regenerate SQL migration after editing src/db/schema.ts
npm run db:migrate   # apply migrations to a real Postgres (needs DATABASE_URL)
```

Verification = scripted browser runs in `scripts/e2e/` against a running server (see `scripts/e2e/README.md`). Reset dev data with `rm -rf .pglite`.

## Architecture in one paragraph

Async server components read via `src/lib/*.ts` query helpers; **all domain writes are server actions in `src/lib/actions.ts`** called from plain `<form action={...}>`; Supabase login/logout is the sole exception in `src/lib/auth-actions.ts`. Client components are limited to navigation, notification opt-in, and Vault encryption—the Vault encrypts locally before its server action receives ciphertext. Data lives on shared primitives (`items` = things, `entries` = timestamped logs, plus `tags`/`reminders`), with dedicated tables only for `tasks`, `habits`, `transactions`. The `(module, type)` registry in `docs/HANDOVER.md` §3 is the source of truth for payload shapes — extend it when you add types.

## Hard rules

1. All day/timezone math goes through `src/lib/dates.ts` (Singapore, `YYYY-MM-DD` day keys). Never elsewhere.
2. Every DB query filters by `userId` (auth-readiness; swap point is `src/lib/user.ts`).
3. Drizzle `numeric` columns are strings in JS: `Number()` on read, `String()` on write.
4. Server actions validate input, return silently on bad input, and end with `revalidateAll()`.
5. New tables/modules must be added to `GET /api/export` in the same change.
6. Mobile bottom nav stays at ≤6 tabs (`desktopOnly` flag for extras); everything usable at 390px.
7. Never edit files in `drizzle/` by hand — regenerate with `npm run db:generate`.
8. Styling: neutral black/white opacity tokens, `rounded-xl` cards; emerald = success, amber = warning, red = overdue/priority. Match existing pages.
9. Every feature ships with its retention hook (streaks, ring, nudge copy) — see PLAN.md principle 6.
10. Verify in a real browser (extend `scripts/e2e/`) before declaring a feature done.
