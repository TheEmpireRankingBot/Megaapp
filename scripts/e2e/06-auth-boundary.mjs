// Automatic single-user access verification. No auth variables are required.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const base = process.env.BASE_URL || "http://localhost:3000";

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("today opens directly:", page.url().endsWith("/today"));
console.log("app navigation shown:", (await page.getByText("Tasks", { exact: true }).count()) > 0);
console.log("email sign-in removed:", (await page.getByText(/sign-in link/i).count()) === 0);

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
console.log("legacy login redirects home:", page.url().endsWith("/today"));

await page.goto(`${base}/auth/callback`, { waitUntil: "networkidle" });
console.log("legacy callback redirects home:", page.url().endsWith("/today"));

await page.goto(`${base}/auth/confirm`, { waitUntil: "networkidle" });
console.log("legacy confirmation redirects home:", page.url().endsWith("/today"));

const manifest = await page.request.get(`${base}/manifest.webmanifest`);
console.log("PWA manifest remains public:", manifest.ok());
const offline = await page.request.get(`${base}/offline.html`);
console.log(
  "offline capture shell remains public:",
  offline.ok() && (await offline.text()).includes("Capture now. Sync later."),
);

await page.screenshot({ path: "e2e6-auto-access-mobile.png", fullPage: true });
await browser.close();
console.log("done");
