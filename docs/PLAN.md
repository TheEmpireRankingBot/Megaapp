# Megaapp — Master Plan

One app for your whole life: tasks, habits, health, money, meals, notes, goals, travel, people, and everything in between. This document is the source of truth for what we're building and in what order.

---

## 1. Vision

A single personal **"Life OS"** — the one app you open in the morning and check before bed. It replaces the scattered mess of a todo app, a budgeting spreadsheet, a habit tracker, a notes app, a meal planner, and a dozen half-abandoned lists.

**North star:** every day starts and ends in Megaapp. The Today screen tells you what matters right now; everything you log compounds into a personal database that gets more useful over time.

### Why mega apps usually fail (and how we avoid it)

Mega apps die when they're built as fifteen separate apps glued together — fifteen data models, fifteen UIs, fifteen half-finished features. The fix is to build a **small set of shared primitives** (items, logs, tags, reminders) and make each "module" a thin view over that shared foundation. A habit check-in, a weight entry, an expense, and a journal entry are all just *timestamped logs* underneath. That's the core architectural bet of this plan.

### Guiding principles

1. **Daily loop first.** The features you touch every day (today view, tasks, habits, quick logging) get built first and polished hardest.
2. **Capture must be instant.** Logging an expense or a thought should take under 5 seconds, from the phone, or it won't happen.
3. **One data foundation.** Modules share primitives; nothing gets its own snowflake infrastructure.
4. **Your data is yours.** Full export at any time (JSON/CSV). No feature ships without export support.
5. **Ship a vertical slice every phase.** Each phase ends with something genuinely usable, not scaffolding.
6. **Sticky by design.** The app earns the daily open: a day-progress ring you want to fill, streaks you don't want to break, a one-tap journal close to the day, and nudge copy that talks to you. Every module ships with its retention hook, not as an afterthought.

---

## 2. Module catalog

Everything the app will eventually cover, grouped by how central it is to the daily loop.

### Tier 1 — the daily loop (build first)

| Module | What it does |
|---|---|
| **Today / Dashboard** | Morning briefing: today's tasks, habits due, calendar, quick-log buttons, streaks. The home screen. |
| **Tasks & Projects** | Todos, projects, recurring chores, due dates, priorities. |
| **Habits & Routines** | Daily/weekly habits, streaks, morning & evening routine checklists. |
| **Notes & Journal** | Quick notes, daily journal with mood tracking, searchable archive. |

### Tier 2 — money and body (build second)

| Module | What it does |
|---|---|
| **Finance** | Expense logging, budgets by category, subscription tracker, monthly summaries, net worth over time. |
| **Health & Fitness** | Workout logging, weight/body metrics, sleep, water — simple manual logging first, wearable import later. |

### Tier 3 — planning your life (build third)

| Module | What it does |
|---|---|
| **Meals & Groceries** | Recipe box, weekly meal plan, auto-generated grocery list. |
| **Calendar** | Unified agenda; two-way Google Calendar sync. |
| **Goals & Reviews** | Yearly/quarterly goals linked to projects and habits; a guided weekly review flow. |

### Tier 4 — the long tail (build as needed)

| Module | What it does |
|---|---|
| **Lists & Media** | Books/movies/shows/games backlog, ratings, generic checklists. |
| **Travel** | Trip planning, itineraries, packing list templates. |
| **People (personal CRM)** | Birthdays, gift ideas, "haven't talked to X in a while" nudges. |
| **Home & Stuff** | Possession inventory, warranties, maintenance schedules (car, appliances). |
| **Vault** | Important documents and reference info (encrypted). |

### Tier 5 — the payoff layer (once data exists)

| Module | What it does |
|---|---|
| **Insights** | Trends and correlations across modules: spending vs. mood, sleep vs. workout consistency, habit adherence over time. |
| **Assistant** | Chat with your own data ("how much did I spend eating out last month?", "plan my week") powered by an LLM over your personal database. |

---

## 3. Shared foundation

The primitives every module is built on. Getting these right is 80% of the project.

- **Entry** — the universal timestamped log record (`type`, `occurred_at`, `value`, `note`, `tags`, `module`, flexible JSON payload). Habit check-ins, expenses, weight entries, journal entries, and mood logs are all Entries. This makes cross-module insights nearly free.
- **Item** — the universal "thing" record (a task, a recipe, a book on your list, a person, a possession) with module-specific fields in a typed JSON payload plus dedicated tables where relational integrity matters (tasks, transactions).
- **Tags** — global, cross-module. Tag a trip's expenses, journal entries, and packing list with `#japan-2026` and see them together.
- **Reminders & notifications** — one scheduling system all modules use (task due, habit nudge, birthday, subscription renewal, maintenance due).
- **Quick Capture** — a single omnipresent "+" that parses shorthand: `$14.50 lunch`, `weight 72.4`, `todo call dentist tomorrow`. This is the make-or-break UX feature.
- **Search** — one global search across everything.
- **Import/Export** — JSON export of everything from day one; CSV importers per module as they land.

---

## 4. Recommended architecture

