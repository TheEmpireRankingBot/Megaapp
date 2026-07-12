import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const user = await getCurrentUser();
  const db = await getDb();

  const [[itemCount], [entryCount]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.items)
      .where(eq(schema.items.userId, user.id)),
    db
      .select({ n: count() })
      .from(schema.entries)
      .where(eq(schema.entries.userId, user.id)),
  ]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const sections = [
    {
      href: "/tasks",
      title: "Tasks",
      empty: "Nothing due — task management lands in Phase 1.",
    },
    {
      href: "/habits",
      title: "Habits",
      empty: "No habits yet — streaks and check-ins land in Phase 1.",
    },
    {
      href: "/journal",
      title: "Journal",
      empty: "No entry today — journaling lands in Phase 1.",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-black/50 dark:text-white/50">{dateLabel}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting(now.getHours())}, {user.name}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-black/10 dark:border-white/10 p-4 transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
          >
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              {s.empty}
            </p>
          </Link>
        ))}
      </div>

      <footer className="text-xs text-black/40 dark:text-white/40">
        Life database: {itemCount.n} items · {entryCount.n} entries ·{" "}
        <a href="/api/export" className="underline underline-offset-2">
          export everything
        </a>
      </footer>
    </div>
  );
}
