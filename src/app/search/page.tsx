import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { searchAll } from "@/lib/search";
import { formatDay } from "@/lib/dates";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const user = await getCurrentUser();
  const results = query.length >= 2 ? await searchAll(user.id, query) : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">Find tasks, recipes, goals, journal notes, expenses, and everything else.</p>
      </header>
      <form className="flex gap-2" action="/search">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 py-2 dark:border-white/15">
          <SearchIcon size={17} className="text-black/40 dark:text-white/40" />
          <input name="q" defaultValue={query} autoFocus placeholder="Search Megaapp" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Search</button>
      </form>

      {query.length < 2 ? (
        <p className="text-sm text-black/45 dark:text-white/45">Type at least two characters.</p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/45 dark:border-white/15 dark:text-white/45">Nothing matched “{query}”.</p>
      ) : (
        <section className="space-y-2">
          <p className="text-xs text-black/40 dark:text-white/40">{results.length} result{results.length === 1 ? "" : "s"}</p>
          {results.map((result) => (
            <Link key={`${result.module}-${result.id}`} href={result.href} className="flex items-start gap-3 rounded-xl border border-black/10 p-3 transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]">
              <span className="mt-0.5 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">{result.module}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{result.title}</span>
                <span className="text-xs text-black/45 dark:text-white/45">{result.detail}{result.day ? ` · ${formatDay(result.day)}` : ""}</span>
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
