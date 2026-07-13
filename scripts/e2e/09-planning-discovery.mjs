// Cross-module verification for Calendar, Goals, Lists, Search, and Today.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const base = "http://localhost:3000";
const settle = () => page.waitForTimeout(1200);

// Calendar event.
await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Planning sync");
await page.fill('input[name="startTime"]', "15:00");
await page.fill('input[name="endTime"]', "16:00");
await page.fill('input[name="location"]', "Home office");
await page.getByRole("button", { name: "Add", exact: true }).click();
await settle();
console.log("calendar event saved:", (await page.getByText("Planning sync", { exact: true }).count()) >= 1);

// A linkable task, then a goal with two milestones.
await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Ship planning upgrade");
await page.getByRole("button", { name: "Add task" }).click();
await settle();

await page.goto(`${base}/goals`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Run Megaapp planning from one place");
await page.selectOption('select[name="horizon"]', "quarter");
await page.fill('textarea[name="milestones"]', "Use the calendar for one week\nFinish one backlog item");
await page
  .locator("label", { hasText: "Ship planning upgrade" })
  .locator('input[name="linkedItemId"]')
  .check();
await page.getByRole("button", { name: "Create goal" }).click();
await settle();
console.log("goal saved:", (await page.getByText("Run Megaapp planning from one place", { exact: true }).count()) === 1);
console.log("goal starts at zero:", (await page.getByText("0/3 steps complete", { exact: true }).count()) === 1);
await page.getByRole("button", { name: /Use the calendar for one week/ }).click();
await settle();
console.log("milestone advances progress:", (await page.getByText("1/3 steps complete", { exact: true }).count()) === 1);

// Quick Capture feeds the media backlog; the full form adds a show.
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.fill('input[name="text"]', "read Dune");
await page.press('input[name="text"]', "Enter");
await settle();
console.log("today agenda includes event:", (await page.getByText("Planning sync", { exact: true }).count()) === 1);
console.log("today includes current goal:", (await page.getByText("Run Megaapp planning from one place", { exact: true }).count()) === 1);

await page.goto(`${base}/lists`, { waitUntil: "networkidle" });
console.log("capture added book:", (await page.getByText("Dune", { exact: true }).count()) >= 1);
await page.fill('input[name="title"]', "Severance");
await page.selectOption('select[name="kind"]', "show");
await page.fill('input[name="notes"]', "Watch the next season");
await page.getByRole("button", { name: "Add", exact: true }).click();
await settle();
const severance = page.locator("div.group", { hasText: "Severance" });
await severance.getByRole("button", { name: "Start", exact: true }).click();
await settle();
console.log("media moves in progress:", (await page.getByText("In progress", { exact: true }).count()) === 1);

// Global search crosses module boundaries.
await page.goto(`${base}/search?q=Planning%20sync`, { waitUntil: "networkidle" });
console.log("search finds calendar:", (await page.getByText("Planning sync", { exact: true }).count()) === 1);
await page.goto(`${base}/search?q=Dune`, { waitUntil: "networkidle" });
console.log("search finds media:", (await page.getByText("Dune", { exact: true }).count()) >= 1);

// Shared-items storage means the existing export includes all three modules.
const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const modules = new Set(payload.items.map((item) => item.module));
console.log(
  "export includes planning modules:",
  ["calendar", "goals", "lists"].every((module) => modules.has(module)),
);

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
for (const route of ["calendar", "goals", "lists", "search?q=Dune", "today"]) {
  await mobile.goto(`${base}/${route}`, { waitUntil: "networkidle" });
  console.log(
    `mobile ${route.split("?")[0]} fits:`,
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
}
await mobile.screenshot({ path: "e2e9-planning-mobile.png", fullPage: true });
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.screenshot({ path: "e2e9-today-desktop.png", fullPage: true });

await browser.close();
console.log("done");
