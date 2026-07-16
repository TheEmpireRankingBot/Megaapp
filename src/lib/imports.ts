import { CATEGORIES, type MoneyCategory } from "@/lib/categories";
import { dayKey, dayNoon } from "@/lib/dates";

export const MAX_IMPORT_ROWS = 250;
export const MAX_CSV_BYTES = 512_000;

export const IMPORT_KINDS = ["tasks", "expenses", "habits", "calendar"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export type TaskImportRecord = {
  kind: "tasks";
  title: string;
  due: string | null;
  priority: 0 | 1;
};

export type ExpenseImportRecord = {
  kind: "expenses";
  day: string;
  amount: number;
  note: string;
  category: MoneyCategory;
};

export type HabitImportRecord = {
  kind: "habits";
  title: string;
};

export type CalendarImportRecord = {
  kind: "calendar";
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  notes: string;
};

export type ImportRecord =
  | TaskImportRecord
  | ExpenseImportRecord
  | HabitImportRecord
  | CalendarImportRecord;

export type ImportIssue = { row: number; message: string };
export type ImportPreview = {
  records: ImportRecord[];
  issues: ImportIssue[];
  totalRows: number;
};

export const IMPORT_CONFIG: Record<
  ImportKind,
  {
    label: string;
    singular: string;
    description: string;
    columns: string;
    template: string;
  }
> = {
  tasks: {
    label: "Tasks",
    singular: "task",
    description: "Bring over open tasks with an optional due date and priority.",
    columns: "title (required), due (YYYY-MM-DD), priority (normal or high)",
    template: "title,due,priority\r\n",
  },
  expenses: {
    label: "Expenses",
    singular: "expense",
    description: "Import historical spending into Money and Insights.",
    columns: `date, amount, description, category (${CATEGORIES.join(", ")})`,
    template: "date,amount,description,category\r\n",
  },
  habits: {
    label: "Habits",
    singular: "habit",
    description: "Create daily habit definitions; check-in history is not inferred.",
    columns: "title (required)",
    template: "title\r\n",
  },
  calendar: {
    label: "Calendar events",
    singular: "calendar event",
    description: "Import local events. Timed events use Singapore wall-clock time.",
    columns: "title, date, start_time, end_time, all_day, location, notes",
    template: "title,date,start_time,end_time,all_day,location,notes\r\n",
  },
};

type CsvRow = { row: number; cells: string[] };

function parseCsvRows(input: string): { rows: CsvRow[]; issue?: ImportIssue } {
  const text = input.replace(/^\uFEFF/, "");
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;

  const finishCell = () => {
    cells.push(cell.trim());
    cell = "";
  };
  const finishRow = () => {
    finishCell();
    if (cells.some((value) => value.length > 0)) rows.push({ row: rowStart, cells });
    cells = [];
    rowStart = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
        if (char === "\n") line += 1;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      finishCell();
    } else if (char === "\n") {
      finishRow();
      line += 1;
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) return { rows, issue: { row: rowStart, message: "Unclosed quoted field." } };
  if (cell.length > 0 || cells.length > 0) finishRow();
  return { rows };
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function cleanText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(dayNoon(value)) === value;
}

function validTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return null;
}

function field(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) return value;
  }
  return "";
}

function requiredHeaders(kind: ImportKind, headers: Set<string>) {
  const groups: Record<ImportKind, string[][]> = {
    tasks: [["title", "name", "task"]],
    expenses: [
      ["date", "day"],
      ["amount", "value"],
      ["description", "note", "name"],
    ],
    habits: [["title", "name", "habit"]],
    calendar: [
      ["title", "name", "event"],
      ["date", "day"],
    ],
  };
  return groups[kind]
    .filter((aliases) => !aliases.some((alias) => headers.has(alias)))
    .map((aliases) => aliases[0]);
}

function parseTask(row: Record<string, string>, rowNumber: number) {
  const issues: ImportIssue[] = [];
  const title = cleanText(field(row, ["title", "name", "task"]), 200);
  const dueRaw = field(row, ["due", "due_date", "date"]).trim();
  const priorityRaw = field(row, ["priority"]).trim().toLowerCase();
  if (!title) issues.push({ row: rowNumber, message: "Task title is required." });
  if (dueRaw && !validDay(dueRaw))
    issues.push({ row: rowNumber, message: "Due date must be a real YYYY-MM-DD date." });
  let priority: 0 | 1 = 0;
  if (["high", "1", "true", "yes"].includes(priorityRaw)) priority = 1;
  else if (priorityRaw && !["normal", "0", "false", "no"].includes(priorityRaw))
    issues.push({ row: rowNumber, message: "Priority must be normal or high." });
  return {
    record: issues.length ? null : ({ kind: "tasks", title, due: dueRaw || null, priority } as TaskImportRecord),
    issues,
  };
}

