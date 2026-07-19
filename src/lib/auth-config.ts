export const SESSION_COOKIE = "megaapp_session";

export type PasswordAccessConfig = {
  username: string;
  password: string;
  sessionSecret: string;
};

export function getPasswordAccessConfig(): PasswordAccessConfig | null {
  const username = process.env.MEGAAPP_USERNAME?.trim() ?? "";
  const password = process.env.MEGAAPP_PASSWORD ?? "";
  const sessionSecret = process.env.MEGAAPP_SESSION_SECRET ?? "";
  const values = [username, password, sessionSecret];
  const configured = values.filter(Boolean).length;

  if (configured > 0 && configured < values.length) {
    throw new Error(
      "Password access is partially configured. Set MEGAAPP_USERNAME, MEGAAPP_PASSWORD, and MEGAAPP_SESSION_SECRET together.",
    );
  }

  if (configured === 0) {
    if (process.env.VERCEL || process.env.MEGAAPP_REQUIRE_EXTERNAL_DB === "1") {
      throw new Error(
        "Password access is required for hosted Megaapp. Set MEGAAPP_USERNAME, MEGAAPP_PASSWORD, and MEGAAPP_SESSION_SECRET.",
      );
    }
    return null;
  }

  if (username.length > 64) throw new Error("MEGAAPP_USERNAME must be at most 64 characters.");
  if (password.length < 12) throw new Error("MEGAAPP_PASSWORD must be at least 12 characters.");
  if (sessionSecret.length < 32) throw new Error("MEGAAPP_SESSION_SECRET must be at least 32 characters.");

  return { username, password, sessionSecret };
}
