import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function environmentGroup(label, names, required = false) {
  const populated = names.filter((name) => process.env[name]?.trim());
  if (populated.length > 0 && populated.length < names.length) {
    failures.push(`${label} is partial; set all of: ${names.join(", ")}`);
  } else if (required && populated.length === 0) {
    failures.push(`${label} is required in strict mode: ${names.join(", ")}`);
  }
}

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function placeholder(name, raw) {
  return /(?:replace|placeholder|project_ref|example\.com|local-test|your[_-])/i.test(raw)
    ? `${name} still looks like a placeholder`
    : null;
}

function validateStrictEnvironment(publishableName) {
  const checks = [];
  const databaseUrl = value("DATABASE_URL");
  const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = value(publishableName);
  const vapidPublicKey = value("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapidPrivateKey = value("VAPID_PRIVATE_KEY");
  const vapidSubject = value("VAPID_SUBJECT");
  const cronSecret = value("CRON_SECRET");

  for (const [name, raw] of [
    ["DATABASE_URL", databaseUrl],
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    [publishableName, publishableKey],
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapidPublicKey],
    ["VAPID_PRIVATE_KEY", vapidPrivateKey],
    ["VAPID_SUBJECT", vapidSubject],
    ["CRON_SECRET", cronSecret],
  ]) {
    const issue = placeholder(name, raw);
    if (issue) checks.push(issue);
  }

  try {
    const parsed = new URL(databaseUrl);
    if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) checks.push("DATABASE_URL must use postgres:// or postgresql://");
  } catch {
    checks.push("DATABASE_URL is not a valid URL");
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") checks.push("NEXT_PUBLIC_SUPABASE_URL must use https://");
  } catch {
    checks.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }
  if (publishableKey.length < 20) checks.push(`${publishableName} is unexpectedly short`);
  if (publishableKey && !/^[A-Za-z0-9._-]+$/.test(publishableKey)) checks.push(`${publishableName} has an unexpected format`);
  if (vapidPublicKey.length < 60) checks.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY is unexpectedly short");
  if (vapidPublicKey && !/^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) checks.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY must be base64url text");
  if (vapidPrivateKey.length < 40) checks.push("VAPID_PRIVATE_KEY is unexpectedly short");
  if (vapidPrivateKey && !/^[A-Za-z0-9_-]+$/.test(vapidPrivateKey)) checks.push("VAPID_PRIVATE_KEY must be base64url text");
  if (!/^(?:mailto:|https:\/\/)/i.test(vapidSubject)) checks.push("VAPID_SUBJECT must start with mailto: or https://");
  if (cronSecret.length < 16) checks.push("CRON_SECRET must be at least 16 characters");
  failures.push(...checks);
}

const requiredFiles = [
  ".env.example",
  "vercel.json",
  "drizzle/meta/_journal.json",
  "public/manifest.webmanifest",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/apple-touch-icon.png",
  "public/offline.html",
  "public/sw.js",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/loading.tsx",
  "src/app/api/health/route.ts",
];

for (const file of requiredFiles) assert(await exists(file), `Missing required alpha file: ${file}`);

const manifest = JSON.parse(await readFile(path.join(root, "public/manifest.webmanifest"), "utf8"));
assert(manifest.display === "standalone", "PWA manifest must use standalone display mode");
assert(manifest.start_url === "/today", "PWA manifest must start at /today");
for (const size of ["192x192", "512x512"]) {
  assert(manifest.icons?.some((icon) => icon.sizes === size && icon.type === "image/png"), `PWA manifest is missing a ${size} PNG icon`);
}

const vercel = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
assert(
  vercel.crons?.some(
    (cron) => cron.path === "/api/cron/notifications" && typeof cron.schedule === "string",
  ),
  "vercel.json must schedule the notification cron route",
);

const publishableName = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const strict = process.env.ALPHA_STRICT === "1";
environmentGroup("Supabase auth", ["NEXT_PUBLIC_SUPABASE_URL", publishableName], strict);
environmentGroup("Web Push", ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"], strict);
if (strict && !process.env.DATABASE_URL?.trim()) failures.push("DATABASE_URL is required in strict mode");
if (strict && !process.env.CRON_SECRET?.trim()) failures.push("CRON_SECRET is required in strict mode");
if (strict) validateStrictEnvironment(publishableName);
if (!strict && !process.env.DATABASE_URL?.trim()) warnings.push("Using embedded PGlite (correct for local development)");

if (process.env.BASE_URL?.trim()) {
  try {
    const response = await fetch(new URL("/api/health", process.env.BASE_URL));
    const body = await response.json();
    assert(response.ok && body.status === "ok", `Health endpoint is not ready: HTTP ${response.status} ${JSON.stringify(body)}`);
  } catch (error) {
    failures.push(`Health endpoint could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  warnings.push("Set BASE_URL to include the running app health endpoint in this check");
}

for (const warning of warnings) console.log(`WARN  ${warning}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exit(1);
}
console.log(`PASS  Alpha readiness checks (${requiredFiles.length} required files, strict=${strict})`);
