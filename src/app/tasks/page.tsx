import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <ModulePlaceholder
      title="Tasks"
      description="Todos, projects, recurring chores, due dates, and priorities."
      phase="Phase 1"
    />
  );
}
