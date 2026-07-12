import { saveJournal } from "@/lib/actions";
import { MOODS, type JournalView } from "@/lib/data";

export function JournalForm({ existing }: { existing: JournalView | null }) {
  return (
    <form action={saveJournal} className="space-y-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Mood">
        {MOODS.map((emoji, i) => {
          const value = i + 1;
          return (
            <label
              key={value}
              className="cursor-pointer rounded-full p-1.5 text-xl transition-transform has-checked:scale-125 has-checked:bg-black/5 dark:has-checked:bg-white/10 grayscale has-checked:grayscale-0"
            >
              <input
                type="radio"
                name="mood"
                value={value}
                defaultChecked={existing?.mood === value}
                className="sr-only"
              />
              {emoji}
            </label>
          );
        })}
      </div>
      <textarea
        name="note"
        rows={4}
        defaultValue={existing?.note ?? ""}
        placeholder="How was today? What happened, what did you think about it?"
        className="w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none placeholder:text-black/35 focus:border-black/40 dark:border-white/15 dark:placeholder:text-white/35 dark:focus:border-white/40"
      />
      <button
        type="submit"
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
      >
        {existing ? "Update entry" : "Save entry"}
      </button>
    </form>
  );
}
