// Quick Capture v2 — plan §3: "a single omnipresent '+' that parses
// shorthand". Pure parser, no IO; the server action decides what to insert.
//
//   $14.50 lunch #food     → expense (amount, note, category)
//   spent 8 kopi           → expense
//   weight 72.4            → weight log (kg)
//   sleep 7.5 / sleep 7h30 → sleep log (hours)
//   water 500 / water 2l   → water log (ml)
//   run 5km 30min / gym    → workout log
//   todo call mum tomorrow → task with due date
//   anything else          → task due today

export type Captured =
  | { kind: "expense"; amount: number; note: string; category: string | null }
  | { kind: "weight"; kg: number }
  | { kind: "sleep"; hours: number }
  | { kind: "water"; ml: number }
  | { kind: "workout"; note: string; minutes: number | null }
  | { kind: "task"; title: string; due: "today" | "tomorrow" | null; priority: number };

const WORKOUT_WORDS = /^(gym|run|running|walk|swim|yoga|lift|workout|cycle|hike)\b/i;

function extractCategory(note: string): { note: string; category: string | null } {
  const m = note.match(/#([a-z0-9-]+)/i);
  if (!m) return { note: note.trim(), category: null };
  return {
    note: note.replace(m[0], "").replace(/\s{2,}/g, " ").trim(),
    category: m[1].toLowerCase(),
  };
}

export function parseCapture(raw: string): Captured | null {
  const text = raw.trim();
  if (!text) return null;

  const expense =
    text.match(/^\$\s?(\d+(?:\.\d{1,2})?)\s+(.+)$/) ??
    text.match(/^spent\s+\$?(\d+(?:\.\d{1,2})?)\s+(.+)$/i);
  if (expense) {
    const { note, category } = extractCategory(expense[2]);
    return { kind: "expense", amount: Number(expense[1]), note, category };
  }

  const weight =
    text.match(/^weight\s+(\d+(?:\.\d+)?)\s*(?:kg)?$/i) ??
    text.match(/^(\d+(?:\.\d+)?)\s?kg$/i);
  if (weight) return { kind: "weight", kg: Number(weight[1]) };

  const sleepHm = text.match(/^sleep\s+(\d+)h(\d+)$/i);
  if (sleepHm)
    return {
      kind: "sleep",
      hours: Number(sleepHm[1]) + Number(sleepHm[2]) / 60,
    };
  const sleep = text.match(/^sleep\s+(\d+(?:\.\d+)?)\s*h?(?:ours?)?$/i);
  if (sleep) return { kind: "sleep", hours: Number(sleep[1]) };

  const water = text.match(/^water\s+(\d+(?:\.\d+)?)\s*(ml|l)?$/i);
  if (water) {
    const n = Number(water[1]);
    const unit = water[2]?.toLowerCase();
    // Bare small numbers read as litres ("water 2"), big ones as ml.
    const ml = unit === "l" ? n * 1000 : unit === "ml" ? n : n < 10 ? n * 1000 : n;
    return { kind: "water", ml: Math.round(ml) };
  }

  if (WORKOUT_WORDS.test(text)) {
    const minutes = text.match(/(\d+)\s*min/i);
    return {
      kind: "workout",
      note: text,
      minutes: minutes ? Number(minutes[1]) : null,
    };
  }

  let title = text.replace(/^todo\s+/i, "");
  let due: "today" | "tomorrow" | null = /^todo\s/i.test(text) ? null : "today";
  const dueMatch = title.match(/\s+(today|tomorrow|tmr)$/i);
  if (dueMatch) {
    due = dueMatch[1].toLowerCase() === "today" ? "today" : "tomorrow";
    title = title.slice(0, dueMatch.index).trim();
  }
  let priority = 0;
  if (title.startsWith("!") || title.endsWith("!")) {
    priority = 1;
    title = title.replace(/^!\s*|\s*!$/g, "");
  }
  if (!title) return null;
  return { kind: "task", title, due, priority };
}
