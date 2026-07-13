import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getVaultItems } from "@/lib/vault";
import { VaultClient } from "@/components/vault-client";

export const metadata = { title: "Vault" };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const user = await getCurrentUser();
  const items = await getVaultItems(user.id);
  return <div className="space-y-8">
    <header><h1 className="text-2xl font-bold tracking-tight">Vault</h1><p className="mt-1 text-sm text-black/50 dark:text-white/50">Private references encrypted in your browser before storage.</p></header>
    <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[.04] p-4 text-sm"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" size={18} /><p><span className="font-medium">Zero-knowledge storage.</span> Megaapp stores only AES-GCM ciphertext. Your passphrase never leaves this browser and cannot be recovered, so use the same strong passphrase for every item and keep it safe.</p></div>
    <VaultClient items={items} />
  </div>;
}
