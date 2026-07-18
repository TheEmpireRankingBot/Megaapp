# Megaapp — Engineering Handover

The complete context needed to build on this codebase without guessing. Written for any engineer or coding agent (Claude, Codex, …) picking the project up cold. Read this together with [`PLAN.md`](PLAN.md) (product vision & roadmap); this document is the *how it's actually built* companion.

**Golden rule of this codebase:** every module is a thin view over shared primitives (`items` + `entries` + `tags` + `reminders`). Before adding a table, a route, or a pattern, check §3 and §4 — the design bets are deliberate and consistency is the product.

---

## 1. Current state (as of 2026-07-15)

| Area | Status |
|---|---|
| Plan & vision | `docs/PLAN.md` — five-tier module catalog, phase gates, principle 6 "sticky by design" |
| Phase 0 foundation | ✅ merged (PR #1) — shell, schema, zero-config DB, export |
| Phase 1 daily loop | ✅ merged — tasks, habits + streaks, journal + mood, Today ring |
| Phase 2 | ✅ merged — Quick Capture v2, Money (budget), Health (trends) |
| Subscriptions | ✅ merged — renewal tracking, Paid flow, Today strip |
| Weekly review | ✅ merged & verified — PR #2 |
| Meals & groceries | ✅ built & verified — recipes, weekly dinner plan, generated grocery list, `buy` capture |
| Deployment | ✅ Through Assistant Actions pushed in `3038372`; current Import Center bundle remains local |
| Access | ✅ automatic single-user access; oldest owner row preserves existing data |
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
| Assistant | ✅ local/optional-AI briefing plus confirmation-gated task, expense, event, and habit drafts; Vault excluded |
| Import Center | ✅ CSV preview, validation, confirmed batch import, dedupe, and audit for tasks/expenses/habits/calendar |
| Alpha hardening | ✅ recovery boundaries, health endpoint, PNG install icons, fail-closed hosted config, isolated acceptance runner, offline Quick Capture |
| Tests | Scripted browser verification (`npm run alpha:e2e`), no unit test framework |

Working branch: `main` (local changes are not yet committed/pushed). Owner's locale defaults: Singapore time, SGD, metric.

## 2. Stack & architecture

- **Next.js 16 (App Router, RSC) + TypeScript strict + Tailwind 4** — pages are async server components; **all mutations land in server actions**. Plain `<form action={...}>` remains the default, while frequent controls use thin optimistic clients with rollback for immediate feedback (tasks, habits, expenses, subscriptions, goals, and media). Vault encrypts before its server action receives anything; Assistant questions stay read-only, while a recognized action draft needs a separate validated confirmation before it writes an item/entry plus an audit record. Import previews submit normalized rows to a scoped server action that revalidates and deduplicates them before writing.
- **Drizzle ORM, Postgres dialect** (`src/db/schema.ts`). Two drivers behind one `getDb()` (`src/db/index.ts`):
  - `DATABASE_URL` unset → embedded **PGlite** persisted to `.pglite/`, **auto-migrates** on first connection. Delete `.pglite/` to reset dev data.
  - `DATABASE_URL` set → **postgres-js** (Supabase or any Postgres); apply migrations with `npm run db:migrate`.
  - `next.config.ts` must keep `serverExternalPackages: ["@electric-sql/pglite", "postgres"]`.
- **PWA**: `public/manifest.webmanifest`, installable, start URL `/today`, with 192/512 PNG icons and a 180px Apple touch icon. The service worker registers independently of optional Web Push and caches only the static, auth-public `/offline.html` capture shell plus icons; private server-rendered pages are never cached.
- **No API routes for app logic** — the single exception is `GET /api/export` (full JSON export). New tables MUST be added to the export payload (plan principle: "no feature ships without export").

### File map

```
src/db/schema.ts        all tables (Drizzle, pg dialect)
src/db/index.ts         getDb() driver switch + PGlite automigrate
drizzle/                generated SQL migrations (never hand-edit)
src/lib/dates.ts        THE ONLY place for day/timezone logic (SG, fixed +08:00)
src/lib/user.ts         getCurrentUser() — deterministic automatic single-user row
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
src/lib/assistant.ts     compact data snapshot, local answers, optional Responses API call
src/lib/assistant-actions.ts limited action grammar, proposal validation, audit labels
src/lib/imports.ts       pure CSV parser, templates, normalized record validation
src/lib/import-history.ts scoped confirmed-batch audit query
src/lib/capture.ts      Quick Capture shorthand parser (pure, no IO)
src/components/         nav, task-row, habit-row, journal-form, quick-capture,
                        quick-add-task (full form), progress-ring, sparkline,
                        vault-client, assistant-client, import-client
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
| capture | receipt (entries) | entries | — | `{ source }` | Client UUID is the entry ID; atomic receipt + domain write makes retries idempotent. |
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
| assistant | action_applied (entries) | entries | — | `{ action, targetEntryId? }` | → created item when applicable |
| imports | batch_applied (entries) | entries | — | `{ kind, imported, skipped }` | — |

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
npm run alpha:check    # static configuration/release guard; add BASE_URL for live health
npm run alpha:e2e      # ordered clean-database browser acceptance suite
npm run db:generate    # after schema changes
npm run db:migrate     # against real Postgres (DATABASE_URL)
```

**Browser verification is the project's test suite.** `npm run alpha:e2e` drives the real UI against a running server, in numeric order, and now fails if any legacy rendered assertion reports `false` (see `scripts/e2e/README.md`). Use `PGLITE_DATA_DIR=.pglite-alpha` rather than deleting normal `.pglite` data. Every feature PR so far shipped with such a run; keep that bar. When forms share input names across a page (e.g. Money has two `amount` inputs), **scope locators to the form** (`page.locator("form", { hasText: … })`).

## 6. Known gaps, gotchas, and how to fix them

- **Automatic access has no app-level privacy boundary.** Megaapp reuses the oldest `users` row and opens directly. Anyone who can reach an unprotected deployment URL can read and change that owner's data; use Vercel Deployment Protection or another network-level gate if the URL should remain private.
- **Web Push requires deployment variables.** Set both VAPID keys, `VAPID_SUBJECT`, and `CRON_SECRET`; without a complete set the Today opt-in stays hidden and the cron returns 503. The default Hobby-compatible cron runs nightly at 21:00 SG. Morning brief logic exists but needs an additional scheduler invocation on a plan that permits it.
- **Offline Quick Capture is deliberately bounded.** The latest 50 captures remain in origin-local storage until individually confirmed by the server. Captures older than 90 days use the reconnect time; all normal offline captures preserve their original Singapore day and timestamp. Only Quick Capture is queued—other mutations require a connection—and the service worker never caches private app HTML or data.
- **Function/database region affects responsiveness.** The dashboard query waterfalls are parallelized and common filters indexed, but Vercel Functions must still be set to the Supabase database region in Vercel Settings → Functions.
- **Calendar is local-first v1.** Manual events and the Today agenda are complete. Google Calendar two-way sync still needs Google OAuth credentials, token storage, conflict rules, and a sync worker.
- **Vault passphrases are unrecoverable.** Every item is independently salted and encrypted with AES-GCM after PBKDF2-SHA256 (250,000 iterations) in the browser. Titles are inside the ciphertext; the database sees only `Encrypted item`. The current unlock flow assumes one passphrase across all items.
- **Assistant provider is optional.** Without `OPENAI_API_KEY`, `/assistant` generates deterministic local briefings. With it, the server sends a capped question plus a compact summary (metrics and selected titles only) to the Responses API with `store: false`. Vault, journal text, transaction notes, contacts, serials, and passphrases never enter the snapshot. Recognized task/expense/event/habit commands are resolved locally and do not call the provider; a separate server-side confirmation revalidates the draft before writing it. Prompts and replies are not written to Megaapp's database, while confirmed action summaries receive an exportable audit entry.
- **`formatDay`** omits the year — dates >6 months out (yearly renewals) display without year context.
- **Import v1 is deliberately narrow.** `/import` supports tasks, expenses, habit definitions, and local calendar events in batches of up to 250 rows/500 KB. It does not restore JSON exports, infer habit check-in history, import Vault data, or accept journal text. Expand formats only with the same preview/revalidation/dedupe boundary.
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

### 7.2 Automatic single-user access — replaced Supabase Auth 2026-07-19

- The email form, session proxy, Supabase Auth clients, and sign-out action were removed. `/login` and legacy `/auth/*` links redirect to `/today`.
- `getCurrentUser()` always reuses the oldest `users` row, preserving the original owner's scoped data. A race-safe local row is created only when the table is empty.
- Only `DATABASE_URL` is required for hosted access; Supabase URL and publishable/anon keys are no longer used.
- `06-auth-boundary.mjs` verifies direct mobile access, absence of email-link UI, legacy redirects, and public PWA assets.

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

### 7.7 Assistant v1 + Actions v2 — shipped locally 2026-07-13

- `/assistant` has a helpful no-key local mode for focus, money, health, and weekly-review questions. It deliberately does not persist conversations.
- Set `OPENAI_API_KEY` to enable the Responses API; `OPENAI_MODEL` is optional and defaults to `gpt-5.4-mini`. Informational questions use `store: false`; recognized action commands stay local.
- `getAssistantSnapshot()` scopes every query by `userId` and only exposes compact safe data: no Vault ciphertext/plaintext, journal text, transaction notes, contacts, serials, or passphrases.
- Task, expense, calendar-event, and habit commands create a reviewable local proposal. Only `confirmAssistantAction()` revalidates and writes it, then logs an `assistant/action_applied` summary. The original prompt/reply is not retained and Vault remains outside this boundary.
- Weekly Review now links to Assistant for a structured draft; Today and desktop navigation link to `/assistant`.
- **Verified**: `11-assistant.mjs` covers local answers, current data grounding, review drafting, no reply persistence, review/Today handoff, and 390px layouts. `12-assistant-actions.mjs` covers the draft boundary, all four confirmed writes, audit/export, and Assistant mobile layout.

### 7.8 CSV Import Center — shipped locally 2026-07-15

- `/import` accepts files or pasted CSV for tasks, expenses, habit definitions, and local calendar events. Each type has a downloadable header template and alias-aware columns.
- The browser parses quoted fields, validates every row, isolates bad rows, detects duplicates inside the file, and shows the exact normalized rows before confirmation. Files are capped at 500 KB/250 data rows per batch.
- `importCsvRecords()` treats the preview JSON as untrusted, revalidates it, scopes every existing-data query by `userId`, skips matching records, batches inserts into the existing `items`/`entries` primitives and extension tables, and writes an exportable `imports/batch_applied` audit entry.
- Vault and journal data are outside this boundary. Today and desktop navigation link to Import Center; import audit notes route back through global Search.
- **Verified**: `13-import-center.mjs` covers quoted CSV, row errors, in-file and existing-data duplicates, all four destinations, confirmed audit/export, Today handoff, and 390px layout.

### 7.9 Recommended next release

Implement Google Calendar OAuth sync once credentials and conflict policy are available. Without those inputs, expand Import Center to health history and module-specific exports. Preserve confirmed writes, the offline receipt boundary, and the Vault exclusion.

## 8. Product principles to preserve (from PLAN.md, enforced in code review)

1. Daily loop first; capture must stay under 5 seconds.
2. One data foundation — resist snowflake tables.
3. Everything exportable, always.
4. Ship vertical slices; verify in a real browser before merging.
5. Sticky by design — every module ships its retention hook (ring, streaks, nudges, weekly close).
