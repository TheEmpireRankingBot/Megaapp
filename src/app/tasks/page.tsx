import { getCurrentUser } from "@/lib/user";
import { getActiveTasks, groupTasks, type TaskView } from "@/lib/data";
import { AddTaskForm } from "@/components/quick-add-task";
import { TaskRow } from "@/components/task-row";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

function Group({ title, tasks }: { title: string; tasks: TaskView[] }) {
  if (tasks.length === 0) return null;
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>
      <div>
        {tasks.map((t) => (
          <TaskRow key={t.taskId} task={t} />
        ))}
      </div>
    </section>
  );
}

export default async function TasksPage() {
  const user = await getCurrentUser();
  const groups = groupTasks(await getActiveTasks(user.id));
  const empty =
    groups.overdue.length +
      groups.today.length +
      groups.upcoming.length +
      groups.someday.length +
      groups.doneToday.length ===
    0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      <AddTaskForm />
      {empty && (
        <p className="text-sm text-black/45 dark:text-white/45">
          Nothing here yet. Add your first task above — give it a due date and
          it shows up on Today.
        </p>
      )}
      <Group title="Overdue" tasks={groups.overdue} />
      <Group title="Today" tasks={groups.today} />
      <Group title="Upcoming" tasks={groups.upcoming} />
      <Group title="Someday" tasks={groups.someday} />
      <Group title="Done today" tasks={groups.doneToday} />
    </div>
  );
}
