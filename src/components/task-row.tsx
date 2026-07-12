import { Check, Repeat, X } from "lucide-react";
import { toggleTask, deleteItem } from "@/lib/actions";
import { formatDay, todayKey } from "@/lib/dates";
import type { TaskView } from "@/lib/data";

export function TaskRow({ task }: { task: TaskView }) {
  const checked = task.done || task.completedToday;
  const overdue =
    !checked && task.dueKey !== null && task.dueKey < todayKey();

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/[.04]">
      <form action={toggleTask}>
        <input type="hidden" name="taskId" value={task.taskId} />
        <button
          type="submit"
          aria-label={checked ? "Mark not done" : "Mark done"}
          className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-black/25 dark:border-white/30 hover:border-emerald-500"
          }`}
        >
          {checked && <Check size={13} strokeWidth={3} />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            checked ? "text-black/40 line-through dark:text-white/40" : ""
          }`}
        >
          {task.priority > 0 && !checked && (
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle" />
          )}
          {task.title}
        </p>
        {(task.dueKey || task.recurrence) && (
          <p
            className={`flex items-center gap-1 text-xs ${
              overdue ? "text-red-500" : "text-black/45 dark:text-white/45"
            }`}
          >
            {task.dueKey && formatDay(task.dueKey)}
            {task.recurrence && (
              <span className="inline-flex items-center gap-0.5">
                <Repeat size={11} /> {task.recurrence}
              </span>
            )}
          </p>
        )}
      </div>

      <form action={deleteItem}>
        <input type="hidden" name="itemId" value={task.itemId} />
        <button
          type="submit"
          aria-label="Delete task"
          className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-white/30"
        >
          <X size={14} />
        </button>
      </form>
    </div>
  );
}
