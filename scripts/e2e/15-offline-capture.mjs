import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://localhost:3000";
const executablePath = process.env.CHROMIUM_PATH ||
  (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const failures = [];

function check(condition, label) {
  console.log(`${label}: ${condition}`);
  if (!condition) failures.push(label);
}

const title = `Offline alpha capture ${Date.now()}`;
await page.goto(`${base}/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByRole("heading", { name: /Good |Today/ }).first().waitFor();
await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) throw new Error("Service worker did not activate");
});

await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
check((await page.locator("h1").textContent()) === "Capture now. Sync later.", "offline launch shell renders");
await page.locator("#capture-text").fill(title);
await page.getByRole("button", { name: "Save offline" }).click();
check((await page.getByRole("status").textContent())?.includes("Saved safely") ?? false, "dead-zone capture saves on device");

const queued = await page.evaluate(() => {
  const key = "megaapp:quick-capture-queue:v1";
  const records = JSON.parse(localStorage.getItem(key) || "[]");
  const record = records[0];
  // Deliberately replay the same client UUID. The server receipt must make
  // the second delivery a no-op even if a network retry is ambiguous.
  localStorage.setItem(key, JSON.stringify([record, record]));
  return record;
});
check(Boolean(queued?.id && queued?.capturedAt), "offline queue stores an idempotency key and timestamp");

await context.setOffline(false);
await page.waitForURL(`${base}/today`, { timeout: 20_000 });
await page.getByText(title, { exact: true }).waitFor({ timeout: 20_000 });
check((await page.getByText(title, { exact: true }).count()) === 1, "reconnect creates exactly one task");
const queueCount = await page.evaluate(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length);
check(queueCount === 0, "confirmed reconnect clears the device queue");

const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const matchingItems = payload.items.filter((item) => item.module === "tasks" && item.title === title);
const receipt = payload.entries.find((entry) => entry.id === queued.id && entry.module === "capture" && entry.type === "receipt");
check(matchingItems.length === 1 && Boolean(receipt), "server receipt prevents retry duplication");
check(new Date(matchingItems[0].createdAt).getTime() === new Date(queued.capturedAt).getTime(), "sync preserves the original capture time");

await browser.close();
if (failures.length > 0) {
  console.error(`${failures.length} offline capture check(s) failed.`);
  process.exit(1);
}
console.log("done");
