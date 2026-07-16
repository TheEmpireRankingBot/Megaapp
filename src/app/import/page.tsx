import { DatabaseZap, History } from "lucide-react";
import { ImportClient } from "@/components/import-client";
import { formatDay } from "@/lib/dates";
import { getImportHistory } from "@/lib/import-history";
import { IMPORT_CONFIG, IMPORT_KINDS, type ImportKind } from "@/lib/imports";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string | string[];
    imported?: string | string[];
    skipped?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const history = await getImportHistory(user.id);
  const kindRaw = typeof params.kind === "string" ? params.kind : "tasks";
  const kind: ImportKind = IMPORT_KINDS.includes(kindRaw as ImportKind)
    ? (kindRaw as ImportKind)
    : "tasks";
  const imported = typeof params.imported === "string" ? Number(params.imported) : null;
  const skipped = typeof params.skipped === "string" ? Number(params.skipped) : null;
  const showResult = Number.isInteger(imported) && imported !== null && imported >= 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <DatabaseZap size={24} /> Import Center
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Bring your existing data into Megaapp with a preview and duplicate protection.
        </p>
      </header>

      {showResult && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[.05] p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <span className="font-medium">Import complete.</span>{" "}
          Added {imported} {imported === 1 ? IMPORT_CONFIG[kind].singular : IMPORT_CONFIG[kind].label.toLowerCase()}
          {typeof skipped === "number" && skipped > 0
            ? `; skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`
            : "."}
        </div>
      )}

      <ImportClient initialKind={kind} />

      <section className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          <History size={15} /> Recent imports
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/45 dark:text-white/45">
            No imports yet. Your confirmed batches will appear here and in JSON export.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-black/[.025] px-3 py-2 dark:bg-white/[.04]">
                <p className="text-sm">{item.note}</p>
                <p className="text-xs text-black/45 dark:text-white/45">{formatDay(item.day)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
