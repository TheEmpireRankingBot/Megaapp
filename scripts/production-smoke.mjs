const failures = [];
const rawBaseUrl = process.env.BASE_URL?.trim();

if (!rawBaseUrl) {
  console.error("BASE_URL is required, for example https://megaapp.example.com");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(rawBaseUrl);
  if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
    throw new Error("Production URLs must use HTTPS");
  }
} catch (error) {
  console.error(`Invalid BASE_URL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function check(condition, label, detail = "") {
  if (condition) console.log(`PASS  ${label}`);
  else {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

async function get(pathname, init = {}) {
  return fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
}

try {
  const healthResponse = await get("/api/health");
  const health = await healthResponse.json();
  check(
    healthResponse.ok &&
      health.status === "ok" &&
      health.database === "external" &&
      health.auth === "supabase" &&
      health.notifications === "configured",
    "production health reports external DB, Supabase auth, and notifications",
    `HTTP ${healthResponse.status} ${JSON.stringify(health)}`,
  );
  check(
    !Object.keys(health).some((key) => /secret|password|token|key/i.test(key)),
    "health response exposes no credential-shaped fields",
  );

  const protectedResponse = await get("/today");
  const location = protectedResponse.headers.get("location") ?? "";
  check(
    [301, 302, 303, 307, 308].includes(protectedResponse.status) && location.includes("/login"),
    "unauthenticated production app redirects to login",
    `HTTP ${protectedResponse.status} location=${location || "missing"}`,
  );

  const cronResponse = await get("/api/cron/notifications");
  check(cronResponse.status === 401, "notification cron rejects unauthenticated requests", `HTTP ${cronResponse.status}`);

  for (const pathname of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icon-192.png", "/icon-512.png"]) {
    const response = await get(pathname);
    check(response.ok, `${pathname} is publicly available`, `HTTP ${response.status}`);
  }
} catch (error) {
  console.error(`FAIL  production smoke request failed — ${error instanceof Error ? error.message : String(error)}`);
  failures.push("production smoke request");
}

if (failures.length > 0) process.exit(1);
console.log("PASS  Production smoke checks passed.");
