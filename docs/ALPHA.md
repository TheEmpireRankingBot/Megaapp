# Alpha release guide

Megaapp is code-ready for a private alpha when every automated gate below passes and the two owner-only production checks are complete. Alpha means one owner account, real data, and recoverable failures; it does not mean every planned external integration is finished.

## Automated release gate

Run from a clean checkout:

```bash
npm install
npm run lint
npm run build
npm run alpha:check
```

For a clean local browser run, use a separate database directory so normal development data is never deleted.

PowerShell:

```powershell
$env:PGLITE_DATA_DIR = ".pglite-alpha"
$env:PORT = "3100"
npm run start
```

In a second terminal:

```powershell
$env:BASE_URL = "http://localhost:3100"
npm run alpha:check
npm run alpha:e2e
```

`alpha:e2e` runs the daily loop, money, health, subscriptions, review, meals, insights, planning, life admin, Vault, Assistant, Assistant actions, CSV imports, every route, PWA assets, service worker registration, offline launch/reconnect/idempotency, 404 recovery, and key mobile overflow checks. Any rendered assertion that reports `false` or an expected count of zero fails the run. Password access and Web Push use separate configuration-specific scripts documented in `scripts/e2e/README.md`. The committed GitHub Actions alpha gate repeats lint, production build, high/critical production dependency audit, static readiness, and this clean browser suite on every push to `main` and every pull request. The reviewed moderate build-time exception is documented in [`SECURITY.md`](SECURITY.md).

## Production configuration

Copy the names from `.env.example`; never copy the placeholder values. A hosted deployment fails closed unless `DATABASE_URL` and all three `MEGAAPP_*` password-access variables are present. Web Push is optional during local development, but strict alpha mode requires its three VAPID variables plus `CRON_SECRET` because phone delivery is an owner acceptance gate. Strict mode rejects placeholder-shaped values, malformed URLs, short credentials, and partial groups.

Before deploying:

1. Apply committed migrations to the production database with `npm run db:migrate`.
2. Run `ALPHA_STRICT=1 npm run alpha:check` in an environment containing the production variables.
3. Deploy and open `/api/health`. Expect HTTP 200 with `status: "ok"`, `database: "external"`, and `access: "password"`. The endpoint never returns credentials.
4. Keep the Vercel function region close to the Supabase database region.
5. Run `BASE_URL=https://your-app.vercel.app npm run alpha:production-smoke`. This read-only check expects an external DB, password protection, configured notifications, cron authorization, and public PWA assets.

## Owner acceptance checks

These require the real deployment and phone configuration and cannot be proven by the local suite:

- Open the production URL in a private browser, confirm Today redirects to login, sign in, reload, and sign out.
- On the phone, add Megaapp to the Home Screen, open it from the icon, enable notifications, and confirm one scheduled push arrives.

Then import a small representative CSV, create one item in each daily module, unlock a disposable Vault item after a reload, and download `/api/export`. Store that export somewhere private before moving real data into the alpha.

## Data safety and rollback

- Never test against the production database. Use `PGLITE_DATA_DIR` locally and a separate Supabase project or branch for staging.
- Do not remove or rewrite an applied migration. Add a forward migration.
- Download `/api/export` before risky releases. It covers all normal modules plus audit records; Vault fields remain encrypted.
- If a deploy fails health or login checks, roll the application back to the previous deployment. Do not roll the database backward unless a reviewed recovery plan explicitly requires it.

## Deliberate alpha limits

Google Calendar sync, JSON restore, broader CSV formats, offline queuing for mutations other than Quick Capture, and multi-user collaboration remain outside this private alpha. Offline Quick Capture, local calendar events, JSON export, four confirmed CSV import formats, graceful error recovery, and the local Assistant remain supported.
