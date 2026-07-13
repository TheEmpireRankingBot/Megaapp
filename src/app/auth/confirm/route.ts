import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createSupabaseServerClient();

  if (tokenHash && rawType && EMAIL_OTP_TYPES.has(rawType) && supabase) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType,
    });
    if (!error) return NextResponse.redirect(new URL("/today", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
}
