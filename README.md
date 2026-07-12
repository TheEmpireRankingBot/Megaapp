# Megaapp

A personal **Life OS** — one app for everything: tasks, habits, health, money, meals, notes, goals, travel, people, and more.

## Status

📋 **Planning.** The master plan — vision, module catalog, architecture, data model, and phased roadmap — lives in [`docs/PLAN.md`](docs/PLAN.md).

## The short version

- **What:** a single mobile-first web app (PWA) that replaces a scattered todo app, habit tracker, budgeting spreadsheet, notes app, and meal planner.
- **How:** every module is a thin view over shared primitives (items, entries, tags, reminders), so features compound instead of sprawling.
- **Order:** daily loop first (today view, tasks, habits, journal) → money & health → planning (meals, calendar, reviews) → long tail → AI insights over your own data.
- **Stack (proposed):** Next.js + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + auth), Drizzle, Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and the open decisions that need input.
