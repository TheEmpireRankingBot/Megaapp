import { Bot, CalendarDays, CheckCircle2, Wallet } from "lucide-react";
import { AssistantClient } from "@/components/assistant-client";
import { getAssistantAudit, getAssistantBrief, getAssistantSnapshot } from "@/lib/assistant";
import { formatSGD } from "@/lib/money";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await getCurrentUser();
  const [snapshot, audit] = await Promise.all([
    getAssistantSnapshot(user.id, user.settings),
    getAssistantAudit(user.id),
  ]);
  const brief = getAssistantBrief(snapshot);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Bot size={24} /> Assistant</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">Ask about your life, or prepare a small change that only happens after you confirm it.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"><CheckCircle2 size={14} /> Priority</p><p className="mt-2 text-sm font-medium">{brief.priority ?? "Your task list is clear"}</p></div>
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"><Wallet size={14} /> {snapshot.money.month}</p><p className="mt-2 text-sm font-medium tabular-nums">{formatSGD(brief.spent)} spent</p></div>
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"><CalendarDays size={14} /> Daily loop</p><p className="mt-2 text-sm font-medium">{brief.tasks} open tasks · {brief.habits} habits</p></div>
      </section>

      <AssistantClient aiConfigured={aiConfigured} audit={audit} />
    </div>
  );
}
