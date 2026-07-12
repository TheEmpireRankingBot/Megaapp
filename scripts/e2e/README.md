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
```

Run **in numeric order** — later scripts assert against data created by earlier ones (e.g. `04` expects the week's habits/expenses to exist). Screenshots are written to the current working directory.

`playwright-core` does not download browsers. Point `CHROMIUM_PATH` at a Chromium/Chrome binary (e.g. `/opt/pw-browsers/chromium` in the Claude remote environment, or your local Chrome). Without it, Playwright falls back to its default browser registry, which only works if full `playwright` browsers are installed.

## Writing new scripts

- Assert on **rendered text/state**, not on implementation details.
- When a page has two forms sharing input names (Money has two `amount` inputs), scope locators to the form: `page.locator("form", { hasText: "next renewal" })`.
- Server actions round-trip in ~1s locally — the scripts use a `settle()` helper (`waitForTimeout(1200)`) after each submit.
- Time-dependent checks (weekend review prompt, "due today" renewals) depend on the clock — note it in the script when you rely on it.
- Keep each script self-seeding: create the data you assert on, through the UI.
