export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading Megaapp">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-64 max-w-full rounded bg-black/[.06] dark:bg-white/[.06]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-xl border border-black/10 bg-black/[.02] dark:border-white/10 dark:bg-white/[.025]" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
