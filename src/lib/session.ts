import { getPasswordAccessConfig } from "@/lib/auth-config";

const SESSION_DAYS = 30;
const encoder = new TextEncoder();

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function credentialsMatch(username: string, password: string) {
  const config = getPasswordAccessConfig();
  return Boolean(
    config &&
      constantTimeEqual(username, config.username) &&
      constantTimeEqual(password, config.password),
  );
}

export async function createSessionToken(username: string) {
  const config = getPasswordAccessConfig();
  if (!config || !constantTimeEqual(username, config.username)) {
    throw new Error("Password access is not configured.");
  }
  const payload = encode(
    JSON.stringify({
      version: 1,
      username: config.username,
      expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    }),
  );
  return `${payload}.${await sign(payload, config.sessionSecret)}`;
}

export async function verifySessionToken(token: string | undefined) {
  const config = getPasswordAccessConfig();
  if (!config || !token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;

  const expectedSignature = await sign(payload, config.sessionSecret);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(decode(payload)) as {
      version?: unknown;
      username?: unknown;
      expiresAt?: unknown;
    };
    return (
      parsed.version === 1 &&
      parsed.username === config.username &&
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt) &&
      parsed.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
