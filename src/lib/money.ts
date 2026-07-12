import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayStart, todayKey } from "@/lib/dates";

export const CATEGORIES = [
  "food",
  "groceries",
  "transport",
  "shopping",
  "bills",
  "fun",
  "health",
  "other",
] as const;

export type ExpenseView = {
  entryId: string;
  day: string;
  note: string;
  amount: number;
  category: string;
};

export type MoneySummary = {
  monthLabel: string;
  total: number;
  budget: number | null;
  byCategory: { category: string; amount: number }[];
  recent: ExpenseView[];
};

function monthRange(today: string): { start: Date; end: Date; label: string } {
  const [y, m] = today.split("-").map(Number);
  const startKey = `${today.slice(0, 7)}-01`;
  const nextKey =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return {
    start: dayStart(startKey),
    end: dayStart(nextKey),
    label: new Date(`${startKey}T12:00:00Z`).toLocaleDateString("en-SG", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function formatSGD(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount);
}

export async function getMoneySummary(
  userId: string,
  budget: number | null,
): Promise<MoneySummary> {
  const db = await getDb();
  const { start, end, label } = monthRange(todayKey());

  const rows = await db
    .select({
      entryId: schema.entries.id,
      occurredAt: schema.entries.occurredAt,
      note: schema.entries.note,
      amount: schema.transactions.amount,
      category: schema.transactions.category,
    })
    .from(schema.transactions)
    .innerJoin(schema.entries, eq(schema.transactions.entryId, schema.entries.id))
    .where(
      and(
        eq(schema.entries.userId, userId),
        gte(schema.entries.occurredAt, start),
        lt(schema.entries.occurredAt, end),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt));

  const expenses: ExpenseView[] = rows.map((r) => ({
    entryId: r.entryId,
    day: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(
      r.occurredAt,
    ),
    note: r.note ?? "",
    amount: Number(r.amount),
    category: r.category ?? "other",
  }));

  const byCat = new Map<string, number>();
  let total = 0;
  for (const e of expenses) {
    total += e.amount;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }

  return {
    monthLabel: label,
    total,
    budget,
    byCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    recent: expenses.slice(0, 30),
  };
}