function parseExpense(row: Record<string, string>, rowNumber: number) {
  const issues: ImportIssue[] = [];
  const day = field(row, ["date", "day"]).trim();
  const amount = Number(field(row, ["amount", "value"]));
  const note = cleanText(field(row, ["description", "note", "name"]), 500);
  const categoryRaw = field(row, ["category"]).trim().toLowerCase() || "other";
  if (!validDay(day)) issues.push({ row: rowNumber, message: "Date must be a real YYYY-MM-DD date." });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000)
    issues.push({ row: rowNumber, message: "Amount must be greater than 0 and no more than 1,000,000." });
  if (!note) issues.push({ row: rowNumber, message: "Expense description is required." });
  if (!CATEGORIES.includes(categoryRaw as MoneyCategory))
    issues.push({ row: rowNumber, message: `Category must be one of: ${CATEGORIES.join(", ")}.` });
  return {
    record: issues.length
      ? null
      : ({ kind: "expenses", day, amount, note, category: categoryRaw as MoneyCategory } as ExpenseImportRecord),
    issues,
  };
}

function parseHabit(row: Record<string, string>, rowNumber: number) {
  const title = cleanText(field(row, ["title", "name", "habit"]), 200);
  return title
    ? { record: { kind: "habits", title } as HabitImportRecord, issues: [] }
    : { record: null, issues: [{ row: rowNumber, message: "Habit title is required." }] };
}

function parseCalendar(row: Record<string, string>, rowNumber: number) {
  const issues: ImportIssue[] = [];
  const title = cleanText(field(row, ["title", "name", "event"]), 200);
  const date = field(row, ["date", "day"]).trim();
  const startRaw = field(row, ["start_time", "start"]).trim();
  const endRaw = field(row, ["end_time", "end"]).trim();
  const allDayRaw = field(row, ["all_day", "allday"]);
  const parsedAllDay = parseBoolean(allDayRaw);
  const allDay = parsedAllDay ?? !startRaw;
  if (!title) issues.push({ row: rowNumber, message: "Event title is required." });
  if (!validDay(date)) issues.push({ row: rowNumber, message: "Date must be a real YYYY-MM-DD date." });
  if (allDayRaw.trim() && parsedAllDay === null)
    issues.push({ row: rowNumber, message: "all_day must be true/false, yes/no, or 1/0." });
  if (!allDay && !validTime(startRaw))
    issues.push({ row: rowNumber, message: "Timed events need start_time in HH:MM format." });
  if (endRaw && !validTime(endRaw))
    issues.push({ row: rowNumber, message: "end_time must use HH:MM format." });
  if (!allDay && endRaw && validTime(startRaw) && validTime(endRaw) && endRaw <= startRaw)
    issues.push({ row: rowNumber, message: "end_time must be later than start_time." });
  return {
    record: issues.length
      ? null
      : ({
          kind: "calendar",
          title,
          date,
          startTime: allDay ? null : startRaw,
          endTime: allDay || !endRaw ? null : endRaw,
          allDay,
          location: cleanText(field(row, ["location", "place"]), 200),
          notes: cleanText(field(row, ["notes", "description"]), 2_000),
        } as CalendarImportRecord),
    issues,
  };
}

export function importRecordFingerprint(record: ImportRecord) {
  switch (record.kind) {
    case "tasks":
      return `${record.title.toLowerCase()}|${record.due ?? ""}`;
    case "expenses":
      return `${record.day}|${record.amount.toFixed(2)}|${record.category}|${record.note.toLowerCase()}`;
    case "habits":
      return record.title.toLowerCase();
    case "calendar":
      return `${record.title.toLowerCase()}|${record.date}|${record.startTime ?? "all-day"}`;
  }
}

