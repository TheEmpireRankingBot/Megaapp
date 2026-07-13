// Scripted browser verification for the cross-module Insights dashboard.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const base = "http://localhost:3000";
const settle = () => page.waitForTimeout(1200);

async function capture(text) {
  await page.fill('input[name="text"]', text);
  await page.press('input[name="text"]', "Enter");
  await settle();
}

// Seed one fresh signal in each source module through the real UI.
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log(
  "today links to insights:",
  (await page.getByRole("link", { name: /See what your data is revealing/ }).count()) === 1,
);
await capture("$27 insights dinner #food");
await capture("sleep 7.5");

await page.goto(`${base}/habits`, { waitUntil: "networkidle" });
if ((await page.getByText("Insights walk", { exact: true }).count()) === 0) {
  await page.fill('input[name="title"]', "Insights walk");
  await page.press('input[name="title"]', "Enter");
  await settle();
}
const checkWalk = page.getByRole("button", {
  name: "Check Insights walk",
  exact: true,
});
if ((await checkWalk.count()) === 1) {
  await checkWalk.click();
  await settle();
}

await page.goto(`${base}/journal`, { waitUntil: "networkidle" });
await page.locator('input[name="mood"][value="4"]').check({ force: true });
await page.fill(
  'textarea[name="note"]',
  "Logged a normal day so Megaapp can learn from consistent data.",
);
await page.getByRole("button", { name: /Save entry|Update entry/ }).click();
await settle();

await page.goto(`${base}/insights`, { waitUntil: "networkidle" });
console.log("insights title:", (await page.getByRole("heading", { name: "Insights" }).count()) === 1);
console.log("habit heatmap:", (await page.getByText("Habit consistency").count()) === 1);
console.log("weekly spend chart:", (await page.getByText("Weekly spend").count()) === 1);
console.log("mood relationship:", (await page.getByText("Mood & habits").count()) === 1);
console.log("sleep relationship:", (await page.getByText("Sleep → next-day mood").count()) === 1);
console.log(
  "coverage includes seeded expense:",
  /[1-9]\d* expenses/.test((await page.getByText(/Coverage:/).textContent()) ?? ""),
);
await page.screenshot({ path: "e2e8-insights-desktop.png", fullPage: true });

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/insights`, { waitUntil: "networkidle" });
console.log(
  "mobile charts fit viewport:",
  (await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) === true,
);
await mobile.screenshot({ path: "e2e8-insights-mobile.png", fullPage: true });

await browser.close();
console.log("done");
