// Remaining Tier-4 verification: Travel, People, Home, Vault, Today, Search, and export.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
const base = process.env.BASE_URL || "http://localhost:3000";
const dayKey = (offset = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(date);
};

await page.goto(`${base}/travel`, { waitUntil: "networkidle" });
const tripForm = page.locator("form", { hasText: "Create trip" });
await tripForm.locator('input[name="title"]').fill("Tokyo reset");
await tripForm.locator('input[name="destination"]').fill("Tokyo");
await tripForm.locator('input[name="startDate"]').fill(dayKey(10));
await tripForm.locator('input[name="endDate"]').fill(dayKey(14));
await tripForm.locator('select[name="templateId"]').selectOption("builtin:international");
await tripForm.getByRole("button", { name: "Create trip" }).click();
const trip = page.locator("article", { hasText: "Tokyo reset" });
await trip.getByText("0/10", { exact: true }).waitFor();
console.log("trip created from template:", (await trip.count()) === 1 && (await trip.getByText("0/10", { exact: true }).count()) === 1);
await trip.getByRole("button", { name: "Passport", exact: true }).click();
await trip.getByText("1/10", { exact: true }).waitFor();
console.log("packing progress advances:", (await trip.getByText("1/10", { exact: true }).count()) === 1);
await trip.locator('input[name="title"]').fill("TeamLab visit");
await trip.locator('input[name="day"]').fill(dayKey(11));
await trip.locator('input[name="time"]').fill("14:30");
await trip.locator('input[name="location"]').fill("Azabudai Hills");
await trip.getByRole("button", { name: "Add stop" }).click();
await trip.getByText("TeamLab visit", { exact: true }).waitFor();
console.log("itinerary saved:", (await trip.getByText("TeamLab visit", { exact: true }).count()) === 1);

await page.goto(`${base}/people`, { waitUntil: "networkidle" });
const personForm = page.locator("form", { hasText: "Add person" });
await personForm.locator('input[name="name"]').fill("Maya Tan");
await personForm.locator('input[name="relationship"]').fill("Friend");
await personForm.locator('input[name="birthday"]').fill(dayKey(5));
await personForm.locator('input[name="contact"]').fill("@maya");
await personForm.getByRole("button", { name: "Add person" }).click();
const maya = page.locator("article", { hasText: "Maya Tan" });
await maya.waitFor();
await page.getByText("Birthday coming up", { exact: true }).waitFor();
console.log("birthday person saved:", (await maya.count()) === 1 && (await page.getByText("Birthday coming up", { exact: true }).count()) === 1);
await maya.locator('input[name="idea"]').fill("Ceramics class");
await maya.getByRole("button", { name: "Save", exact: true }).click();
await maya.getByText("Ceramics class", { exact: true }).waitFor();
console.log("gift idea saved:", (await maya.getByText("Ceramics class", { exact: true }).count()) === 1);

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.fill('input[name="text"]', "met Jordan Lee");
await page.press('input[name="text"]', "Enter");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);
await page.goto(`${base}/people`, { waitUntil: "networkidle" });
console.log("contact capture creates person:", (await page.getByText("Jordan Lee", { exact: true }).count()) === 1);

