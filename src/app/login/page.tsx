import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { KeyRound, UserRound } from "lucide-react";
import { signIn } from "@/lib/auth-actions";
import { getPasswordAccessConfig, SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken } from "@/lib/session";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!getPasswordAccessConfig()) redirect("/today");
  const cookieStore = await cookies();
  if (await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/today");
  const params = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-black/10 p-6 shadow-sm dark:border-white/10 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            Megaapp
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Sign in with your Megaapp username and password.
          </p>
        </div>

        {params.error === "invalid" && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
            That username or password is incorrect.
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Username</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2.5 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
              <UserRound size={16} className="shrink-0 text-black/35 dark:text-white/35" />
              <input
                name="username"
                required
                autoComplete="username"
                autoFocus
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2.5 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
              <KeyRound size={16} className="shrink-0 text-black/35 dark:text-white/35" />
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
