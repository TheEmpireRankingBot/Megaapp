"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth-config";
import {
  createSessionToken,
  credentialsMatch,
  SESSION_MAX_AGE,
} from "@/lib/session";

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!credentialsMatch(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    redirect("/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(username), {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL || process.env.NODE_ENV === "production"),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/today");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
