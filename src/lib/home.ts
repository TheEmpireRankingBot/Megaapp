import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { daysBetween, todayKey } from "@/lib/dates";

export type HomeAssetPayload = {
  category: string;
  serial?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  notes?: string;
};

export type MaintenancePayload = {
  assetItemId?: string;
  dueDate: string;
  cadenceMonths?: number;
  notes?: string;
  completedCount: number;
};

export type HomeAsset = {
  itemId: string;
  title: string;
  payload: HomeAssetPayload;
  warrantyDays: number | null;
};

export type MaintenanceItem = {
  itemId: string;
  title: string;
  payload: MaintenancePayload;
  assetTitle?: string;
  daysUntil: number;
};

export async function getHomeData(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "home"),
        eq(schema.items.status, "active"),
      ),
    )
    .orderBy(asc(schema.items.createdAt));
  const today = todayKey();
  const assets = rows
    .filter((row) => row.type === "asset")
    .map((row): HomeAsset => {
      const payload = row.payload as HomeAssetPayload;
      return {
        itemId: row.id,
        title: row.title,
        payload,
        warrantyDays: payload.warrantyEnd ? daysBetween(today, payload.warrantyEnd) : null,
      };
    });
  const assetNames = new Map(assets.map((asset) => [asset.itemId, asset.title]));
  const maintenance = rows
    .filter((row) => row.type === "maintenance")
    .map((row): MaintenanceItem => {
      const payload = row.payload as MaintenancePayload;
      return {
        itemId: row.id,
        title: row.title,
        payload,
        assetTitle: payload.assetItemId ? assetNames.get(payload.assetItemId) : undefined,
        daysUntil: daysBetween(today, payload.dueDate),
      };
    })
    .sort((a, b) => a.payload.dueDate.localeCompare(b.payload.dueDate));
  return { assets, maintenance };
}
