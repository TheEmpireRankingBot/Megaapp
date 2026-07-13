"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function sendMagicLink(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/today");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!validEmail(email)) redirect("/login?error=invalid-email");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=not-configured");
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) redirect("/login?error=send-failed");
  redirect("/login?sent=1");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect(isSupabaseConfigured() ? "/login" : "/today");
}
