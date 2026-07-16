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

/** A wall-clock time on a Singapore calendar day. Callers validate HH:MM. */
export function zonedDateTime(key: string, time: string): Date {
  return new Date(`${key}T${time}:00${TZ_OFFSET}`);
}

export function addDays(key: string, n: number): string {
  const d = dayStart(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

/** Add calendar months while keeping end-of-month dates in the target month. */
export function addMonthsClamped(key: string, months: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const maxDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear.toString().padStart(4, "0")}-${targetMonth
    .toString()
    .padStart(2, "0")}-${Math.min(day, maxDay).toString().padStart(2, "0")}`;
}

/** Next due day for a recurring task, anchored to the previous due day. */
export function nextDueKey(
  fromKey: string,
  recurrence: "daily" | "weekly" | "monthly",
): string {
  if (recurrence === "daily") return addDays(fromKey, 1);
  if (recurrence === "weekly") return addDays(fromKey, 7);
  return addMonthsClamped(fromKey, 1);
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

/** Next occurrence of a month/day (birthdays, anniversaries), including today. */
export function nextAnnualKey(sourceKey: string, fromKey: string = todayKey()): string {
  const [, sourceMonth, sourceDay] = sourceKey.split("-").map(Number);
  const [fromYear] = fromKey.split("-").map(Number);
  if (!sourceMonth || !sourceDay || !fromYear) return fromKey;
  const occurrence = (year: number) => {
    const maxDay = new Date(Date.UTC(year, sourceMonth, 0)).getUTCDate();
    return `${year.toString().padStart(4, "0")}-${sourceMonth
      .toString()
      .padStart(2, "0")}-${Math.min(sourceDay, maxDay).toString().padStart(2, "0")}`;
  };
  const thisYear = occurrence(fromYear);
  return thisYear >= fromKey ? thisYear : occurrence(fromYear + 1);
}

/** Compact date label for charts, e.g. "13 Jul". */
export function formatCompactDay(key: string): string {
  return dayNoon(key).toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
  });
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Stable 24-hour wall-clock key in Singapore, e.g. "15:30". */
export function timeKey(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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
