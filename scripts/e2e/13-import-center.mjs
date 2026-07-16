// Import Center: local CSV preview, validation, confirmed batch writes, dedupe, audit, and mobile layout.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
const base = process.env.BASE_URL || "http://localhost:3000";
const runId = Date.now().toString();
const dayKey = (offset = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(date);
};

async function uploadCsv(text, fileName = "import.csv") {
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from(text),
  });
  await page.getByRole("button", { name: "Preview import" }).click();
}

const taskTitle = `Imported task ${runId}`;
const quotedTaskTitle = `Imported, quoted task ${runId}`;
const taskCsv = [
  "title,due,priority",
  `${taskTitle},${dayKey(2)},high`,
  `"${quotedTaskTitle}",,normal`,
  `${taskTitle},${dayKey(2)},high`,
  "Broken import task,not-a-date,urgent",
].join("\n");

await page.goto(`${base}/import`, { waitUntil: "networkidle" });
console.log("import center opens:", (await page.getByRole("heading", { name: "Import Center" }).count()) === 1);
await uploadCsv(taskCsv, "tasks.csv");
console.log(
  "task preview validates and dedupes file:",
  (await page.getByText(/2 ready · 3 issues · 4 source rows/).count()) === 1 &&
    (await page.getByText(/Duplicate row in this file/).count()) === 1,
);
await page.getByRole("button", { name: "Confirm import 2 rows" }).click();
await page.waitForURL(/\/import\?.*imported=2/);
console.log("task import reports success:", (await page.getByText(/Added 2 tasks/).count()) === 1);
await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
console.log(
  "task rows imported:",
  (await page.getByText(taskTitle, { exact: true }).count()) === 1 &&
    (await page.getByText(quotedTaskTitle, { exact: true }).count()) === 1,
);

await page.goto(`${base}/import?kind=tasks`, { waitUntil: "networkidle" });
await uploadCsv(taskCsv, "tasks-again.csv");
await page.getByRole("button", { name: "Confirm import 2 rows" }).click();
await page.waitForURL(/imported=0&skipped=2/);
console.log("existing task duplicates skipped:", (await page.getByText(/Added 0 tasks; skipped 2 duplicates/).count()) === 1);

const expenseNote = `Imported lunch ${runId}`;
const expenseCsv = [
  "date,amount,description,category",
  `${dayKey()},12.45,${expenseNote},food`,
  `${dayKey()},9.00,Bad category,unknown`,
].join("\n");
await page.getByRole("button", { name: "Expenses", exact: true }).click();
await uploadCsv(expenseCsv, "expenses.csv");
console.log("expense issue isolated:", (await page.getByText(/1 ready · 1 issue · 2 source rows/).count()) === 1);
await page.getByRole("button", { name: "Confirm import 1 row" }).click();
await page.waitForURL(/kind=expenses&imported=1/);
await page.goto(`${base}/money`, { waitUntil: "networkidle" });
console.log("expense imported:", (await page.getByText(expenseNote, { exact: true }).count()) === 1);

const habitTitle = `Imported habit ${runId}`;
await page.goto(`${base}/import?kind=habits`, { waitUntil: "networkidle" });
await uploadCsv(`title\n${habitTitle}`, "habits.csv");
await page.getByRole("button", { name: "Confirm import 1 row" }).click();
await page.waitForURL(/kind=habits&imported=1/);
await page.goto(`${base}/habits`, { waitUntil: "networkidle" });
console.log("habit imported:", (await page.getByText(habitTitle, { exact: true }).count()) === 1);

const eventTitle = `Imported sync ${runId}`;
const allDayTitle = `Imported all day ${runId}`;
const calendarCsv = [
  "title,date,start_time,end_time,all_day,location,notes",
  `${eventTitle},${dayKey(3)},14:00,15:00,false,"Office, Level 3","Imported, with comma"`,
  `${allDayTitle},${dayKey(4)},,,true,,`,
].join("\n");
await page.goto(`${base}/import?kind=calendar`, { waitUntil: "networkidle" });
await uploadCsv(calendarCsv, "calendar.csv");
console.log("quoted calendar CSV parses:", (await page.getByText(/2 ready · 0 issues · 2 source rows/).count()) === 1);
await page.getByRole("button", { name: "Confirm import 2 rows" }).click();
await page.waitForURL(/kind=calendar&imported=2/);
await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
console.log(
  "calendar events imported:",
  (await page.getByText(eventTitle, { exact: true }).count()) === 1 &&
    (await page.getByText(allDayTitle, { exact: true }).count()) === 1 &&
    (await page.getByText("Office, Level 3", { exact: true }).count()) >= 1,
);

await page.goto(`${base}/import`, { waitUntil: "networkidle" });
console.log("import history visible:", (await page.getByText(/Imported 2 calendar events from CSV/).count()) >= 1);
const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const importAudits = payload.entries.filter(
  (entry) => entry.module === "imports" && entry.type === "batch_applied",
);
console.log(
  "import audit exported:",
  importAudits.length >= 5 &&
    importAudits.some((entry) => entry.payload.kind === "tasks" && entry.payload.skipped === 2) &&
    importAudits.some((entry) => entry.payload.kind === "calendar" && entry.payload.imported === 2),
);

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("today links to import:", (await page.getByRole("link", { name: "Import data" }).count()) === 1);

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/import`, { waitUntil: "networkidle" });
console.log(
  "mobile import center fits:",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);
await mobile.screenshot({ path: "e2e13-import-center-mobile.png", fullPage: true });
await page.goto(`${base}/import`, { waitUntil: "networkidle" });
await page.screenshot({ path: "e2e13-import-center-desktop.png", fullPage: true });

await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]);
console.log("done");
process.exit(0);
