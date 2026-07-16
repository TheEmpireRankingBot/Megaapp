import { spawnSync } from "node:child_process";

const scripts = [
  "01-daily-loop.mjs",
  "02-capture-money-health.mjs",
  "03-subscriptions.mjs",
  "04-weekly-review.mjs",
  "05-meals-groceries.mjs",
  "08-insights.mjs",
  "09-planning-discovery.mjs",
  "10-life-admin-vault.mjs",
  "11-assistant.mjs",
  "12-assistant-actions.mjs",
  "13-import-center.mjs",
  "14-alpha-readiness.mjs",
  "15-offline-capture.mjs",
];
const chromiumPath =
  process.env.CHROMIUM_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : undefined);
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const preflightDeadline = Date.now() + 90_000;
let preflightError = "server did not respond";
let preflightReady = false;
while (Date.now() < preflightDeadline) {
  try {
    const health = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    preflightReady = true;
    break;
  } catch (error) {
    preflightError = error instanceof Error ? error.message : String(error);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
if (!preflightReady) {
  console.error(`Alpha browser preflight failed at ${baseUrl}: ${preflightError}`);
  process.exit(1);
}
console.log(`Preflight health ready at ${baseUrl}`);
const requestedStart = process.env.ALPHA_E2E_START?.trim();
const startIndex = requestedStart
  ? scripts.findIndex((script) => script.startsWith(requestedStart))
  : 0;
if (startIndex < 0) {
  console.error(`Unknown ALPHA_E2E_START value: ${requestedStart}`);
  process.exit(1);
}
const requestedEnd = process.env.ALPHA_E2E_END?.trim();
const endIndex = requestedEnd
  ? scripts.findIndex((script) => script.startsWith(requestedEnd))
  : scripts.length - 1;
if (endIndex < startIndex) {
  console.error(`Unknown or invalid ALPHA_E2E_END value: ${requestedEnd}`);
  process.exit(1);
}

for (const script of scripts.slice(startIndex, endIndex + 1)) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(process.execPath, [`scripts/e2e/${script}`], {
    cwd: process.cwd(),
    env: { ...process.env, ...(chromiumPath ? { CHROMIUM_PATH: chromiumPath } : {}) },
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nStopped after ${script} (exit ${result.status ?? "unknown"}).`);
    process.exit(result.status ?? 1);
  }
  if (/(?:^|\n)[^\n:]+:\s*(?:false|missing|0(?:\s|$))/i.test(result.stdout ?? "")) {
    console.error(`\nStopped after ${script}: a rendered assertion reported false or zero.`);
    process.exit(1);
  }
}

console.log("\nAll local alpha browser scenarios passed.");
