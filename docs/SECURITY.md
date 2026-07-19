# Security notes

## Dependency gate

The alpha workflow fails on high or critical production dependency advisories. Run this locally with:

```bash
npm audit --omit=dev --audit-level=high
```

As of 2026-07-16, npm also reports `GHSA-qx2v-qp2m-jg93` at moderate severity in the PostCSS version pinned inside Next.js 16.2.10. The vulnerable behavior is CSS stringification when attacker-controlled CSS contains a closing `</style>` sequence. Megaapp never accepts, stores, or compiles user-supplied CSS; this copy of PostCSS is used by the trusted build pipeline, so the vulnerable input boundary is not reachable in the deployed product.

An attempted package override to PostCSS 8.5.17 was rejected because it stalled the Next production compiler. Remove this exception when Next.js ships a compatible patched PostCSS dependency; do not force an override without passing the production build and full browser gate.

## Reporting and secrets

Do not commit `.env` files, database URLs, Megaapp passwords/session secrets, VAPID private keys, cron secrets, or Vault passphrases. Rotate any credential that appears in logs or source control. Use the non-secret `/api/health` response and `npm run alpha:production-smoke` for deployment diagnostics.
