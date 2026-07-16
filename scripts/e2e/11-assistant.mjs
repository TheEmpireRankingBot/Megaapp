// Phase 5 Assistant verification: local answers, read-only boundary, review handoff, and mobile layout.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const base = process.env.BASE_URL || "http://localhost:3000";

// Seed through the real capture path so the assistant has fresh, known data.
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.fill('input[name="text"]', "todo Assistant focus task today");
await page.press('input[name="text"]', "Enter");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);
await page.fill('input[name="text"]', "$18 assistant lunch #food");
await page.press('input[name="text"]', "Enter");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);

await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
console.log("assistant local mode renders:", (await page.getByText("Private local mode.", { exact: true }).count()) === 1);
console.log("assistant excludes vault promise:", (await page.getByText(/Vault data is never included/).count()) === 1);

await page.getByRole("button", { name: "What should I focus on today?" }).click();
await page.getByRole("button", { name: "Ask", exact: true }).click();
await page.getByText("Local briefing", { exact: true }).waitFor();
console.log("focus answer prioritizes an open task:", (await page.getByText(/Start with/).count()) >= 1);

await page.getByRole("button", { name: "How is my spending this month?" }).click();
await page.getByRole("button", { name: "Ask", exact: true }).click();
await page.getByText(/spent in/).waitFor();
console.log("money answer uses current month summary:", (await page.getByText(/spent in/).count()) >= 1);

await page.getByRole("button", { name: "Draft my weekly review." }).click();
await page.getByRole("button", { name: "Ask", exact: true }).click();
await page.getByText(/Weekly review draft/).waitFor();
console.log("review draft is structured:", (await page.getByText(/Wins:/).count()) >= 1 && (await page.getByText(/Focus:/).count()) >= 1);
await page.reload({ waitUntil: "networkidle" });
console.log("assistant reply is not persisted:", (await page.getByText(/Weekly review draft/).count()) === 0);

await page.goto(`${base}/review`, { waitUntil: "networkidle" });
console.log("review links to assistant:", (await page.getByRole("link", { name: "draft with Assistant" }).count()) === 1);
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("today links to assistant:", (await page.getByText("Ask your personal planning assistant", { exact: true }).count()) === 1);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
for (const route of ["assistant", "review", "today"]) {
  await mobile.goto(`${base}/${route}`, { waitUntil: "networkidle" });
  console.log(`mobile ${route} fits:`, await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}
await mobile.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await mobile.screenshot({ path: "e2e11-assistant-mobile.png", fullPage: true });
await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await page.screenshot({ path: "e2e11-assistant-desktop.png", fullPage: true });

await browser.close();
console.log("done");
