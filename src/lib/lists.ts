import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const MEDIA_KINDS = ["book", "movie", "show", "game", "other"] as const;
export const MEDIA_STATES = ["backlog", "in_progress", "done"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaState = (typeof MEDIA_STATES)[number];
export type MediaPayload = { kind: MediaKind; state: MediaState; rating?: number; notes?: string };
export type MediaItem = MediaPayload & { itemId: string; title: string; createdAt: Date };

function normalize(row: typeof schema.items.$inferSelect): MediaItem {
  const payload = row.payload as Partial<MediaPayload>;
  return {
    itemId: row.id,
    title: row.title,
    createdAt: row.createdAt,
    kind: MEDIA_KINDS.includes(payload.kind as MediaKind) ? (payload.kind as MediaKind) : "other",
    state: MEDIA_STATES.includes(payload.state as MediaState) ? (payload.state as MediaState) : "backlog",
    rating: typeof payload.rating === "number" && payload.rating >= 1 && payload.rating <= 5 ? payload.rating : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : undefined,
  };
}

export async function getMediaLibrary(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "lists"),
        eq(schema.items.type, "media"),
        eq(schema.items.status, "active"),
      ),
    );
  const all = rows.map(normalize).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const backlog = all.filter((item) => item.state === "backlog");
  const current = all.filter((item) => item.state === "in_progress");
  const done = all.filter((item) => item.state === "done");
  return { all, backlog, current, done, nextPick: backlog.at(-1) ?? null };
}
