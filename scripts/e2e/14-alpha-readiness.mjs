import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://localhost:3000";
const executablePath = process.env.CHROMIUM_PATH ||
  (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultNavigationTimeout(15_000);
const failures = [];
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

function check(condition, label) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures.push(label);
}

const health = await page.request.get(`${base}/api/health`);
const healthBody = await health.json();
check(health.ok() && healthBody.status === "ok", "health endpoint reports ready");
check(!JSON.stringify(healthBody).match(/password|secret|key/i), "health endpoint exposes no credential fields");

const manifestResponse = await page.request.get(`${base}/manifest.webmanifest`);
const manifest = await manifestResponse.json();
check(manifestResponse.ok() && manifest.icons.some((icon) => icon.sizes === "192x192"), "manifest and install icons are available");
for (const asset of ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/offline.html", "/sw.js"]) {
  const response = await page.request.get(`${base}${asset}`);
  check(response.ok(), `${asset} is served`);
}

const routes = [
  "/today", "/tasks", "/habits", "/journal", "/money", "/health", "/review",
  "/meals", "/insights", "/calendar", "/goals", "/lists", "/search", "/travel",
  "/people", "/home", "/vault", "/assistant", "/import",
];

for (const route of routes) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  const hasHeading = await page.locator("h1").count();
  check(Boolean(response?.ok()) && hasHeading > 0 && !body.includes("This page couldn’t load"), `${route} renders without a server error`);
}

await page.goto(`${base}/definitely-not-a-megaapp-route`, { waitUntil: "domcontentloaded" });
check((await page.locator("body").innerText()).includes("That page isn’t here"), "unknown routes show the recovery page");

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
const serviceWorkerReady = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 5_000)),
  ]);
  return registration?.active?.scriptURL.endsWith("/sw.js") ?? false;
});
check(serviceWorkerReady, "service worker registers independently of Web Push");
const serviceWorkerSource = await (await page.request.get(`${base}/sw.js`)).text();
check(serviceWorkerSource.includes('event.request.mode !== "navigate"'), "service worker has navigation-only offline fallback");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
for (const route of ["/today", "/assistant", "/import", "/vault"]) {
  await mobile.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!overflow, `${route} has no mobile horizontal overflow`);
}

check(pageErrors.length === 0, `browser emitted no uncaught page errors${pageErrors.length ? `: ${pageErrors.join(" | ")}` : ""}`);
await browser.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} alpha readiness check(s) failed.`);
  process.exit(1);
}
console.log("\nAlpha browser readiness passed.");
