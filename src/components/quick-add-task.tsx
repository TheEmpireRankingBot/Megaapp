import { createTask } from "@/lib/actions";

/** Full add form for the Tasks page: due date, repeat, priority. */
export function AddTaskForm() {
  return (
    <form
      action={createTask}
      className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
    >
      <input
        name="title"
        placeholder="What needs doing?"
        autoComplete="off"
        required
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-black/35 focus:border-black/40 dark:border-white/15 dark:placeholder:text-white/35 dark:focus:border-white/40"
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-black/60 dark:text-white/60">
          Due
          <input
            type="date"
            name="due"
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15 dark:[color-scheme:dark]"
          />
        </label>
        <label className="flex items-center gap-2 text-black/60 dark:text-white/60">
          Repeat
          <select
            name="recurrence"
            defaultValue=""
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15 dark:bg-black"
          >
            <option value="">never</option>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-black/60 dark:text-white/60">
          <input type="checkbox" name="priority" className="accent-red-500" />
          High priority
        </label>
        <button
          type="submit"
          className="ml-auto rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
        >
          Add task
        </button>
      </div>
    </form>
  );
}
