// Password access verification. Start the server with MEGAAPP_USERNAME,
// MEGAAPP_PASSWORD, and MEGAAPP_SESSION_SECRET, and pass the first two here.
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const base = process.env.BASE_URL || "http://localhost:3000";
const username = process.env.MEGAAPP_USERNAME;
const password = process.env.MEGAAPP_PASSWORD;
if (!username || !password) throw new Error("MEGAAPP_USERNAME and MEGAAPP_PASSWORD are required");

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("protected route redirects:", page.url().endsWith("/login"));
console.log("username field shown:", (await page.getByLabel("Username").count()) === 1);
console.log("password field shown:", (await page.getByLabel("Password").count()) === 1);
console.log("email sign-in removed:", (await page.getByText(/email me|sign-in link/i).count()) === 0);

await page.getByLabel("Username").fill(username);
await page.getByLabel("Password").fill(`${password}-wrong`);
await Promise.all([
  page.waitForURL(`${base}/login?error=invalid`),
  page.getByRole("button", { name: "Sign in" }).click(),
]);
console.log("invalid credentials rejected:", (await page.getByText(/incorrect/i).count()) === 1);

await page.getByLabel("Username").fill(username);
await page.getByLabel("Password").fill(password);
await Promise.all([
  page.waitForURL(`${base}/today`),
  page.getByRole("button", { name: "Sign in" }).click(),
]);
await page.waitForLoadState("networkidle");
console.log("valid credentials open app:", page.url().endsWith("/today"));
console.log("app navigation shown:", (await page.getByText("Tasks", { exact: true }).count()) > 0);

await page.goto(`${base}/auth/callback`, { waitUntil: "networkidle" });
console.log("legacy callback preserves session:", page.url().endsWith("/today"));

await page.goto(`${base}/auth/confirm`, { waitUntil: "networkidle" });
console.log("legacy confirmation preserves session:", page.url().endsWith("/today"));

const manifest = await page.request.get(`${base}/manifest.webmanifest`);
console.log("PWA manifest remains public:", manifest.ok());
const offline = await page.request.get(`${base}/offline.html`);
console.log(
  "offline capture shell remains public:",
  offline.ok() && (await offline.text()).includes("Capture now. Sync later."),
);

await page.screenshot({ path: "e2e6-password-access-mobile.png", fullPage: true });
console.log("sign-out shown:", (await page.locator('button[aria-label="Sign out"]').count()) === 1);
await Promise.all([
  page.waitForURL(`${base}/login`),
  page.locator('button[aria-label="Sign out"]').click(),
]);
console.log("sign out clears session:", page.url().endsWith("/login"));
await browser.close();
console.log("done");
