import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-lg py-16 text-center">
      <Compass className="mx-auto text-black/30 dark:text-white/30" size={36} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-black/40 dark:text-white/40">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">That page isn’t here</h1>
      <p className="mt-2 text-sm text-black/50 dark:text-white/50">The link may be old, or the page may have moved.</p>
      <Link href="/today" className="mt-5 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
        Return to Today
      </Link>
    </section>
  );
}
