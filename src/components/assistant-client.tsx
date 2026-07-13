"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, CheckCircle2, LockKeyhole, Send, Sparkles, X } from "lucide-react";
import { askAssistant, confirmAssistantAction } from "@/lib/actions";
import { assistantActionAuditNote, assistantActionDetails } from "@/lib/assistant-actions";
import { formatDay } from "@/lib/dates";
import type { AssistantAuditItem, AssistantReply } from "@/lib/assistant";

const SUGGESTIONS = [
  "What should I focus on today?",
  "How is my spending this month?",
  "What needs attention this week?",
  "Draft my weekly review.",
];

const COMMAND_SUGGESTIONS = [
  "add task call dentist tomorrow",
  "$18 groceries #groceries",
  "schedule team sync tomorrow at 3pm",
  "start habit Evening stretch",
];

const CONFIRMATION_STORAGE_KEY = "megaapp-assistant-confirmation";

export function AssistantClient({
  aiConfigured,
  audit,
}: {
  aiConfigured: boolean;
  audit: AssistantAuditItem[];
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [visibleAudit, setVisibleAudit] = useState(audit);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(CONFIRMATION_STORAGE_KEY),
  );

  useEffect(() => {
    if (confirmation) {
      window.sessionStorage.removeItem(CONFIRMATION_STORAGE_KEY);
    }
  }, [confirmation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending || confirming) return;
    setPending(true);
    setConfirmation(null);
    try {
      const data = new FormData();
      data.set("question", trimmed);
      setReply(await askAssistant(data));
    } catch {
      setReply({
        answer: "I couldn’t prepare that right now. Please try again.",
        mode: "local",
        sources: [],
      });
    } finally {
      setPending(false);
    }
  }

  async function confirmProposal() {
    const proposal = reply?.proposal;
    if (!proposal || confirming) return;
    setConfirming(true);
    const pendingSummary = assistantActionAuditNote(proposal);
    window.sessionStorage.setItem(CONFIRMATION_STORAGE_KEY, pendingSummary);
    try {
      const data = new FormData();
      data.set("proposal", JSON.stringify(proposal));
      const result = await confirmAssistantAction(data);
      if (!result) {
        window.sessionStorage.removeItem(CONFIRMATION_STORAGE_KEY);
        setConfirmation("That draft is no longer valid. Ask again to create a fresh one.");
        return;
      }
      setConfirmation(result.summary);
      setReply(null);
      setQuestion("");
      setVisibleAudit((current) => [result, ...current].slice(0, 8));
    } catch {
      window.sessionStorage.removeItem(CONFIRMATION_STORAGE_KEY);
      setConfirmation("I couldn’t confirm that action. Nothing was changed—please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className={`flex gap-3 rounded-xl border p-4 text-sm ${
          aiConfigured
            ? "border-emerald-500/25 bg-emerald-500/[.04]"
            : "border-black/10 bg-black/[.025] dark:border-white/10 dark:bg-white/[.03]"
        }`}
      >
        <LockKeyhole
          size={18}
          className={
            aiConfigured
              ? "mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              : "mt-0.5 shrink-0 text-black/45 dark:text-white/45"
          }
        />
        <p>
          <span className="font-medium">{aiConfigured ? "AI is ready." : "Private local mode."}</span>{" "}
          {aiConfigured
            ? "Each question sends only a compact, Vault-excluding data summary. Requests are one-turn and not stored by Megaapp."
            : "You can ask for a useful provider-free summary now. Add OPENAI_API_KEY later for richer AI answers; Vault data is never included."}
          {" "}Short commands can prepare a local action draft, but every change needs a separate confirmation.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
      >
        <label className="block">
          <span className="text-sm font-medium">Ask Megaapp</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={800}
            rows={3}
            placeholder="What should I focus on this week?"
            className="mt-2 w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuestion(suggestion)}
              className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/60 hover:bg-black/[.03] dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[.04]"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs text-black/45 dark:text-white/45">Try an action draft</p>
          <div className="flex flex-wrap gap-2">
            {COMMAND_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuestion(suggestion)}
                className="rounded-full border border-amber-500/25 bg-amber-500/[.04] px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-500/[.09] dark:text-amber-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <button
          disabled={pending || confirming}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? <Sparkles size={15} className="animate-pulse" /> : <Send size={15} />}
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {confirmation && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[.05] p-3 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <CheckCircle2 size={17} className="shrink-0" /> {confirmation}
        </p>
      )}

      {reply && (
        <article aria-live="polite" className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            <Bot size={15} /> {reply.mode === "ai" ? "Assistant answer" : "Local briefing"}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{reply.answer}</p>
          {reply.notice && (
            <p className="mt-3 rounded-lg bg-amber-500/[.08] px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {reply.notice}
            </p>
          )}
          {reply.sources.length > 0 && (
            <p className="mt-3 text-xs text-black/40 dark:text-white/40">
              Based on: {reply.sources.join(" · ")}
            </p>
          )}

          {reply.proposal && (
            <section
              aria-label="Action ready to confirm"
              className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[.05] p-4"
            >
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Ready to confirm</p>
              <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
                This is a draft only. Confirming will make exactly the change below and add it to your Assistant audit trail.
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                {assistantActionDetails(reply.proposal).map(([label, value]) => (
                  <div key={label} className="flex flex-wrap gap-x-2">
                    <dt className="text-black/50 dark:text-white/50">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmProposal}
                  disabled={confirming}
                  className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  <CheckCircle2 size={15} /> {confirming ? "Confirming…" : "Confirm action"}
                </button>
                <button
                  type="button"
                  onClick={() => setReply(null)}
                  disabled={confirming}
                  className="flex items-center gap-2 rounded-lg border border-black/15 px-4 py-2 text-sm text-black/65 disabled:opacity-50 dark:border-white/15 dark:text-white/65"
                >
                  <X size={15} /> Discard draft
                </button>
              </div>
            </section>
          )}
        </article>
      )}

      <section className="space-y-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recent confirmed actions
        </h2>
        {visibleAudit.length === 0 ? (
          <p className="text-sm text-black/45 dark:text-white/45">
            Nothing confirmed yet. Drafts stay private until you choose to apply one.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleAudit.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-black/[.025] px-3 py-2 text-sm dark:bg-white/[.04]"
              >
                <p>{item.summary}</p>
                <p className="text-xs text-black/45 dark:text-white/45">{formatDay(item.day)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
