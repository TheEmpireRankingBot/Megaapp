// Scripted browser verification — see scripts/e2e/README.md. Run against a
// fresh dev DB (rm -rf .pglite) with the server on localhost:3000.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const base = "http://localhost:3000";
const settle = () => page.waitForTimeout(1200);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const in3 = new Date(today.getTime() + 3 * 86400000);

async function addSub(name, amount, cadence, next) {
  const form = page.locator("form", { hasText: "next renewal" });
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="amount"]').fill(amount);
  await form.locator('select[name="cadence"]').selectOption(cadence);
  await form.locator('input[name="next"]').fill(next);
  await form.locator('button:has-text("Add")').click();
  await settle();
}

// --- Create subscriptions: one due today, one in 3 days, one yearly far out ---
await page.goto(`${base}/money`, { waitUntil: "networkidle" });
await addSub("Netflix", "19.98", "monthly", iso(today));
await addSub("Gym", "88", "monthly", iso(in3));
await addSub("iCloud 2TB", "119.88", "yearly", "2027-01-15");

console.log("due today label:", (await page.locator("text=due today").count()) > 0);
console.log("renews in 3d:", (await page.locator("text=renews in 3d").count()) > 0);
console.log("paid button count:", await page.locator('button:has-text("Paid")').count());
const monthlyTotal = await page.locator("text=/month").first().textContent();
console.log("monthly equivalent:", monthlyTotal); // 19.98 + 88 + 119.88/12 = 117.97

// --- Mark Netflix paid: expense logged, renewal advances a month ---
await page.click('button:has-text("Paid")');
await settle();
console.log("paid button gone:", (await page.locator('button:has-text("Paid")').count()) === 0);
// Netflix expense should now be in Recent + month total bumped by 19.98
console.log("netflix expense row:", (await page.locator("p", { hasText: /^Netflix$/ }).count()) >= 1);
await page.screenshot({ path: "e2e3-money.png" });

// --- Today shows the coming-up strip for Gym (3 days out) ---
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
const strip = await page.locator("text=Coming up").count();
console.log("today coming-up strip:", strip > 0);
console.log("gym in strip:", (await page.locator("text=Gym").count()) > 0);
console.log("netflix NOT in strip:", (await page.locator('a:has-text("Coming up") >> text=Netflix').count()) === 0);
await page.screenshot({ path: "e2e3-today.png" });

await browser.close();
console.log("done");
