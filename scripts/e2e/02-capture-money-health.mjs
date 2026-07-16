// Scripted browser verification — see scripts/e2e/README.md. Run against a
// fresh dev DB (rm -rf .pglite) with the server on localhost:3000.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const base = process.env.BASE_URL || "http://localhost:3000";

async function capture(text) {
  await page.fill('input[name="text"]', text);
  await page.press('input[name="text"]', "Enter");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);
}

// --- Quick Capture v2 from Today ---
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await capture("$14.50 chicken rice #food");
await capture("$3.20 kopi #food");
await capture("$25 grab home #transport");
await capture("weight 72.4");
await capture("water 500");
await capture("water 1l");
await capture("sleep 7.5");
await capture("run 5km 30min");
await capture("todo renew passport tomorrow");

// --- Money page ---
await page.goto(`${base}/money`, { waitUntil: "networkidle" });
console.log("money total has 42.70:", (await page.locator("text=42.70").count()) > 0);
console.log("food category row:", (await page.locator("text=food").count()) > 0);
console.log("chicken rice listed:", (await page.locator("text=chicken rice").count()) > 0);
// set budget
await page.fill('input[name="budget"]', "800");
await page.click('button:has-text("Set")');
const budgetText = "$757.30 left of $800.00";
await page.getByText(budgetText, { exact: true }).waitFor();
console.log("budget bar updates:", (await page.getByText(budgetText, { exact: true }).count()) === 1);
// log via form
const expenseForm = page.locator("form", { has: page.getByRole("button", { name: "Log", exact: true }) });
await expenseForm.locator('input[name="amount"]').fill("12");
await expenseForm.locator('input[name="note"]').fill("movie ticket");
await expenseForm.locator('select[name="category"]').selectOption("fun");
await expenseForm.getByRole("button", { name: "Log", exact: true }).click();
const savedStatus = page.getByRole("status").filter({ hasText: "movie ticket" });
await savedStatus.waitFor();
console.log("expense confirms immediately:", await savedStatus.isVisible());
await page.reload({ waitUntil: "networkidle" });
await page.getByText("movie ticket", { exact: true }).waitFor();
console.log("movie ticket listed:", (await page.locator("text=movie ticket").count()) > 0);
await page.screenshot({ path: "e2e2-money.png" });

// --- Health page ---
await page.goto(`${base}/health`, { waitUntil: "networkidle" });
console.log("weight card:", await page.locator("text=72.4 kg").count());
console.log("water today:", (await page.locator("text=1500").count()) > 0);
console.log("sleep avg:", (await page.locator("text=7.5 h").count()) > 0);
console.log("workouts week:", (await page.locator("text=Workouts this week").count()) > 0);
console.log("run log listed:", (await page.locator("text=run 5km 30min").count()) > 0);
await page.screenshot({ path: "e2e2-health.png" });

// --- Task from capture landed with tomorrow due ---
await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
console.log("passport task:", (await page.locator("text=renew passport").count()) > 0);
console.log("tomorrow label:", (await page.locator("text=Tomorrow").count()) > 0);

// --- Today with capture bar, mobile ---
const mobile = await browser.newPage({
  viewport: { width: 390, height: 900 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/today`, { waitUntil: "networkidle" });
await mobile.screenshot({ path: "e2e2-today-mobile.png" });

await browser.close();
console.log("done");
