import { Zap } from "lucide-react";
import { quickCapture } from "@/lib/actions";

export function QuickCapture() {
  return (
    <div>
      <form action={quickCapture} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 py-2 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
          <Zap size={16} className="shrink-0 text-black/40 dark:text-white/40" />
          <input
            name="text"
            placeholder="Capture anything…"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
          />
        </div>
      </form>
      <p className="mt-1.5 px-1 text-[11px] text-black/35 dark:text-white/35">
        Tasks by default · <span className="font-mono">$12 lunch</span> ·{" "}
        <span className="font-mono">weight 72.4</span> ·{" "}
        <span className="font-mono">water 500</span> ·{" "}
        <span className="font-mono">sleep 7.5</span> ·{" "}
        <span className="font-mono">run 30min</span> ·{" "}
        <span className="font-mono">buy milk</span> ·{" "}
        <span className="font-mono">read Dune</span> ·{" "}
        <span className="font-mono">watch Severance</span> ·{" "}
        <span className="font-mono">todo call mum tomorrow</span>
      </p>
    </div>
  );
}
