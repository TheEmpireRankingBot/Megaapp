import { getCurrentUser } from "@/lib/user";
import { getJournalForDay, getRecentJournal, MOODS } from "@/lib/data";
import { formatDay, todayKey } from "@/lib/dates";
import { JournalForm } from "@/components/journal-form";

export const metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await getCurrentUser();
  const today = todayKey();
  const [entry, recent] = await Promise.all([
    getJournalForDay(user.id, today),
    getRecentJournal(user.id),
  ]);
  const past = recent.filter((e) => e.day !== today);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Journal</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Today
        </h2>
        <JournalForm existing={entry} />
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Earlier
          </h2>
          {past.map((e) => (
            <article
              key={e.entryId}
              className="rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <p className="text-xs font-medium text-black/45 dark:text-white/45">
                {e.mood && <span className="mr-1.5">{MOODS[e.mood - 1]}</span>}
                {formatDay(e.day)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-black/75 dark:text-white/75">
                {e.note || "Mood logged."}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
