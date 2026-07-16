// Notification boundary verification. Start the server with VAPID +
// CRON_SECRET variables as shown in scripts/e2e/README.md.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const base = process.env.BASE_URL || "http://localhost:3000";

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log(
  "notification opt-in visible:",
  (await page.getByRole("button", { name: "Enable" }).count()) === 1,
);

const serviceWorker = await page.request.get(`${base}/sw.js`);
console.log(
  "service worker public:",
  serviceWorker.ok() && (await serviceWorker.text()).includes('addEventListener("push"'),
);

const unauthorized = await page.request.get(`${base}/api/cron/notifications`);
console.log("cron rejects strangers:", unauthorized.status() === 401);

const authorized = await page.request.get(`${base}/api/cron/notifications`, {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
});
const cron = await authorized.json();
console.log("empty cron succeeds:", authorized.ok() && cron.ok === true);

const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
console.log(
  "export includes push metadata:",
  Array.isArray(payload.pushSubscriptions),
);

await page.screenshot({ path: "e2e7-notifications-mobile.png", fullPage: true });
await browser.close();
console.log("done");