export function parseImportCsv(kind: ImportKind, input: string): ImportPreview {
  const parsed = parseCsvRows(input);
  if (parsed.issue) return { records: [], issues: [parsed.issue], totalRows: 0 };
  if (parsed.rows.length === 0)
    return { records: [], issues: [{ row: 1, message: "Add a header row and at least one data row." }], totalRows: 0 };

  const headerRow = parsed.rows[0];
  const headers = headerRow.cells.map(normalizeHeader);
  const missing = requiredHeaders(kind, new Set(headers));
  if (missing.length)
    return {
      records: [],
      issues: [{ row: headerRow.row, message: `Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` }],
      totalRows: Math.max(0, parsed.rows.length - 1),
    };

  const dataRows = parsed.rows.slice(1);
  const records: ImportRecord[] = [];
  const issues: ImportIssue[] = [];
  const fingerprints = new Set<string>();
  if (dataRows.length > MAX_IMPORT_ROWS)
    issues.push({ row: MAX_IMPORT_ROWS + 2, message: `Only the first ${MAX_IMPORT_ROWS} data rows can be imported at once.` });

  for (const csvRow of dataRows.slice(0, MAX_IMPORT_ROWS)) {
    const row = Object.fromEntries(headers.map((header, index) => [header, csvRow.cells[index] ?? ""]));
    const parsedRow =
      kind === "tasks"
        ? parseTask(row, csvRow.row)
        : kind === "expenses"
          ? parseExpense(row, csvRow.row)
          : kind === "habits"
            ? parseHabit(row, csvRow.row)
            : parseCalendar(row, csvRow.row);
    issues.push(...parsedRow.issues);
    if (parsedRow.record) {
      const fingerprint = importRecordFingerprint(parsedRow.record);
      if (fingerprints.has(fingerprint)) {
        issues.push({ row: csvRow.row, message: "Duplicate row in this file." });
      } else {
        fingerprints.add(fingerprint);
        records.push(parsedRow.record);
      }
    }
  }
  return { records, issues, totalRows: dataRows.length };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateImportBatch(kind: ImportKind, value: unknown): ImportRecord[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMPORT_ROWS) return null;
  const records: ImportRecord[] = [];
  const fingerprints = new Set<string>();
  for (const candidate of value) {
    if (!isObject(candidate) || candidate.kind !== kind) return null;
    let record: ImportRecord | null = null;
    if (kind === "tasks") {
      const title = typeof candidate.title === "string" ? cleanText(candidate.title, 200) : "";
      const due = candidate.due === null ? null : typeof candidate.due === "string" ? candidate.due : "";
      if (title && (due === null || validDay(due)) && (candidate.priority === 0 || candidate.priority === 1))
        record = { kind, title, due, priority: candidate.priority };
    } else if (kind === "expenses") {
      const day = typeof candidate.day === "string" ? candidate.day : "";
      const amount = typeof candidate.amount === "number" ? candidate.amount : Number.NaN;
      const note = typeof candidate.note === "string" ? cleanText(candidate.note, 500) : "";
      const category = candidate.category;
      if (
        validDay(day) &&
        Number.isFinite(amount) &&
        amount > 0 &&
        amount <= 1_000_000 &&
        note &&
        typeof category === "string" &&
        CATEGORIES.includes(category as MoneyCategory)
      )
        record = { kind, day, amount, note, category: category as MoneyCategory };
    } else if (kind === "habits") {
      const title = typeof candidate.title === "string" ? cleanText(candidate.title, 200) : "";
      if (title) record = { kind, title };
    } else {
      const title = typeof candidate.title === "string" ? cleanText(candidate.title, 200) : "";
      const date = typeof candidate.date === "string" ? candidate.date : "";
      const allDay = candidate.allDay === true;
      const startTime = candidate.startTime === null ? null : typeof candidate.startTime === "string" ? candidate.startTime : "";
      const endTime = candidate.endTime === null ? null : typeof candidate.endTime === "string" ? candidate.endTime : "";
      const location = typeof candidate.location === "string" ? cleanText(candidate.location, 200) : "";
      const notes = typeof candidate.notes === "string" ? cleanText(candidate.notes, 2_000) : "";
      if (
        title &&
        validDay(date) &&
        ((allDay && startTime === null && endTime === null) ||
          (!allDay && typeof startTime === "string" && validTime(startTime) && (endTime === null || (validTime(endTime) && endTime > startTime))))
      )
        record = { kind, title, date, startTime, endTime, allDay, location, notes };
    }
    if (!record) return null;
    const fingerprint = importRecordFingerprint(record);
    if (fingerprints.has(fingerprint)) return null;
    fingerprints.add(fingerprint);
    records.push(record);
  }
  return records;
}

export function importRecordSummary(record: ImportRecord) {
  switch (record.kind) {
    case "tasks":
      return { title: record.title, detail: `${record.due ?? "No due date"} · ${record.priority ? "High priority" : "Normal"}` };
    case "expenses":
      return { title: record.note, detail: `${record.day} · S$${record.amount.toFixed(2)} · ${record.category}` };
    case "habits":
      return { title: record.title, detail: "Daily habit" };
    case "calendar":
      return { title: record.title, detail: `${record.date} · ${record.allDay ? "All day" : record.startTime}` };
  }
}
