// Scripted browser verification — see scripts/e2e/README.md. Run against a
// fresh dev DB (rm -rf .pglite) with the server on localhost:3000.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const base = "http://localhost:3000";
const settle = () => page.waitForTimeout(1200);

// --- Today (Sunday) should prompt the review ---
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("review prompt on today:", (await page.locator("text=Close out the week").count()) > 0);

// --- Review page: auto-drafted stats from the week's real data ---
await page.goto(`${base}/review`, { waitUntil: "networkidle" });
const body = await page.locator("main").textContent();
console.log("tasks completed stat:", /\d+ completed/.test(body));
console.log("habit adherence shown:", (await page.locator("text=/7").count()) > 0);
console.log("journaled days:", /journaled\s*1\/7 days/.test(body.replace(/\s+/g, " ")));
console.log("money total:", body.includes("$74.68"));
console.log("workouts:", /1 workouts/.test(body));
console.log("avg sleep:", body.includes("7.5h avg sleep"));

// --- Fill and save the reflection ---
await page.fill('textarea[name="wins"]', "Shipped four phases of Megaapp.");
await page.fill('textarea[name="challenges"]', "Skipped water two days.");
await page.fill('textarea[name="focus"]', "Deploy it and use it daily on my phone.");
await page.click('button:has-text("Save review")');
await settle();
console.log("saved (button flips):", (await page.locator('button:has-text("Update review")').count()) > 0);
await page.screenshot({ path: "e2e4-review.png" });

// --- Prompt gone from Today once review exists ---
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("prompt gone after save:", (await page.locator("text=Close out the week").count()) === 0);

await browser.close();
console.log("done");
