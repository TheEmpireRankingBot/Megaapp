export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center">
        <p className="text-black/60 dark:text-white/60">{description}</p>
        <p className="mt-2 inline-block rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-medium">
          Coming in {phase}
        </p>
      </div>
    </div>
  );
}
