# Megaapp — Engineering Handover

The complete context needed to build on this codebase without guessing. Written for any engineer or coding agent (Claude, Codex, …) picking the project up cold. Read this together with [`PLAN.md`](PLAN.md) (product vision & roadmap); this document is the *how it's actually built* companion.

**Golden rule of this codebase:** every module is a thin view over shared primitives (`items` + `entries` + `tags` + `reminders`). Before adding a table, a route, or a pattern, check §3 and §4 — the design bets are deliberate and consistency is the product.

---

## 1. Current state (as of 2026-07-13)

| Area | Status |
|---|---|
| Plan & vision | `docs/PLAN.md` — five-tier module catalog, phase gates, principle 6 "sticky by design" |
| Phase 0 foundation | ✅ merged (PR #1) — shell, schema, zero-config DB, export |
| Phase 1 daily loop | ✅ merged — tasks, habits + streaks, journal + mood, Today ring |
| Phase 2 | ✅ merged — Quick Capture v2, Money (budget), Health (trends) |
| Subscriptions | ✅ merged — renewal tracking, Paid flow, Today strip |
| Weekly review | ✅ merged & verified — PR #2 |
| Meals & groceries | ✅ built & verified — recipes, weekly dinner plan, generated grocery list, `buy` capture |
| Deployment | ✅ Through Insights/planning pushed in `2a17320`; current Tier-4 bundle remains local |
| Auth | ✅ optional Supabase SSR magic-link auth; zero-config local fallback retained |
| Notifications | ✅ Web Push opt-in, due reminders, evening streak risk, weekend review, secured cron |
| Insights | ✅ 12-week habits/mood/sleep patterns and eight-week spend trend |
| Calendar | ✅ local events, 30-day agenda, Today integration; Google sync remains |
| Goals | ✅ milestones linked to tasks/habits, progress, Today focus |
| Lists & media | ✅ backlog, in-progress/finished states, ratings, `read`/`watch` capture |
| Global search | ✅ item titles and entry notes across every module |
| Travel | ✅ trips, itinerary, reusable packing templates, progress, reminders |
| People | ✅ birthdays, reconnect cadence, contact logs, gift ideas, reminders |
| Home | ✅ possessions, warranties, recurring maintenance, reminders |
| Vault | ✅ browser-side AES-GCM encryption; plaintext and passphrase never stored |
| Tests | Scripted browser verification only (`scripts/e2e/`), no unit test framework |

Working branch: `main` (local changes are not yet committed/pushed). Owner's locale defaults: Singapore time, SGD, metric.

## 2. Stack & architecture

- **Next.js 16 (App Router, RSC) + TypeScript strict + Tailwind 4** — pages are async server components; **all mutations land in server actions**. Plain `<form action={...}>` is the default. Client components are limited to navigation, notification opt-in, and Vault encryption; Vault is the deliberate exception because plaintext must be encrypted before its server action receives anything.
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
src/lib/user.ts         getCurrentUser() — Supabase session → users row; local fallback
src/lib/supabase/       config + cookie-backed server client + Proxy refresh helper
src/lib/auth-actions.ts magic-link request + sign-out server actions
src/proxy.ts            Next.js 16 auth boundary; protects app routes when configured
src/lib/actions.ts      every server action ("use server")
src/lib/data.ts         tasks/habits/journal/Today queries + types
src/lib/money.ts        expenses, budget, subscriptions queries; formatSGD; CATEGORIES
src/lib/health.ts       health summary queries; WATER_GOAL_ML
src/lib/review.ts       week math, week stats, review queries
src/lib/meals.ts        recipes, weekly plan, active grocery list queries + types
src/lib/notifications.ts VAPID delivery + expired endpoint cleanup
src/lib/insights.ts      cross-module 84-day analysis + plain-language headline
src/lib/calendar.ts      local events + one-query Today planning brief
src/lib/goals.ts         goal progress over milestones, tasks, and habit streaks
src/lib/lists.ts         media backlog normalization/grouping
src/lib/search.ts        cross-module item/entry search
src/lib/travel.ts        trips, packing templates, itinerary read model
src/lib/people.ts        birthdays and reconnect read model
src/lib/home.ts          possession and maintenance read model
src/lib/vault.ts         ciphertext-only Vault read model
src/lib/life-admin.ts    one-query Today brief for travel/people/home
src/lib/capture.ts      Quick Capture shorthand parser (pure, no IO)
src/components/         nav, task-row, habit-row, journal-form, quick-capture,
                        quick-add-task (full form), progress-ring, sparkline
src/app/<module>/page.tsx   today, tasks, habits, journal, money, health, review,
                           meals, insights, calendar, goals, lists, search
src/app/api/export/route.ts
src/app/api/cron/notifications/route.ts
public/sw.js             notification display/click service worker
scripts/e2e/            scripted browser verification (see §5; 05 covers meals)
```

## 3. Data model — exact shapes

Core rule: **start every feature on `items` (things) + `entries` (timestamped logs)**; promote to a dedicated table only when queries or integrity demand it (current promotions: `tasks`, `habits`, `transactions`).

### Tables (see `src/db/schema.ts` for columns)

- `users` — `settings jsonb` currently holds `{ budgetMonthly?: number }`.
- `items` — universal "thing". Discriminated by `(module, type)`.
- `entries` — universal timestamped log. Discriminated by `(module, type)`; `value numeric` for the numeric reading, `note text`, `payload jsonb` for the rest, optional `itemId` link.
- `tags`, `item_tags`, `entry_tags` — global tagging (schema exists; no UI yet).
- `reminders` — one scheduling system for all modules. Subscription renewals are consumed by the notification cron.
- `push_subscriptions` — one VAPID browser endpoint per user/device; encryption keys never appear in exports.
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
| meals | recipe (items) | items | — | `{ ingredients: string[], link?: string }` | — |
| meals | plan (items) | items | — | `{ days: Record<dayKey, { dinner?: recipeItemId }> }` | — |
| meals | grocery (items) | items | — | `{ items: { name: string, done: boolean }[] }` | — |
| notifications | sent (entries) | entries | — | `{ key, tag }` | — |
| calendar | event (items) | items | — | `{ startAt, endAt?, allDay, location?, notes? }` | — |
| goals | goal (items) | items | — | `{ horizon, targetDate?, linkedItemIds, milestones: { id, title, done }[] }` | — |
| lists | media (items) | items | — | `{ kind, state, rating?, notes? }` | — |
| travel | trip (items) | items (+reminders) | — | `{ destination, startDate, endDate, notes?, packingItems[], itinerary[] }` | — |
| travel | packing_template (items) | items | — | `{ items: string[] }` | — |
| people | person (items) | items (+reminders) | — | `{ relationship?, birthday?, contact?, notes?, lastContactKey?, checkInDays, giftIdeas[] }` | — |
| people | contact (entries) | entries | — | `{}` | → person item |
| home | asset (items) | items | — | `{ category, serial?, purchaseDate?, warrantyEnd?, notes? }` | — |
| home | maintenance (items) | items (+reminders) | — | `{ assetItemId?, dueDate, cadenceMonths?, notes?, completedCount }` | — |
| home | maintenance_completed (entries) | entries | — | `{ dueDate }` | → maintenance item |
| vault | secret (items) | items | — | `{ version, algorithm, kdf, iterations, salt, iv, ciphertext }` | — |

Semantics that matter:

- **Drizzle `numeric` columns are strings** in JS. `Number()` on read, `String()` on write. Every existing query does this — follow suit.
- **One journal entry per day, one review per week** — enforced by upsert-by-time-range in the actions, not by DB constraint.
- **Recurring task completion** never sets `doneAt`; it logs a `completed` entry carrying `prevDueKey` and advances `dueAt` past today anchored to the original schedule (loop `nextDueKey` until `> today`). Undo (same day) deletes the entry and restores `prevDueKey`.
- **Streaks**: current streak is always computed live from check-in entries (120-day window, `computeCurrentStreak` — today doesn't break the streak until it's over). `habits.streakBest` is a cache updated in `toggleHabit`; `streakCurrent` column is display-cache only, never trusted.
- **Every task completion / habit check-in / expense is an `entries` row** — this is the raw material for the future insights layer. Never shortcut past it.

## 4. Conventions (follow these exactly)

1. **Dates**: all day math goes through `src/lib/dates.ts`. Day keys are `YYYY-MM-DD` strings in **Asia/Singapore** (fixed `+08:00`, no DST). Never do timezone/day arithmetic anywhere else. Date-only stamps use `dayNoon()`; ranges use `dayStart()`/`dayEnd()`.
2. **Server actions** (`src/lib/actions.ts`): exported async functions taking `FormData`; validate inputs and **silently return on bad input** (no throws for user input); always scope by `user.id`; always call `revalidateAll()` (which revalidates every module path) after a write. Add new module paths to `MODULE_PATHS`. Supabase login/logout actions live separately in `auth-actions.ts` because they mutate Auth cookies, not domain data.
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

- **Auth requires deployment configuration.** The code is complete, but protection activates only when the Supabase URL and publishable/anon key are present. Configure the Site URL, redirect allow-list, and SSR token-hash Magic Link template exactly as documented in README §Deploy. Partial configuration fails closed with an explicit server error; only omitting both variables enables local fallback.
- **Web Push requires deployment variables.** Set both VAPID keys, `VAPID_SUBJECT`, and `CRON_SECRET`; without a complete set the Today opt-in stays hidden and the cron returns 503. The default Hobby-compatible cron runs nightly at 21:00 SG. Morning brief logic exists but needs an additional scheduler invocation on a plan that permits it.
- **Function/database region affects responsiveness.** The dashboard query waterfalls are parallelized and common filters indexed, but Vercel Functions must still be set to the Supabase database region in Vercel Settings → Functions.
- **Calendar is local-first v1.** Manual events and the Today agenda are complete. Google Calendar two-way sync still needs Google OAuth credentials, token storage, conflict rules, and a sync worker.
- **Vault passphrases are unrecoverable.** Every item is independently salted and encrypted with AES-GCM after PBKDF2-SHA256 (250,000 iterations) in the browser. Titles are inside the ciphertext; the database sees only `Encrypted item`. The current unlock flow assumes one passphrase across all items.
- **`formatDay`** omits the year — dates >6 months out (yearly renewals) display without year context.
- **iOS PWA icon**: manifest icon is SVG; add PNG `apple-touch-icon` sizes for iOS.
- **Import doesn't exist** — export is one-way JSON. CSV importers are planned per module (plan §3).
- **Insights window limits**: habit streaks look back 120 days; health trends 30 days. All-time best streak older than the window relies on the `streakBest` cache.
- **`.pglite/` is gitignored** dev state. The e2e scripts have populated it in past sessions; don't assume it's empty.
- **Weekly review upsert matches by `occurredAt` within the current week** — a review can only be written/edited during its own week. Known simplification.
- Tailwind 4 syntax in use (`@theme inline`, `has-checked:` variant) — don't downgrade patterns to v3 idioms.

## 7. Build-ready specs for what's next (in recommended order)

Each spec follows the house pattern: data on the primitives, queries in `src/lib/<module>.ts`, actions in `actions.ts`, RSC page, e2e script, export coverage, and a "done when" gate.

### 7.1 Meals & groceries (plan Phase 3) — shipped 2026-07-12

- **Shipped**: `/meals` has recipe add/delete, the current Mon–Sun dinner plan, ingredient-deduped grocery generation, and a checkable active list. It is desktop-only in navigation and linked from Today on Sundays.
- **Capture**: `buy milk` appends to the active grocery list, creating it if needed and avoiding case-insensitive duplicates.
- **Retention hook**: one Sunday plan becomes one reusable shopping list; the list shows picked-up progress and a completion nudge.
- **Verified**: `scripts/e2e/05-meals-groceries.mjs` exercises the complete UI at desktop and 390px, Quick Capture, deduplication, toggling, and JSON export.

### 7.2 Supabase Auth — shipped 2026-07-12

- `@supabase/ssr` + Next.js 16 `proxy.ts` guard every app/API route except `/login`, `/auth/*`, and static PWA assets. The boundary verifies JWTs with `getClaims()`; server data access revalidates the user with `getUser()`.
- Magic-link request, PKCE callback, token-hash confirmation, sign-out, and session-to-`users` email mapping are implemented. First login creates the app user row safely under the email unique constraint.
- Env: `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`), alongside `DATABASE_URL`. No auth env vars preserves PGlite + the local seeded user.
- **Verified**: the full local browser suite still passes without env vars; `06-auth-boundary.mjs` proves configured unauthenticated requests redirect to login and static PWA assets remain public. A real email round trip requires the owner's Supabase project configuration.

### 7.3 Notifications — shipped locally 2026-07-13

- Web Push (VAPID) + service worker stores one subscription per authenticated browser. The export contains endpoint metadata but deliberately omits encryption keys.
- `/api/cron/notifications` requires Vercel's `CRON_SECRET`, prunes expired endpoints, fires and advances due reminders, logs computed sends in `entries`, and deduplicates daily/weekly nudges.
- The committed Hobby-compatible cron runs nightly at 21:00 SG for streak risk and weekend review. Morning brief delivery is implemented for schedulers that call the same route during 06:00–10:00 SG.
- **Verification**: `07-notifications.mjs` covers the mobile opt-in boundary, public service worker, cron authorization, empty delivery run, and export shape. A real phone push remains the production gate after VAPID deployment.

### 7.4 Insights — shipped locally 2026-07-13

- `/insights` reads one 84-day slice of `entries` plus active habits—no schema or export change. It renders a habit consistency heatmap, eight weekly spend bars, mood vs. same-day habit completion, and sleep vs. next-day mood.
- Hand-rolled accessible SVG/CSS charts live in `insight-charts.tsx`; no chart dependency or client JavaScript was added.
- The headline prefers sufficiently sampled positive relationships, then completed-week spend movement, then the steadiest eligible habit. It labels correlation as a pattern rather than causation and asks for more data when the sample is too small.
- **Verified**: `08-insights.mjs` seeds each source through the UI, checks every section and coverage, and verifies the full page has no horizontal overflow at 390px.

### 7.5 Planning + discovery bundle — shipped locally 2026-07-13

- Calendar v1 stores local events on `items`, renders the next 30 days, and adds today's events to the dashboard through one combined planning query.
- Goals use milestones plus existing task/habit links. Linked tasks count when completed; linked habits count after a seven-day streak. The nearest target becomes Today&apos;s focus card.
- Lists & Media supports book/movie/show/game backlog, in-progress and finished states, ratings, an oldest-backlog "pick next" nudge, plus `read …` and `watch …` Quick Capture.
- Global Search queries item titles and entry notes/types and routes results back to their owning module.
- **Verified**: `09-planning-discovery.mjs` covers all writes, Today integration, linked progress, Quick Capture, search, export, and 390px overflow checks for every new route.

### 7.6 Life-admin + encrypted Vault bundle — shipped locally 2026-07-13

- Travel has trip dates, itinerary stops, built-in and reusable packing templates, packing progress, a day-before reminder, and a Today trip card.
- People has birthdays, yearly reminders, reconnect cadence, contact history entries, gift ideas, `person …` / `met …` capture, and Today birthday/reconnect cards.
- Home has possession serials and warranties, linked one-time or recurring maintenance, completion history, due reminders, `service …` capture, and Today overdue work.
- Vault encrypts title, type, and content in the browser with AES-GCM + PBKDF2 before the ciphertext-only server action runs. Search deliberately excludes Vault; JSON export contains encrypted payloads only.
- **Verified**: `10-life-admin-vault.mjs` exercises all writes, recurring maintenance, reminders, Today/Search/export, proves Vault plaintext is absent at rest, decrypts it on-device, and checks every route at 390px.

### 7.7 Recommended next release

Phase 5 Assistant: safe read-only tools over the existing modules, explicit confirmation for writes, and weekly-review drafting. It needs an LLM provider key and a strict tool/audit boundary. Google Calendar sync remains a separate integration project because it needs Google OAuth credentials and conflict handling.

## 8. Product principles to preserve (from PLAN.md, enforced in code review)

1. Daily loop first; capture must stay under 5 seconds.
2. One data foundation — resist snowflake tables.
3. Everything exportable, always.
4. Ship vertical slices; verify in a real browser before merging.
5. Sticky by design — every module ships its retention hook (ring, streaks, nudges, weekly close).
