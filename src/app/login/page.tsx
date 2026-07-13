import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { sendMagicLink } from "@/lib/auth-actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "send-failed": "That link could not be sent. Wait a moment and try again.",
  "invalid-link": "That sign-in link is invalid or has expired. Request a new one.",
  "not-configured": "Authentication is not configured yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/today");
  const params = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-black/10 p-6 shadow-sm dark:border-white/10 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            Megaapp
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Your life, private.</h1>
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Enter your email and we&apos;ll send a one-time sign-in link. No password to remember.
          </p>
        </div>

        {params.sent === "1" && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            Link sent. Check your inbox, then come back here to start your day.
          </div>
        )}
        {params.error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
            {ERRORS[params.error] ?? "Sign-in failed. Request a new link and try again."}
          </div>
        )}

        <form action={sendMagicLink} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email address</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2.5 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
              <Mail size={16} className="shrink-0 text-black/35 dark:text-white/35" />
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
          >
            Email me a sign-in link
          </button>
        </form>

        <p className="text-xs leading-relaxed text-black/40 dark:text-white/40">
          The link expires and can only be used once. Megaapp never receives your password.
        </p>
      </div>
    </div>
  );
}
