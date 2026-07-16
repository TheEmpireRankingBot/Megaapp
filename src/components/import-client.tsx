"use client";

import { ChangeEvent, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Download, FileCheck2, FileUp, ShieldCheck } from "lucide-react";
import { importCsvRecords } from "@/lib/actions";
import {
  IMPORT_CONFIG,
  IMPORT_KINDS,
  MAX_CSV_BYTES,
  importRecordSummary,
  parseImportCsv,
  type ImportKind,
  type ImportPreview,
} from "@/lib/imports";

function ConfirmButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || count === 0}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {pending ? "Importing…" : `Confirm import ${count} row${count === 1 ? "" : "s"}`}
    </button>
  );
}

export function ImportClient({ initialKind }: { initialKind: ImportKind }) {
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = IMPORT_CONFIG[kind];

  function changeKind(next: ImportKind) {
    setKind(next);
    setCsvText("");
    setFileName("");
    setPreview(null);
    setError(null);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setError("That file is over 500 KB. Split it into batches of 250 rows or fewer.");
      setCsvText("");
      setPreview(null);
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    setPreview(null);
    setError(null);
  }

  function buildPreview() {
    if (!csvText.trim()) {
      setError("Choose a CSV file or paste CSV text first.");
      setPreview(null);
      return;
    }
    setError(null);
    setPreview(parseImportCsv(kind, csvText));
  }

  function downloadTemplate() {
    const blob = new Blob([config.template], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `megaapp-${kind}-template.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Import type">
        {IMPORT_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => changeKind(option)}
            aria-pressed={kind === option}
            className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
              kind === option
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.04]"
            }`}
          >
            <span className="font-medium">{IMPORT_CONFIG[option].label}</span>
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Import {config.label.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">{config.description}</p>
            <p className="mt-1 text-xs text-black/40 dark:text-white/40">Columns: {config.columns}</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
          >
            <Download size={14} /> Download template
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-black/20 p-4 hover:bg-black/[.02] dark:border-white/20 dark:hover:bg-white/[.03]">
          <FileUp size={20} className="shrink-0 text-black/40 dark:text-white/40" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Choose CSV file</span>
            <span className="block truncate text-xs text-black/45 dark:text-white/45">
              {fileName || "Maximum 500 KB and 250 data rows per batch"}
            </span>
          </span>
          <input
            key={kind}
            type="file"
            accept=".csv,text/csv"
            onChange={selectFile}
            aria-label={`Choose ${config.label} CSV file`}
            className="sr-only"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/50 dark:text-white/50">Or paste CSV</span>
          <textarea
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setFileName("");
              setPreview(null);
              setError(null);
            }}
            rows={7}
            spellCheck={false}
            aria-label="CSV contents"
            placeholder={config.template.trim()}
            className="mt-2 w-full rounded-lg border border-black/15 bg-transparent p-3 font-mono text-xs leading-5 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
            <ShieldCheck size={14} /> Parsed locally; only validated preview rows are submitted.
          </p>
          <button
            type="button"
            onClick={buildPreview}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
          >
            Preview import
          </button>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[.05] p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {preview && (
        <section className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <FileCheck2 size={18} /> Review before importing
              </h2>
              <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                {preview.records.length} ready · {preview.issues.length} issue{preview.issues.length === 1 ? "" : "s"} · {preview.totalRows} source row{preview.totalRows === 1 ? "" : "s"}
              </p>
            </div>
            {preview.records.length > 0 && (
              <form action={importCsvRecords}>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="records" value={JSON.stringify(preview.records)} />
                <ConfirmButton count={preview.records.length} />
              </form>
            )}
          </div>

          {preview.issues.length > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[.05] p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} /> Rows with issues will not be imported
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                {preview.issues.slice(0, 20).map((issue, index) => (
                  <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.records.length > 0 ? (
            <div className="space-y-2">
              {preview.records.slice(0, 25).map((record, index) => {
                const summary = importRecordSummary(record);
                return (
                  <div key={`${summary.title}-${index}`} className="rounded-lg bg-black/[.025] px-3 py-2 dark:bg-white/[.04]">
                    <p className="text-sm font-medium">{summary.title}</p>
                    <p className="text-xs text-black/45 dark:text-white/45">{summary.detail}</p>
                  </div>
                );
              })}
              {preview.records.length > 25 && (
                <p className="text-xs text-black/40 dark:text-white/40">And {preview.records.length - 25} more validated rows.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-black/45 dark:text-white/45">No valid rows are ready yet. Fix the issues above and preview again.</p>
          )}
        </section>
      )}
    </div>
  );
}
