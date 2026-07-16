// Scripted browser verification — see scripts/e2e/README.md. Run against a
// fresh dev DB (rm -rf .pglite) with the server on localhost:3000.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = process.env.BASE_URL || "http://localhost:3000";
const settle = () => page.waitForTimeout(1200);

// --- Tasks: quick add via full form, one plain, one recurring ---
await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Buy groceries");
await page.fill('input[name="due"]', new Date().toISOString().slice(0, 10));
await page.click('button:has-text("Add task")');
await settle();

await page.fill('input[name="title"]', "Morning stretch");
await page.selectOption('select[name="recurrence"]', "daily");
await page.click('button:has-text("Add task")');
await settle();

await page.fill('input[name="title"]', "Book dentist appointment");
await page.check('input[name="priority"]');
await page.click('button:has-text("Add task")');
await settle();
console.log("tasks page has Buy groceries:", await page.locator("text=Buy groceries").count());
console.log("tasks page has daily repeat:", await page.locator("text=daily").count() > 0);
await page.screenshot({ path: "e2e-tasks.png" });

// --- Habits: create two, check one ---
await page.goto(`${base}/habits`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Read 20 minutes");
await page.press('input[name="title"]', "Enter");
await page.getByText("Read 20 minutes", { exact: true }).waitFor();
await page.fill('input[name="title"]', "Drink 2L water");
await page.press('input[name="title"]', "Enter");
await page.getByText("Drink 2L water", { exact: true }).waitFor();
await page.click('button[aria-label="Check Read 20 minutes"]');
await page.getByText("1 day streak", { exact: true }).waitFor();
console.log("habit streak text:", await page.locator("text=1 day streak").count());
await page.screenshot({ path: "e2e-habits.png" });

// --- Journal: mood + note ---
await page.goto(`${base}/journal`, { waitUntil: "networkidle" });
await page.locator('input[name="mood"][value="4"]').check({ force: true });
await page.fill(
  'textarea[name="note"]',
  "Started building Megaapp today. The daily loop is coming together.",
);
await page.click('button:has-text("Save entry")');
await settle();
console.log("journal saved:", await page.locator('button:has-text("Update entry")').count());

// --- Today: complete a task, verify the ring moves ---
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("today shows groceries:", await page.locator("text=Buy groceries").count());
console.log("today shows habits:", await page.locator("text=Read 20 minutes").count());
const ringBefore = await page.locator("svg[aria-label]").getAttribute("aria-label");
console.log("ring before:", ringBefore);
const ringMatch = ringBefore?.match(/^(\d+) of (\d+) done$/);
if (!ringMatch) throw new Error(`Unexpected progress ring label: ${ringBefore}`);
await page.locator('div:has(> form) >> text=Buy groceries').first();
// complete "Buy groceries" via its row toggle
const row = page.locator("div.group", { hasText: "Buy groceries" }).first();
await row.locator('button[aria-label="Mark done"]').click();
const expectedRing = `${Number(ringMatch[1]) + 1} of ${ringMatch[2]} done`;
await page.waitForFunction((label) => document.querySelector("svg[aria-label]")?.getAttribute("aria-label") === label, expectedRing);
const ringAfter = await page.locator("svg[aria-label]").getAttribute("aria-label");
console.log("ring after:", ringAfter);
console.log("ring advances immediately:", ringAfter === expectedRing);
await page.screenshot({ path: "e2e-today-desktop.png" });

// Mobile screenshot
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/today`, { waitUntil: "networkidle" });
await mobile.screenshot({ path: "e2e-today-mobile.png" });

await browser.close();
console.log("done");
