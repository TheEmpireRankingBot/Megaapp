import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type VaultCipherPayload = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type VaultItem = {
  itemId: string;
  createdAt: string;
  payload: VaultCipherPayload;
};

export async function getVaultItems(userId: string): Promise<VaultItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "vault"),
        eq(schema.items.type, "secret"),
        eq(schema.items.status, "active"),
      ),
    )
    .orderBy(desc(schema.items.createdAt));
  return rows.map((row) => ({
    itemId: row.id,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload as VaultCipherPayload,
  }));
}
