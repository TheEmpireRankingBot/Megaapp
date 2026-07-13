// Assistant Actions v2: draft-only boundary, explicit confirm, audit, export, and mobile layout.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
const base = "http://localhost:3000";
const settle = () => page.waitForTimeout(1000);
const runId = Date.now().toString();

async function ask(command) {
  await page.locator("textarea").fill(command);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByText("Ready to confirm", { exact: true }).waitFor();
}

async function confirm() {
  await page.getByRole("button", { name: "Confirm action" }).click();
  await page.getByRole("status").waitFor();
  await settle();
}

const taskTitle = `Assistant action task ${runId}`;
await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await ask(`add task ${taskTitle} tomorrow`);
const beforeTaskConfirm = await page.request.get(`${base}/api/export`);
const beforeTaskPayload = await beforeTaskConfirm.json();
console.log(
  "task stays a draft before confirm:",
  !beforeTaskPayload.items.some((item) => item.module === "tasks" && item.title === taskTitle),
);
console.log(
  "task draft shows exact due date:",
  (await page.getByText("Due", { exact: true }).count()) === 1,
);
await confirm();
console.log(
  "task confirmation returns summary:",
  (await page.getByRole("status").innerText()) === `Created task: ${taskTitle}`,
);
await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
console.log("confirmed task is created:", (await page.getByText(taskTitle, { exact: true }).count()) === 1);

const expenseNote = `assistant action groceries ${runId}`;
await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await ask(`$23 ${expenseNote} #groceries`);
console.log("expense draft shows category:", (await page.getByText("groceries", { exact: true }).count()) >= 1);
await confirm();
await page.goto(`${base}/money`, { waitUntil: "networkidle" });
console.log("confirmed expense is logged:", (await page.getByText(expenseNote, { exact: true }).count()) >= 1);

const eventTitle = `Assistant action sync ${runId}`;
await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await ask(`schedule ${eventTitle} tomorrow at 3:30pm`);
console.log("event draft parses time:", (await page.getByText(/at 15:30/).count()) === 1);
await confirm();
await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
console.log("confirmed event is created:", (await page.getByText(eventTitle, { exact: true }).count()) === 1);

const habitTitle = `Assistant action stretch ${runId}`;
await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
await ask(`start habit ${habitTitle}`);
console.log("habit draft is visible:", (await page.getByText(habitTitle, { exact: true }).count()) >= 1);
await confirm();
await page.goto(`${base}/habits`, { waitUntil: "networkidle" });
console.log("confirmed habit is created:", (await page.getByText(habitTitle, { exact: true }).count()) === 1);

await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
console.log(
  "audit shows all confirmed actions:",
  (await page.getByText(`Created task: ${taskTitle}`, { exact: true }).count()) === 1 &&
    (await page.getByText("Logged expense: S$23.00 in groceries", { exact: true }).count()) >= 1 &&
    (await page.getByText(`Created calendar event: ${eventTitle}`, { exact: true }).count()) === 1 &&
    (await page.getByText(`Created daily habit: ${habitTitle}`, { exact: true }).count()) === 1,
);

const exported = await page.request.get(`${base}/api/export`);
const payload = await exported.json();
const audit = payload.entries.filter(
  (entry) => entry.module === "assistant" && entry.type === "action_applied",
);
console.log(
  "export contains confirmation audit without prompt text:",
  audit.length >= 4 && audit.every((entry) => entry.note && !entry.note.includes("schedule ") && !entry.note.includes("start habit ")),
);

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await mobile.goto(`${base}/assistant`, { waitUntil: "networkidle" });
console.log(
  "mobile assistant actions fit:",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);
await mobile.screenshot({ path: "e2e12-assistant-actions-mobile.png", fullPage: true });
await page.screenshot({ path: "e2e12-assistant-actions-desktop.png", fullPage: true });

await browser.close();
console.log("done");
