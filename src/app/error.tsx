"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-amber-500/25 bg-amber-500/[.04] p-6 text-center sm:p-8">
      <AlertTriangle className="mx-auto text-amber-600 dark:text-amber-400" size={32} />
      <h1 className="mt-4 text-xl font-bold tracking-tight">This page hit a problem</h1>
      <p className="mt-2 text-sm text-black/55 dark:text-white/55">
        Your data is still safe. Try loading the page again, or return to Today.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-black/35 dark:text-white/35">
          Reference {error.digest}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
          <RefreshCw size={15} /> Try again
        </button>
        <Link href="/today" className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/15">
          Go to Today
        </Link>
      </div>
    </section>
  );
}
