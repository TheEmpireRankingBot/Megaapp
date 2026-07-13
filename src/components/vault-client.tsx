"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, LockKeyhole, Trash2 } from "lucide-react";
import { createVaultItem, deleteItem } from "@/lib/actions";
import type { VaultItem } from "@/lib/vault";

type Secret = { title: string; kind: string; content: string };
type UnlockedItem = VaultItem & { secret: Secret };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSecret(secret: Secret, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, 250_000);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(secret)));
  return { salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

async function decryptItem(item: VaultItem, passphrase: string): Promise<UnlockedItem> {
  const salt = fromBase64(item.payload.salt);
  const iv = fromBase64(item.payload.iv);
  const key = await deriveKey(passphrase, salt, item.payload.iterations);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    fromBase64(item.payload.ciphertext) as BufferSource,
  );
  return { ...item, secret: JSON.parse(decoder.decode(decrypted)) as Secret };
}

export function VaultClient({ items }: { items: VaultItem[] }) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<UnlockedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const kind = String(data.get("kind") ?? "reference");
    const content = String(data.get("content") ?? "").trim();
    const passphrase = String(data.get("passphrase") ?? "");
    if (!title || !content || passphrase.length < 8) {
      setMessage("Use a passphrase of at least 8 characters and fill every field.");
      return;
    }
    setBusy(true);
    try {
      const encrypted = await encryptSecret({ title, kind, content }, passphrase);
      const cipher = new FormData();
      cipher.set("salt", encrypted.salt);
      cipher.set("iv", encrypted.iv);
      cipher.set("ciphertext", encrypted.ciphertext);
      await createVaultItem(cipher);
      form.reset();
      setMessage("Saved encrypted. Your passphrase was not stored.");
      setUnlocked(null);
      router.refresh();
    } catch {
      setMessage("Encryption failed in this browser. Try again on a current browser.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passphrase = String(new FormData(event.currentTarget).get("unlockPassphrase") ?? "");
    setBusy(true);
    try {
      const decrypted = await Promise.all(items.map((item) => decryptItem(item, passphrase)));
      setUnlocked(decrypted);
      setMessage(`Unlocked ${decrypted.length} item${decrypted.length === 1 ? "" : "s"} on this device.`);
    } catch {
      setUnlocked(null);
      setMessage("Could not unlock. Check the passphrase—all items must use the same one.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-8">
    <form onSubmit={save} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Encrypt a new item</h2>
      <div className="flex flex-wrap gap-2"><input name="title" required placeholder="Private title" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" /><select name="kind" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black"><option value="document">Document</option><option value="account">Account</option><option value="reference">Reference</option><option value="recovery">Recovery info</option></select></div>
      <textarea name="content" required rows={4} placeholder="Important numbers, recovery details, or reference notes" className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
      <div className="flex flex-wrap gap-2"><div className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 dark:border-white/15"><KeyRound size={15} className="text-black/40 dark:text-white/40" /><input name="passphrase" type="password" minLength={8} required autoComplete="new-password" placeholder="Vault passphrase" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></div><button disabled={busy} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">{busy ? "Encrypting…" : "Encrypt & save"}</button></div>
    </form>

    {items.length > 0 && <form onSubmit={unlock} className="flex flex-wrap gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10"><div className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-black/15 px-3 dark:border-white/15"><LockKeyhole size={15} className="text-black/40 dark:text-white/40" /><input name="unlockPassphrase" type="password" required autoComplete="current-password" placeholder="Enter passphrase to unlock" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></div><button disabled={busy} className="flex items-center gap-2 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"><Eye size={15} /> Unlock {items.length}</button></form>}

    {message && <p role="status" className="rounded-lg bg-black/[.035] px-3 py-2 text-sm text-black/60 dark:bg-white/[.06] dark:text-white/60">{message}</p>}

    {items.length === 0 ? <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15"><LockKeyhole className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-3 text-sm text-black/50 dark:text-white/50">The vault is empty. Add a private reference and keep the passphrase somewhere safe.</p></div> : unlocked ? <div className="grid gap-3 sm:grid-cols-2">{unlocked.map((item) => <article key={item.itemId} className="rounded-xl border border-black/10 p-4 dark:border-white/10"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{item.secret.kind}</span><h2 className="mt-2 font-semibold">{item.secret.title}</h2></div><form action={deleteItem}><input type="hidden" name="itemId" value={item.itemId} /><button aria-label={`Delete ${item.secret.title}`} className="p-1 text-black/30 hover:text-red-500 dark:text-white/30"><Trash2 size={14} /></button></form></div><pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-black/[.035] p-3 font-mono text-xs dark:bg-white/[.05]">{item.secret.content}</pre></article>)}</div> : <div className="rounded-xl border border-black/10 p-6 text-center dark:border-white/10"><EyeOff className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-2 text-sm text-black/50 dark:text-white/50">{items.length} encrypted item{items.length === 1 ? "" : "s"}. Titles and contents stay hidden until you unlock them.</p></div>}
  </div>;
}
