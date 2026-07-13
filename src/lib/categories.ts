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

export type MoneyCategory = (typeof CATEGORIES)[number];