await page.goto(`${base}/home`, { waitUntil: "networkidle" });
const assetForm = page.locator("form", { hasText: "Add possession" });
await assetForm.locator('input[name="title"]').fill("Living room aircon");
await assetForm.locator('select[name="category"]').selectOption("appliance");
await assetForm.locator('input[name="serial"]').fill("AC-2026-7788");
await assetForm.getByRole("button", { name: "Add", exact: true }).click();
await page.locator("article", { hasText: "Living room aircon" }).waitFor();
console.log("home asset saved:", (await page.getByText("Living room aircon", { exact: true }).count()) >= 1);
const maintenanceForm = page.locator("form", { hasText: "Schedule maintenance" });
await maintenanceForm.locator('input[name="title"]').fill("Clean aircon filter");
await maintenanceForm.locator('select[name="assetItemId"]').selectOption({ label: "Living room aircon" });
await maintenanceForm.locator('input[name="dueDate"]').fill(dayKey());
await maintenanceForm.locator('select[name="cadenceMonths"]').selectOption("1");
await maintenanceForm.getByRole("button", { name: "Schedule" }).click();
const maintenance = page.locator("article", { hasText: "Clean aircon filter" });
await maintenance.getByText(/due today/).waitFor();
console.log("maintenance linked and due:", (await maintenance.getByText(/Living room aircon/).count()) === 1 && (await maintenance.getByText(/due today/).count()) === 1);
await maintenance.getByRole("button", { name: "Done" }).click();
await maintenance.getByText(/in \d+d/).waitFor();
console.log("recurring maintenance advances:", (await maintenance.getByText(/every 1mo/).count()) === 1 && (await maintenance.getByText(/in \d+d/).count()) === 1);

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.fill('input[name="text"]', "service water heater");
await page.press('input[name="text"]', "Enter");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("megaapp:quick-capture-queue:v1") || "[]").length === 0);
await page.getByText("water heater", { exact: true }).waitFor();
console.log("today life admin appears:", (await page.getByText("Life admin", { exact: true }).count()) === 1 && (await page.getByText("Tokyo reset", { exact: true }).count()) >= 1 && (await page.getByText("Maya Tan", { exact: true }).count()) >= 1 && (await page.getByText("water heater", { exact: true }).count()) >= 1);

await page.goto(`${base}/vault`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Passport recovery");
await page.selectOption('select[name="kind"]', "recovery");
await page.fill('textarea[name="content"]', "SECRET-ALPHA-9284");
await page.fill('input[name="passphrase"]', "correct horse battery staple");
await page.getByRole("button", { name: "Encrypt & save" }).click();
await page.getByRole("status").waitFor();
console.log("vault encrypted save:", (await page.getByText(/Saved encrypted/).count()) === 1);
await page.reload({ waitUntil: "networkidle" });
await page.fill('input[name="unlockPassphrase"]', "correct horse battery staple");
await page.getByRole("button", { name: /Unlock/ }).click();
await page.getByText("Passport recovery", { exact: true }).waitFor();
console.log("vault decrypts on device:", (await page.getByText("SECRET-ALPHA-9284", { exact: true }).count()) === 1);

const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const serialized = JSON.stringify(payload);
const modules = new Set(payload.items.map((item) => item.module));
const vaultRows = payload.items.filter((item) => item.module === "vault");
console.log("export includes life-admin modules:", ["travel", "people", "home", "vault"].every((module) => modules.has(module)));
console.log("vault plaintext absent from export:", !serialized.includes("Passport recovery") && !serialized.includes("SECRET-ALPHA-9284") && vaultRows.every((item) => item.title === "Encrypted item" && item.payload.ciphertext));
console.log("shared reminders cover release:", ["travel", "people", "home"].every((module) => payload.reminders.some((reminder) => payload.items.some((item) => item.id === reminder.itemId && item.module === module))));

for (const [query, expected] of [["Tokyo reset", "Tokyo reset"], ["Maya Tan", "Maya Tan"], ["Living room aircon", "Living room aircon"]]) {
  await page.goto(`${base}/search?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle" });
  console.log(`search finds ${query}:`, (await page.getByText(expected, { exact: true }).count()) >= 1);
}
await page.goto(`${base}/search?q=Passport%20recovery`, { waitUntil: "networkidle" });
console.log("search cannot expose vault title:", (await page.getByText("Passport recovery", { exact: true }).count()) === 0);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
for (const route of ["travel", "people", "home", "vault", "search?q=Tokyo", "today"]) {
  await mobile.goto(`${base}/${route}`, { waitUntil: "networkidle" });
  console.log(`mobile ${route.split("?")[0]} fits:`, await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}
await mobile.screenshot({ path: "e2e10-life-admin-mobile.png", fullPage: true });
await page.goto(`${base}/today`, { waitUntil: "networkidle" });
await page.screenshot({ path: "e2e10-today-desktop.png", fullPage: true });

await browser.close();
console.log("done");
