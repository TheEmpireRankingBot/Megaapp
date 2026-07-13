# Browser verification scripts

These are the project's test suite: Playwright scripts that drive the **real UI** against a running server and print `true`/`false` assertions on rendered output. Every feature PR so far shipped with a run of these (or a new one); keep that bar — a feature isn't done until a script has exercised it end-to-end.

## Running

```bash
rm -rf .pglite                 # scripts create data — start from a clean dev DB
npm run build && npm run start # or npm run dev
npm i -D playwright-core       # already in devDependencies
node scripts/e2e/01-daily-loop.mjs
node scripts/e2e/02-capture-money-health.mjs
node scripts/e2e/03-subscriptions.mjs
node scripts/e2e/04-weekly-review.mjs
node scripts/e2e/05-meals-groceries.mjs
node scripts/e2e/08-insights.mjs
node scripts/e2e/09-planning-discovery.mjs
```

Auth routing is a separate run because it starts the server with placeholder
Supabase variables. It does not send email or require a real Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
npm run start
node scripts/e2e/06-auth-boundary.mjs
```

Notifications are another separate run because the opt-in only appears when
VAPID is configured. Generate a throwaway key pair for local verification and
start with those values plus any local-only cron secret:

```bash
npx web-push generate-vapid-keys --json
NEXT_PUBLIC_VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
VAPID_SUBJECT=mailto:test@example.com CRON_SECRET=local-test-secret \
npm run start
CRON_SECRET=local-test-secret node scripts/e2e/07-notifications.mjs
```

Run **in numeric order** — later scripts assert against data created by earlier ones (e.g. `04` expects the week's habits/expenses to exist). Screenshots are written to the current working directory.

`playwright-core` does not download browsers. Point `CHROMIUM_PATH` at a Chromium/Chrome binary (e.g. `/opt/pw-browsers/chromium` in the Claude remote environment, or your local Chrome). Without it, Playwright falls back to its default browser registry, which only works if full `playwright` browsers are installed.

## Writing new scripts

- Assert on **rendered text/state**, not on implementation details.
- When a page has two forms sharing input names (Money has two `amount` inputs), scope locators to the form: `page.locator("form", { hasText: "next renewal" })`.
- Server actions round-trip in ~1s locally — the scripts use a `settle()` helper (`waitForTimeout(1200)`) after each submit.
- Time-dependent checks (weekend review prompt, "due today" renewals) depend on the clock — note it in the script when you rely on it.
- Keep each script self-seeding: create the data you assert on, through the UI.
