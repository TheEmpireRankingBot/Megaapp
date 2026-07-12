# Megaapp — Engineering Handover

The complete context needed to build on this codebase without guessing. Written for any engineer or coding agent (Claude, Codex, …) picking the project up cold. Read this together with [`PLAN.md`](PLAN.md) (product vision & roadmap); this document is the *how it's actually built* companion.

**Golden rule of this codebase:** every module is a thin view over shared primitives (`items` + `entries` + `tags` + `reminders`). Before adding a table, a route, or a pattern, check §3 and §4 — the design bets are deliberate and consistency is the product.

---

## 1. Current state (as of 2026-07-12)

| Area | Status |
|---|---|
| Plan & vision | `docs/PLAN.md` — five-tier module catalog, phase gates, principle 6 "sticky by design" |
| Phase 0 foundation | ✅ merged (PR #1) — shell, schema, zero-config DB, export |
| Phase 1 daily loop | ✅ merged — tasks, habits + streaks, journal + mood, Today ring |
| Phase 2 | ✅ merged — Quick Capture v2, Money (budget), Health (trends) |
| Subscriptions | ✅ merged — renewal tracking, Paid flow, Today strip |
| Weekly review | ✅ built & verified — PR #2 (open) |
| Deployment | ❌ not deployed; README §Deploy has the Vercel+Supabase steps |
| Auth | ❌ single-user stand-in (see §6 swap point) |
| Notifications | ❌ `reminders` table is populated but nothing consumes it yet |
| Tests | Scripted browser verification only (`scripts/e2e/`), no unit test framework |

Working branch: `claude/lifestyle-app-planning-f922je`. Owner's locale defaults: Singapore time, SGD, metric.

## 2. Stack & architecture

- **Next.js 16 (App Router, RSC) + TypeScript strict + Tailwind 4** — pages are async server components; **all mutations are server actions invoked from plain `<form action={...}>`** (zero client JS for mutations). The only client components are `src/components/nav.tsx` (needs `usePathname`). Keep it that way unless interactivity genuinely requires a client component.
- **Drizzle ORM, Postgres dialect** (`src/db/schema.ts`). Two drivers behind one `getDb()` (`src/db/index.ts`):
  - `DATABASE_URL` unset → embedded **PGlite** persisted to `.pglite/`, **auto-migrates** on first connection. Delete `.pglite/` to reset dev data.
  - `DATABASE_URL` set → **postgres-js** (Supabase or any Postgres); apply migrations with `npm run db:migrate`.
  - `next.config.ts` must keep `serverExternalPackages: ["@electric-sql/pglite", "postgres"]`.
- **PWA**: `public/manifest.webmanifest`, installable, start URL `/today`. Icon is SVG-only (iOS wants a PNG `apple-touch-icon` — open todo).
- **No API routes for app logic** — the single exception is `GET /api/export` (full JSON export). New tables MUST be added to the export payload (plan principle: "no feature ships without export").

### File map

```
src/db/schema.ts        all tables (Drizzle, pg dialect)
src/db/index.ts         getDb() driver switch + PGlite automigrate
drizzle/                generated SQL migrations (never hand-edit)
src/lib/dates.ts        THE ONLY place for day/timezone logic (SG, fixed +08:00)
src/lib/user.ts         getCurrentUser() — the auth swap point
src/lib/actions.ts      every server action ("use server")
src/lib/data.ts         tasks/habits/journal/Today queries + types
src/lib/money.ts        expenses, budget, subscriptions queries; formatSGD; CATEGORIES
src/lib/health.ts       health summary queries; WATER_GOAL_ML
src/lib/review.ts       week math, week stats, review queries
src/lib/capture.ts      Quick Capture shorthand parser (pure, no IO)
src/components/         nav, task-row, habit-row, journal-form, quick-capture,
                        quick-add-task (full form), progress-ring, sparkline
src/app/<module>/page.tsx   today, tasks, habits, journal, money, health, review
src/app/api/export/route.ts
scripts/e2e/            scripted browser verification (see §5)
```

## 3. Data model — exact shapes

Core rule: **start every feature on `items` (things) + `entries` (timestamped logs)**; promote to a dedicated table only when queries or integrity demand it (current promotions: `tasks`, `habits`, `transactions`).

### Tables (see `src/db/schema.ts` for columns)

- `users` — `settings jsonb` currently holds `{ budgetMonthly?: number }`.
- `items` — universal "thing". Discriminated by `(module, type)`.
- `entries` — universal timestamped log. Discriminated by `(module, type)`; `value numeric` for the numeric reading, `note text`, `payload jsonb` for the rest, optional `itemId` link.
- `tags`, `item_tags`, `entry_tags` — global tagging (schema exists; no UI yet).
- `reminders` — one scheduling system for all modules. Populated by subscriptions; nothing consumes it yet.
- `tasks`, `habits` — 1:1 extensions of an `items` row (`itemId` unique FK).
- `transactions` — 1:1 extension of an expense `entries` row.

### `(module, type)` registry — keep this in sync when adding features

| module | type | where | value | payload | itemId |
|---|---|---|---|---|---|
| tasks | task (items) | items+tasks | — | `{}` | — |
| tasks | completed (entries) | entries | — | `{ prevDueKey? }` (for recurring undo) | → task's item |
| habits | habit (items) | items+habits | — | `{}` | — |
| habits | checkin (entries) | entries | — | `{}` | → habit's item |
| journal | journal (entries) | entries | — | `{ mood?: 1-5 }` | — |
| money | expense (entries) | entries+transactions | amount SGD | `{}` | → subscription item if renewal |
| money | subscription (items) | items (+reminders) | — | `{ amount, cadence: "monthly"\|"yearly", nextRenewalKey, category }` | — |
| health | weight / sleep / water / workout (entries) | entries | kg / hours / ml / minutes-or-null | `{}` | — |
| review | weekly (entries) | entries | — | `{ weekStart, wins, challenges, focus }` | — |

Semantics that matter:

- **Drizzle `numeric` columns are strings** in JS. `Number()` on read, `String()` on write. Every existing query does this — follow suit.
- **One journal entry per day, one review per week** — enforced by upsert-by-time-range in the actions, not by DB constraint.
- **Recurring task completion** never sets `doneAt`; it logs a `completed` entry carrying `prevDueKey` and advances `dueAt` past today anchored to the original schedule (loop `nextDueKey` until `> today`). Undo (same day) deletes the entry and restores `prevDueKey`.
- **Streaks**: current streak is always computed live from check-in entries (120-day window, `computeCurrentStreak` — today doesn't break the streak until it's over). `habits.streakBest` is a cache updated in `toggleHabit`; `streakCurrent` column is display-cache only, never trusted.
- **Every task completion / habit check-in / expense is an `entries` row** — this is the raw material for the future insights layer. Never shortcut past it.

## 4. Conventions (follow these exactly)

1. **Dates**: all day math goes through `src/lib/dates.ts`. Day keys are `YYYY-MM-DD` strings in **Asia/Singapore** (fixed `+08:00`, no DST). Never do timezone/day arithmetic anywhere else. Date-only stamps use `dayNoon()`; ranges use `dayStart()`/`dayEnd()`.
2. **Server actions** (`src/lib/actions.ts`): exported async functions taking `FormData`; validate inputs and **silently return on bad input** (no throws for user input); always scope by `user.id`; always call `revalidateAll()` (which revalidates every module path) after a write. Add new module paths to `MODULE_PATHS`.
3. **Every query is scoped by `userId`** even though there's one user — this is what makes the auth swap (§6) a one-file change.
4. **Styling idiom** (no shadcn yet — don't introduce it casually): neutral tokens via opacity — `border-black/10 dark:border-white/10`, muted text `text-black/50 dark:text-white/50`, hover `hover:bg-black/[.03] dark:hover:bg-white/[.04]`. Cards `rounded-xl border p-4`, inputs `rounded-lg`. Meaning colors: **emerald** = success/done, **amber** = warning/upcoming, **red** = danger/overdue/priority, **sky** = water only. Icons: `lucide-react`, size 14–20. Section headers: `text-sm font-semibold uppercase tracking-wide text-black/50`.
5. **Pages** that read the DB declare `export const dynamic = "force-dynamic"` and fetch in parallel with `Promise.all`.
6. **Money formatting**: `formatSGD()` from `src/lib/money.ts`, `tabular-nums` on numbers.
7. **Mobile**: bottom nav stays at **max six tabs** (`desktopOnly: true` flag for extras); every feature must be usable at 390px width; forms wrap with `flex-wrap`.
8. **Copy tone**: short, direct, encouraging ("no streak yet — today's the day"). Nudge copy is a feature (plan principle 6), not filler.
9. **Migrations**: edit `schema.ts` → `npm run db:generate` → commit the SQL in `drizzle/`. Never edit generated SQL or `drizzle/meta`.
10. **Export**: new tables/modules must be added to `/api/export` in the same PR.
11. Keep `docs/PLAN.md` and this file updated when scope or conventions change; note verification results in PR bodies.

## 5. Build & verify

```bash
npm install
npm run dev            # http://localhost:3000 (PGlite, zero config)
npm run build          # includes typecheck — must pass
npm run lint           # eslint — must pass
npm run db:generate    # after schema changes
npm run db:migrate     # against real Postgres (DATABASE_URL)
```

**Browser verification is the project's test suite.** `scripts/e2e/*.mjs` are Playwright scripts that drive the real UI against a running server and assert on rendered output (see `scripts/e2e/README.md`). They create data — run against a throwaway DB (`rm -rf .pglite`), in numeric order. Every feature PR so far shipped with such a run; keep that bar. When forms share input names across a page (e.g. Money has two `amount` inputs), **scope locators to the form** (`page.locator("form", { hasText: … })`).

## 6. Known gaps, gotchas, and how to fix them

- **Auth (the big one).** `src/lib/user.ts # getCurrentUser()` seeds/returns a single user. To add Supabase Auth: authenticate via `@supabase/ssr` middleware, map the Supabase user id/email onto the `users` row (create on first login), and reimplement `getCurrentUser()` from the session. Everything else already scopes by `userId`. Until auth lands, **a deployed instance is open to anyone with the URL** (README §Deploy warns about this).
- **Reminders have no delivery channel.** Subscriptions write `reminders` rows (`schedule` = cadence, `nextFireAt` = renewal midnight). The intended consumer is web push (see §7.3).
- **Monthly recurrence** uses `setUTCMonth+1` on the noon stamp — end-of-month dates drift (Jan 31 → Mar 3). Acceptable so far; fix by clamping to month end if it bothers anyone.
- **`formatDay`** omits the year — dates >6 months out (yearly renewals) display without year context.
- **iOS PWA icon**: manifest icon is SVG; add PNG `apple-touch-icon` sizes for iOS.
- **Import doesn't exist** — export is one-way JSON. CSV importers are planned per module (plan §3).
- **Insights window limits**: habit streaks look back 120 days; health trends 30 days. All-time best streak older than the window relies on the `streakBest` cache.
- **`.pglite/` is gitignored** dev state. The e2e scripts have populated it in past sessions; don't assume it's empty.
- **Weekly review upsert matches by `occurredAt` within the current week** — a review can only be written/edited during its own week. Known simplification.
- Tailwind 4 syntax in use (`@theme inline`, `has-checked:` variant) — don't downgrade patterns to v3 idioms.

## 7. Build-ready specs for what's next (in recommended order)

Each spec follows the house pattern: data on the primitives, queries in `src/lib/<module>.ts`, actions in `actions.ts`, RSC page, e2e script, export coverage, and a "done when" gate.

### 7.1 Meals & groceries (plan Phase 3)

- **Data**: recipe = `items(module:"meals", type:"recipe", title, payload:{ ingredients: string[], link?: string })`. Meal plan = `items(module:"meals", type:"plan", title=weekStart, payload:{ days: Record<dayKey, { dinner?: string /* recipe itemId or free text */ }> })`, one per week (upsert like review). Grocery list = `items(module:"meals", type:"grocery", payload:{ items: { name: string, done: boolean }[] })`, one active at a time.
- **UI** `/meals` (desktopOnly nav + Today link on Sundays next to review): recipe box (add/delete), week grid Mon–Sun assigning recipes, "Generate grocery list" button that unions ingredients of planned recipes (dedupe by lowercase name) into the grocery list; checkable list items.
- **Capture**: `buy milk` → append to active grocery list (extend `capture.ts` with `buy ` prefix).
- **Done when**: plan a week, generate the list, tick items off on a phone-width viewport, all through the UI.

### 7.2 Supabase Auth (unlocks safe deployment)

- `@supabase/ssr` + middleware guarding all routes except `/login`; email magic-link is enough for v1.
- Map session → `users` row by email (create on first login); rewrite `getCurrentUser()`; delete the seeding path.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ `DATABASE_URL` already supported). Local dev without env vars keeps the current single-user behavior (feature-flag on env presence) so PGlite dev stays zero-config.
- **Done when**: deployed instance requires login; local dev still works with no env vars.

### 7.3 Notifications (the biggest stickiness lever, needs deployment first)

- Web Push (VAPID) + service worker; store push subscriptions per user (new `push_subscriptions` table — remember export).
- A scheduled route (Vercel cron) runs a few times daily: fires due `reminders` rows, plus computed nudges — evening "streak at risk" (habit unchecked by ~21:00 SG with `streakCurrent >= 3`), morning brief, weekend review prompt. Every send advances/clears its reminder.
- **Done when**: a phone gets a streak-at-risk push while its streak is genuinely at risk.

### 7.4 Insights (plan Phase 5 — data is already accumulating)

- `/insights`: mood over time vs. habit adherence; spend by week; sleep vs. next-day mood; habit consistency calendar heatmap. All computable from `entries` with the existing helpers — no new tables.
- Charts: extend the existing hand-rolled SVG components (`sparkline.tsx`) rather than adding a chart library initially.
- **Done when**: it tells the owner one true thing they didn't know.

### 7.5 Tier-4 modules (small, whenever wanted)

Lists/media backlog, travel packing templates, people/birthdays (uses `reminders`), home maintenance (uses `reminders`), vault. Each is `items` + a page + capture support; follow the registry table in §3 and extend it.

## 8. Product principles to preserve (from PLAN.md, enforced in code review)

1. Daily loop first; capture must stay under 5 seconds.
2. One data foundation — resist snowflake tables.
3. Everything exportable, always.
4. Ship vertical slices; verify in a real browser before merging.
5. Sticky by design — every module ships its retention hook (ring, streaks, nudges, weekly close).
