import { LibraryBig, Sparkles, Star, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getMediaLibrary, MEDIA_KINDS, type MediaItem } from "@/lib/lists";
import {
  createMediaItem,
  deleteItem,
  rateMediaItem,
  updateMediaState,
} from "@/lib/actions";

export const metadata = { title: "Lists" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  book: "Book",
  movie: "Movie",
  show: "Show",
  game: "Game",
  other: "Other",
};

function MediaRow({ item }: { item: MediaItem }) {
  return (
    <div className="group rounded-xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">
          {KIND_LABEL[item.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.title}</p>
          {item.notes && <p className="mt-1 text-xs text-black/50 dark:text-white/50">{item.notes}</p>}
          {item.rating && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
              <Star size={12} fill="currentColor" /> {item.rating}/5
            </p>
          )}
        </div>
        <form action={deleteItem}>
          <input type="hidden" name="itemId" value={item.itemId} />
          <button aria-label={`Delete ${item.title}`} className="rounded p-1 text-black/30 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-white/30">
            <X size={14} />
          </button>
        </form>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.state !== "in_progress" && (
          <form action={updateMediaState}>
            <input type="hidden" name="itemId" value={item.itemId} />
            <input type="hidden" name="state" value="in_progress" />
            <button className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              Start
            </button>
          </form>
        )}
        {item.state !== "done" && (
          <form action={updateMediaState}>
            <input type="hidden" name="itemId" value={item.itemId} />
            <input type="hidden" name="state" value="done" />
            <button className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              Finish
            </button>
          </form>
        )}
        {item.state === "done" && (
          <form action={rateMediaItem} className="flex items-center gap-1">
            <input type="hidden" name="itemId" value={item.itemId} />
            <select name="rating" defaultValue={item.rating ?? ""} aria-label={`Rate ${item.title}`} className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10 dark:bg-black">
              <option value="" disabled>rate</option>
              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
            </select>
            <button className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">Save</button>
          </form>
        )}
        {item.state !== "backlog" && (
          <form action={updateMediaState}>
            <input type="hidden" name="itemId" value={item.itemId} />
            <input type="hidden" name="state" value="backlog" />
            <button className="text-xs text-black/40 hover:underline dark:text-white/40">Backlog</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{items.map((item) => <MediaRow key={item.itemId} item={item} />)}</div>
    </section>
  );
}

export default async function ListsPage() {
  const user = await getCurrentUser();
  const library = await getMediaLibrary(user.id);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Lists &amp; Media</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">Books, films, shows, and games—one backlog you can actually finish.</p>
      </header>

      <form action={createMediaItem} className="flex flex-wrap gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <input name="title" required placeholder="Add a title" className="min-w-48 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15" />
        <select name="kind" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black">
          {MEDIA_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
        </select>
        <input name="notes" placeholder="Why it caught your eye" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15" />
        <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Add</button>
      </form>

      {library.nextPick && (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/[.05] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"><Sparkles size={14} /> Pick next</p>
          <p className="mt-2 font-medium">{library.nextPick.title}</p>
          <p className="text-xs text-black/50 dark:text-white/50">Oldest item in your backlog. Start it or clear it.</p>
        </section>
      )}

      {library.all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <LibraryBig className="mx-auto text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">Try Quick Capture: <span className="font-mono">read Dune</span> or <span className="font-mono">watch Severance</span>.</p>
        </div>
      ) : (
        <div className="space-y-7">
          <Section title="In progress" items={library.current} />
          <Section title={`Backlog · ${library.backlog.length}`} items={library.backlog} />
          <Section title={`Finished · ${library.done.length}`} items={library.done} />
        </div>
      )}
    </div>
  );
}