**Recommendation: a mobile-first web app (PWA), single codebase, boring proven stack.** You get it on your phone home screen and your laptop from day one, with no app-store friction, and one codebase to maintain. A native app (Expo/React Native) stays on the table for later if we ever need deep phone integration — the API-first design keeps that door open.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (React + TypeScript)** | One repo for UI + API routes; huge ecosystem; easy deploys. |
| UI | **Tailwind CSS + shadcn/ui** | Fast to build, consistent, looks good without a designer. |
| Database | **Postgres via Supabase** | Free tier is plenty for personal use; gives auth, storage, and realtime for free; plain Postgres means no lock-in. |
| ORM | **Drizzle** | Type-safe schema in code, painless migrations. |
| Auth | **Supabase Auth** | Email + OAuth out of the box; supports adding a partner/family member later. |
| Hosting | **Vercel** (app) + Supabase (data) | Both free-tier friendly; push-to-deploy. |
| PWA | Installable, offline-tolerant quick capture | Capture must work in a dead zone; sync when back online. |
| AI layer (Phase 5) | Claude API over the personal DB | Tool-use queries against your own data. |

**Repo layout** (single Next.js app until there's a reason for more):

```
/app            → routes: /today, /tasks, /habits, /journal, /money, ...
/components     → shared UI (capture bar, entry list, charts, streaks)
/lib            → domain logic per module + shared services
/db             → Drizzle schema + migrations
/docs           → this plan + per-module specs as they're built
```

### Data model sketch (core tables)

```
users        (id, email, name, settings)
items        (id, user_id, module, type, title, status, payload jsonb, ...)
entries      (id, user_id, module, type, occurred_at, value numeric,
              note, payload jsonb, item_id?)
tags         (id, user_id, name, color)      + item_tags / entry_tags
reminders    (id, user_id, item_id?, schedule, next_fire_at, channel)
-- Dedicated tables where structure earns its keep:
tasks        (id, item_id, due_at, recurrence, priority, project_id, done_at)
transactions (id, entry_id, amount, currency, category, account, merchant)
habits       (id, item_id, cadence, target, streak_current, streak_best)
```

Rule of thumb: start every module on `items` + `entries`; promote to a dedicated table only when queries or integrity demand it.

---

## 5. Roadmap

Each phase is a usable vertical slice, roughly 2–4 weeks of part-time effort.

**Current build (2026-07-13):** Phases 0–3 are complete apart from external Google Calendar sync. Phase 4 is complete locally: Travel, People, Home, and the browser-encrypted Vault join the already-shipped Lists & Media. Web Push, Insights, and global Search are also built. The main open product layer is the data Assistant, plus optional external integrations and importers.

### Phase 0 — Foundation (week 1)
Scaffold Next.js + Tailwind + Supabase + Drizzle; auth with a single account; core tables (`items`, `entries`, `tags`, `reminders`); app shell with navigation; deploy pipeline to Vercel; JSON export endpoint.
**Done when:** you can log in on your phone and laptop and see an empty Today screen, and the whole thing redeploys on push.

### Phase 1 — The daily loop (MVP)
Tasks & projects (with recurrence), habits with streaks, notes + daily journal with mood, the Today dashboard tying it together, and Quick Capture v1 (structured buttons, not yet text parsing).
**Done when:** Megaapp fully replaces your todo app and habit tracker and you've used it daily for two straight weeks.

### Phase 2 — Money & body
Expense logging with categories and budgets, subscription tracker with renewal reminders, monthly money summary; weight/workout/sleep/water logging with trend charts; Quick Capture v2 (text shorthand parsing: `$14.50 lunch`, `weight 72.4`).
**Done when:** you know exactly what you spent this month and your weight trend without opening anything else.

### Phase 3 — Planning
Recipe box → weekly meal plan → auto grocery list; Google Calendar two-way sync and a unified agenda on Today; goals & guided weekly review linked to tasks and habits.
**Done when:** Sunday planning (meals, groceries, week ahead, review) happens entirely in the app.

### Phase 4 — Long tail
Media/lists backlog, travel planner with packing templates, personal CRM with birthday nudges, home inventory & maintenance schedules, document vault. Built in whatever order proves most wanted — each is small once the foundation exists.

### Phase 5 — Intelligence
Cross-module insight dashboards (spend vs. mood, sleep vs. habits); the AI assistant with tool access to your data; weekly review auto-drafted from the week's entries.
**Done when:** the app tells you things about your life you didn't already know.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Scope explosion — "everything" never ships | Strict phase gates: a phase must be *used daily for two weeks* before the next starts. |
| Capture friction kills adoption | Quick Capture is a Phase 1 deliverable, measured in taps-to-log; PWA install on phone day one. |
| One-off data models rot the codebase | Items/Entries primitive is mandatory; dedicated tables require justification in a module spec. |
| Bank/wearable integrations are a tar pit | Manual + CSV import first; live integrations (Plaid, health APIs) only if manual logging proves too costly. |
| Solo-project burnout | Every phase ends with something you personally use — the app pays you back continuously. |

---

## 7. Open decisions (input wanted)

The plan proceeds with the recommendations below unless you say otherwise:

1. **Platform** — recommended: mobile-first PWA (vs. native app or desktop-first). Native stays possible later.
2. **Users** — recommended: single-user first, with auth that can add a partner/household later. If sharing (e.g. shared groceries/budget) matters early, Phase 3 shifts.
3. **First modules** — recommended Phase 1 = tasks + habits + journal. If money tracking is your most acute pain, Finance can swap into Phase 1.
4. **Integrations that matter to you** — Google Calendar? Apple Health / a wearable? Bank feeds? Spotify/Goodreads? This orders the integration work.
5. **Currency & locale** — defaulting to SGD and metric units unless told otherwise.

---

## 8. Immediate next steps

1. Confirm or adjust the open decisions above (or just say "go").
2. Phase 0: scaffold the app, database, auth, and deploy pipeline.
3. Write `docs/modules/tasks.md` — the first module spec — and start Phase 1.
