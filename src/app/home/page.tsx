import { CheckCircle2, HousePlus, ShieldCheck, Wrench, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { formatDay, todayKey } from "@/lib/dates";
import { getHomeData } from "@/lib/home";
import { completeMaintenance, createHomeAsset, createMaintenanceItem, deleteItem } from "@/lib/actions";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

function dueLabel(days: number) {
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "due today";
  return `in ${days}d`;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const { assets, maintenance } = await getHomeData(user.id);
  return (
    <div className="space-y-8">
      <header><h1 className="text-2xl font-bold tracking-tight">Home &amp; Stuff</h1><p className="mt-1 text-sm text-black/50 dark:text-white/50">Keep warranties findable and maintenance from becoming repairs.</p></header>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={createHomeAsset} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Add possession</h2>
          <div className="flex flex-wrap gap-2"><input name="title" required placeholder="Item name" className="min-w-40 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" /><select name="category" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black">{["appliance", "electronics", "vehicle", "furniture", "other"].map((category) => <option key={category}>{category}</option>)}</select></div>
          <input name="serial" placeholder="Serial or model (optional)" className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <div className="flex flex-wrap gap-2"><label className="flex flex-1 items-center gap-2 text-xs text-black/50 dark:text-white/50">Bought <input name="purchaseDate" type="date" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm text-foreground dark:border-white/15 dark:[color-scheme:dark]" /></label><label className="flex flex-1 items-center gap-2 text-xs text-black/50 dark:text-white/50">Warranty <input name="warrantyEnd" type="date" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm text-foreground dark:border-white/15 dark:[color-scheme:dark]" /></label></div>
          <div className="flex gap-2"><input name="notes" placeholder="Receipt location or notes" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" /><button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Add</button></div>
        </form>

        <form action={createMaintenanceItem} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Schedule maintenance</h2>
          <input name="title" required placeholder="Service aircon, change filter…" className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <div className="flex flex-wrap gap-2"><select name="assetItemId" aria-label="Linked possession" className="min-w-36 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black"><option value="">No linked item</option>{assets.map((asset) => <option key={asset.itemId} value={asset.itemId}>{asset.title}</option>)}</select><input name="dueDate" type="date" required defaultValue={todayKey()} className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:[color-scheme:dark]" /><select name="cadenceMonths" aria-label="Maintenance recurrence" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black"><option value="0">One time</option><option value="1">Monthly</option><option value="3">Every 3 months</option><option value="6">Every 6 months</option><option value="12">Yearly</option></select></div>
          <div className="flex gap-2"><input name="notes" placeholder="Provider, parts, instructions" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" /><button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Schedule</button></div>
        </form>
      </div>

      <section className="space-y-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Maintenance</h2>{maintenance.length === 0 ? <div className="rounded-xl border border-dashed border-black/15 p-6 text-center dark:border-white/15"><Wrench className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-2 text-sm text-black/50 dark:text-white/50">Nothing due. Quick Capture also understands <span className="font-mono">service aircon</span>.</p></div> : <div className="space-y-2">{maintenance.map((item) => <article key={item.itemId} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${item.daysUntil <= 0 ? "border-amber-500/30 bg-amber-500/[.04]" : "border-black/10 dark:border-white/10"}`}><div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p><p className="text-xs text-black/50 dark:text-white/50">{item.assetTitle ? `${item.assetTitle} · ` : ""}{formatDay(item.payload.dueDate)} · <span className={item.daysUntil <= 0 ? "text-amber-700 dark:text-amber-400" : ""}>{dueLabel(item.daysUntil)}</span>{item.payload.cadenceMonths ? ` · every ${item.payload.cadenceMonths}mo` : ""}</p>{item.payload.notes && <p className="mt-1 text-sm text-black/50 dark:text-white/50">{item.payload.notes}</p>}</div><form action={completeMaintenance}><input type="hidden" name="itemId" value={item.itemId} /><button className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={14} /> Done</button></form></article>)}</div>}</section>

      <section className="space-y-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Possessions · {assets.length}</h2>{assets.length === 0 ? <div className="rounded-xl border border-dashed border-black/15 p-6 text-center dark:border-white/15"><HousePlus className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-2 text-sm text-black/50 dark:text-white/50">Add the expensive things whose serials and warranties you never want to hunt for.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{assets.map((asset) => <article key={asset.itemId} className="group rounded-xl border border-black/10 p-4 dark:border-white/10"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-medium">{asset.title}</p><p className="text-xs capitalize text-black/50 dark:text-white/50">{asset.payload.category}</p></div><form action={deleteItem}><input type="hidden" name="itemId" value={asset.itemId} /><button aria-label={`Delete ${asset.title}`} className="p-1 text-black/30 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-white/30"><X size={14} /></button></form></div>{asset.payload.serial && <p className="mt-3 font-mono text-xs text-black/55 dark:text-white/55">{asset.payload.serial}</p>}{asset.payload.warrantyEnd && <p className={`mt-2 flex items-center gap-1 text-xs ${asset.warrantyDays !== null && asset.warrantyDays <= 30 ? "text-amber-700 dark:text-amber-400" : "text-black/50 dark:text-white/50"}`}><ShieldCheck size={13} /> Warranty to {formatDay(asset.payload.warrantyEnd)}</p>}{asset.payload.notes && <p className="mt-2 text-sm text-black/50 dark:text-white/50">{asset.payload.notes}</p>}</article>)}</div>}</section>
    </div>
  );
}
