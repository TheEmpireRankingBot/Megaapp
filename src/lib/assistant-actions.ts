import { addDays, dayKey, dayNoon, todayKey } from "@/lib/dates";
import { CATEGORIES } from "@/lib/categories";

export type AssistantActionProposal =
  | { kind: "task"; title: string; dueKey: string | null }
  | {
      kind: "expense";
      amount: number;
      note: string;
      category: (typeof CATEGORIES)[number];
      day: string;
    }
  | { kind: "calendar"; title: string; date: string; startTime: string | null }
  | { kind: "habit"; title: string };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function isDayKey(value: string) {
  return DAY_KEY.test(value) && !Number.isNaN(dayNoon(value).getTime()) && dayKey(dayNoon(value)) === value;
}

function dateFromPhrase(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "today") return todayKey();
  if (normalized === "tomorrow" || normalized === "tmr") return addDays(todayKey(), 1);
  const match = normalized.match(/^on\s+(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] && isDayKey(match[1]) ? match[1] : null;
}

function timeFromPhrase(value: string): string | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3];
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function categoryFromTag(value: string) {
  const match = value.match(/(?:^|\s)#([a-z]+)\b/i);
  const candidate = match?.[1]?.toLowerCase();
  return candidate && CATEGORIES.includes(candidate as (typeof CATEGORIES)[number])
    ? (candidate as (typeof CATEGORIES)[number])
    : "other";
}

/**
 * Converts a deliberately small, predictable command grammar into a proposal.
 * It only creates a draft; the separate confirm action owns every write.
 */
export function parseAssistantActionProposal(raw: string): AssistantActionProposal | null {
  const input = raw.trim().replace(/\s+/g, " ");
  if (!input) return null;

  const taskMatch = input.match(/^(?:add\s+)?(?:a\s+)?(?:task|todo|remind me to)\s+(.+)$/i);
  if (taskMatch) {
    let title = taskMatch[1].trim();
    let dueKey: string | null = null;
    const dateMatch = title.match(/\s+(today|tomorrow|tmr|on\s+\d{4}-\d{2}-\d{2})$/i);
    if (dateMatch) {
      dueKey = dateFromPhrase(dateMatch[1]);
      title = title.slice(0, dateMatch.index).trim();
    }
    title = cleanTitle(title);
    return title ? { kind: "task", title, dueKey } : null;
  }

  const expenseMatch = input.match(/^(?:\$|(?:log|spent|spend)\s+\$?)(\d+(?:\.\d{1,2})?)\s*(.*)$/i);
  if (expenseMatch) {
    const amount = Number(expenseMatch[1]);
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) return null;
    const detail = expenseMatch[2].trim();
    return {
      kind: "expense",
      amount,
      note: cleanTitle(detail.replace(/(?:^|\s)#[a-z]+\b/gi, " ")) || "Expense",
      category: categoryFromTag(detail),
      day: todayKey(),
    };
  }

  const eventMatch = input.match(
    /^(?:schedule|add\s+(?:an?\s+)?event|create\s+event|event)\s+(.+?)\s+(today|tomorrow|tmr|on\s+\d{4}-\d{2}-\d{2})(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?$/i,
  );
  if (eventMatch) {
    const title = cleanTitle(eventMatch[1]);
    const date = dateFromPhrase(eventMatch[2]);
    const startTime = eventMatch[3] ? timeFromPhrase(eventMatch[3]) : null;
    return title && date && (eventMatch[3] ? startTime : true)
      ? { kind: "calendar", title, date, startTime }
      : null;
  }

  const habitMatch = input.match(/^(?:start|create|add)\s+(?:a\s+)?habit\s+(.+)$/i);
  if (habitMatch) {
    const title = cleanTitle(habitMatch[1]);
    return title ? { kind: "habit", title } : null;
  }

  return null;
}

/** Revalidates untrusted client JSON before the confirm action writes. */
export function validateAssistantActionProposal(value: unknown): AssistantActionProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as Record<string, unknown>;
  const kind = proposal.kind;
  const title = typeof proposal.title === "string" ? cleanTitle(proposal.title) : "";

  if (kind === "task") {
    const dueKey = proposal.dueKey === null ? null : typeof proposal.dueKey === "string" ? proposal.dueKey : "";
    return title && (dueKey === null || isDayKey(dueKey)) ? { kind, title, dueKey } : null;
  }
  if (kind === "expense") {
    const amount = typeof proposal.amount === "number" ? proposal.amount : Number.NaN;
    const note = typeof proposal.note === "string" ? cleanTitle(proposal.note) : "";
    const category = proposal.category;
    const day = typeof proposal.day === "string" ? proposal.day : "";
    return Number.isFinite(amount) && amount >= 0.01 && amount <= 1_000_000 && note &&
      typeof category === "string" && CATEGORIES.includes(category as (typeof CATEGORIES)[number]) && isDayKey(day)
      ? { kind, amount, note, category: category as (typeof CATEGORIES)[number], day }
      : null;
  }
  if (kind === "calendar") {
    const date = typeof proposal.date === "string" ? proposal.date : "";
    const startTime = proposal.startTime === null ? null : typeof proposal.startTime === "string" ? proposal.startTime : "";
    return title && isDayKey(date) && (startTime === null || (TIME.test(startTime) && timeFromPhrase(startTime) === startTime))
      ? { kind, title, date, startTime }
      : null;
  }
  if (kind === "habit") return title ? { kind, title } : null;
  return null;
}

export function assistantActionDetails(proposal: AssistantActionProposal) {
  switch (proposal.kind) {
    case "task":
      return [
        ["Task", proposal.title],
        ["Due", proposal.dueKey ?? "No due date"],
      ];
    case "expense":
      return [
        ["Amount", `S$${proposal.amount.toFixed(2)}`],
        ["Category", proposal.category],
        ["Description", proposal.note],
      ];
    case "calendar":
      return [
        ["Event", proposal.title],
        ["When", `${proposal.date}${proposal.startTime ? ` at ${proposal.startTime}` : " (all day)"}`],
      ];
    case "habit":
      return [["Daily habit", proposal.title]];
  }
}

export function assistantActionAuditNote(proposal: AssistantActionProposal) {
  switch (proposal.kind) {
    case "task":
      return `Created task: ${proposal.title}`;
    case "expense":
      return `Logged expense: S$${proposal.amount.toFixed(2)} in ${proposal.category}`;
    case "calendar":
      return `Created calendar event: ${proposal.title}`;
    case "habit":
      return `Created daily habit: ${proposal.title}`;
  }
}
