// All "what day is it" logic lives here. Day boundaries follow the user's
// home timezone (plan §7: Singapore defaults). SG has no DST, so a fixed
// offset is safe; revisit if multi-timezone support ever matters.
export const TIMEZONE = "Asia/Singapore";
const TZ_OFFSET = "+08:00";

/** YYYY-MM-DD in the home timezone. */
export function dayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

export function todayKey(): string {
  return dayKey();
}

export function dayStart(key: string): Date {
  return new Date(`${key}T00:00:00${TZ_OFFSET}`);
}

export function dayEnd(key: string): Date {
  return new Date(`${key}T23:59:59.999${TZ_OFFSET}`);
}

/** Noon in the home timezone — used for date-only stamps like due dates. */
export function dayNoon(key: string): Date {
  return new Date(`${key}T12:00:00${TZ_OFFSET}`);
}

export function addDays(key: string, n: number): string {
  const d = dayStart(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

/** Next due day for a recurring task, anchored to the previous due day. */
export function nextDueKey(
  fromKey: string,
  recurrence: "daily" | "weekly" | "monthly",
): string {
  if (recurrence === "daily") return addDays(fromKey, 1);
  if (recurrence === "weekly") return addDays(fromKey, 7);
  const d = dayNoon(fromKey);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return dayKey(d);
}

/** Signed whole days from a to b (positive = b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000,
  );
}

export function nextRenewalKey(
  fromKey: string,
  cadence: "monthly" | "yearly",
): string {
  if (cadence === "monthly") return nextDueKey(fromKey, "monthly");
  const d = dayNoon(fromKey);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return dayKey(d);
}

export function formatDay(key: string): string {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return dayNoon(key).toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** The last n day keys, oldest first, ending today. */
export function lastNDays(n: number): string[] {
  const today = todayKey();
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function isSunday(key: string = todayKey()): boolean {
  return dayNoon(key).getUTCDay() === 0;
}

/** Current hour (0-23) in Singapore, used by scheduled notification windows. */
export function singaporeHour(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-SG", {
      timeZone: TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(d),
  );
}
