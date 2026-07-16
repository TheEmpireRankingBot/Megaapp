// Scripted browser verification — see scripts/e2e/README.md. Run after the
// earlier scripts against the same throwaway DB with localhost:3000 running.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const base = process.env.BASE_URL || "http://localhost:3000";

async function addRecipe(title, ingredients, link = "") {
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="ingredients"]', ingredients);
  if (link) await page.fill('input[name="link"]', link);
  await page.click('button:has-text("Add recipe")');
  await page.locator("article", { hasText: title }).first().waitFor();
}

await page.goto(`${base}/meals`, { waitUntil: "networkidle" });
await addRecipe(
  "Ginger chicken rice",
  "Chicken thighs\nRice\nGinger\nSpring onion",
  "https://example.com/chicken-rice",
);
await addRecipe("Tofu rice bowl", "Tofu\nRice\nSpring onion\nSesame oil");
console.log("recipe box has chicken:", (await page.getByText("Ginger chicken rice").count()) > 0);
console.log("recipe box has tofu:", (await page.getByText("Tofu rice bowl").count()) > 0);

const dinnerSelects = page.locator('select[name^="meal-"]');
await dinnerSelects.nth(0).selectOption({ label: "Ginger chicken rice" });
await dinnerSelects.nth(1).selectOption({ label: "Tofu rice bowl" });
await dinnerSelects.nth(2).selectOption({ label: "Ginger chicken rice" });
await page.click('button:has-text("Save week")');
await page.locator('button:has-text("Update week")').waitFor();
console.log("weekly plan saved:", (await page.locator('button:has-text("Update week")').count()) > 0);

await page.click('button:has-text("Generate grocery list")');
await page.locator('button[aria-label="Check Chicken thighs"]').waitFor();
console.log("generated chicken:", (await page.locator('button[aria-label="Check Chicken thighs"]').count()) === 1);
console.log("deduped rice:", (await page.locator('button[aria-label="Check Rice"]').count()) === 1);
console.log("generated tofu:", (await page.locator('button[aria-label="Check Tofu"]').count()) === 1);
await page.screenshot({ path: "e2e5-meals-desktop.png", fullPage: true });

// Quick Capture appends to the one active grocery list.
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.fill('input[name="text"]', "buy milk");
await page.press('input[name="text"]', "Enter");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);

// The full flow must remain usable at the 390px target viewport.
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/meals`, { waitUntil: "networkidle" });
console.log("capture added milk:", (await mobile.locator('button[aria-label="Check milk"]').count()) === 1);
await mobile.locator('button[aria-label="Check milk"]').click();
await mobile.waitForTimeout(1200);
console.log("mobile grocery toggle:", (await mobile.locator('button[aria-label="Uncheck milk"]').count()) === 1);
await mobile.screenshot({ path: "e2e5-meals-mobile.png", fullPage: true });

// Meals use the shared items primitive, so the existing export endpoint must
// include recipes, the weekly plan, and the grocery list automatically.
const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const mealTypes = new Set(
  payload.items.filter((item) => item.module === "meals").map((item) => item.type),
);
console.log(
  "export includes meals:",
  ["recipe", "plan", "grocery"].every((type) => mealTypes.has(type)),
);

await browser.close();
console.log("done");
