// Auth boundary verification. Start the production server with placeholder
// Supabase values (no real project is required for unauthenticated routing):
//
// NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test
// npm run start
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const base = process.env.BASE_URL || "http://localhost:3000";

await page.goto(`${base}/today`, { waitUntil: "networkidle" });
console.log("protected route redirects:", page.url().includes("/login?next=%2Ftoday"));
console.log("magic-link form shown:", (await page.getByText("Email me a sign-in link").count()) === 1);
console.log("app navigation hidden:", (await page.getByText("Tasks", { exact: true }).count()) === 0);

await page.goto(`${base}/auth/callback`, { waitUntil: "networkidle" });
console.log("invalid callback handled:", page.url().includes("/login?error=invalid-link"));
console.log("expired-link copy shown:", (await page.getByText(/invalid or has expired/).count()) === 1);

const manifest = await page.request.get(`${base}/manifest.webmanifest`);
console.log("PWA manifest remains public:", manifest.ok());

await page.screenshot({ path: "e2e6-login-mobile.png", fullPage: true });
await browser.close();
console.log("done");
