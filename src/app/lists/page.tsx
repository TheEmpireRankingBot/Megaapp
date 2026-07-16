import { getCurrentUser } from "@/lib/user";
import { getMediaLibrary, MEDIA_KINDS } from "@/lib/lists";
import { createMediaItem } from "@/lib/actions";
import { MediaLibraryClient } from "@/components/media-library-client";

export const metadata = { title: "Lists" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  book: "Book",
  movie: "Movie",
  show: "Show",
  game: "Game",
  other: "Other",
};

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

      <MediaLibraryClient initialItems={library.all} />
    </div>
  );
}
