import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getPasswordAccessConfig } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

function configured(names: string[]) {
  return names.map((name) => Boolean(process.env[name]?.trim()));
}

function completeGroup(names: string[]) {
  const values = configured(names);
  return values.every(Boolean) || values.every((value) => !value);
}

export async function GET() {
  const startedAt = Date.now();
  const pushNames = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  const hosted = Boolean(process.env.VERCEL || process.env.MEGAAPP_REQUIRE_EXTERNAL_DB === "1");
  let passwordAccess = false;
  let accessConfigurationValid = true;
  try {
    passwordAccess = Boolean(getPasswordAccessConfig());
  } catch {
    accessConfigurationValid = false;
  }
  const configurationValid =
    completeGroup(pushNames) &&
    accessConfigurationValid &&
    (!hosted || (Boolean(process.env.DATABASE_URL?.trim()) && passwordAccess));

  try {
    const db = await getDb();
    await db.select({ id: schema.users.id }).from(schema.users).limit(1);

    return NextResponse.json(
      {
        status: configurationValid ? "ok" : "degraded",
        database: process.env.DATABASE_URL ? "external" : "embedded",
        access: passwordAccess ? "password" : accessConfigurationValid ? "local" : "misconfigured",
        notifications: configured(pushNames).every(Boolean) ? "configured" : "disabled",
        durationMs: Date.now() - startedAt,
      },
      { status: configurationValid ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        access: passwordAccess ? "password" : accessConfigurationValid ? "local" : "misconfigured",
        notifications: configured(pushNames).every(Boolean) ? "configured" : "disabled",
        durationMs: Date.now() - startedAt,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
