import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey } from "@/lib/dates";
import { IMPORT_KINDS, type ImportKind } from "@/lib/imports";

export type ImportHistoryItem = {
  id: string;
  day: string;
  kind: ImportKind;
  imported: number;
  skipped: number;
  note: string;
};

export async function getImportHistory(userId: string): Promise<ImportHistoryItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, userId),
        eq(schema.entries.module, "imports"),
        eq(schema.entries.type, "batch_applied"),
      ),
    )
    .orderBy(desc(schema.entries.occurredAt))
    .limit(8);

  return rows.flatMap((row) => {
    const payload = row.payload as {
      kind?: unknown;
      imported?: unknown;
      skipped?: unknown;
    };
    if (
      typeof payload.kind !== "string" ||
      !IMPORT_KINDS.includes(payload.kind as ImportKind) ||
      typeof payload.imported !== "number" ||
      typeof payload.skipped !== "number" ||
      !row.note
    )
      return [];
    return [
      {
        id: row.id,
        day: dayKey(row.occurredAt),
        kind: payload.kind as ImportKind,
        imported: payload.imported,
        skipped: payload.skipped,
        note: row.note,
      },
    ];
  });
}
