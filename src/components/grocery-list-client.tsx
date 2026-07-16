"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toggleGroceryItem } from "@/lib/actions";
import type { GroceryItem } from "@/lib/meals";

export function GroceryListClient({
  itemId,
  initialItems,
  onItemsChange,
}: {
  itemId: string;
  initialItems: GroceryItem[];
  onItemsChange?: (items: GroceryItem[]) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(event: FormEvent<HTMLFormElement>, index: number) {
    event.preventDefault();
    if (pendingIndex !== null) return;
    const previous = items;
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item,
    );
    setMessage("");
    setPendingIndex(index);
    setItems(next);
    onItemsChange?.(next);
    try {
      await toggleGroceryItem(new FormData(event.currentTarget));
      router.refresh();
    } catch {
      setItems(previous);
      onItemsChange?.(previous);
      setMessage("Couldn’t update the grocery item. Try again.");
    } finally {
      setPendingIndex(null);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {items.map((item, index) => (
          <form
            key={`${item.name}-${index}`}
            onSubmit={(event) => toggle(event, index)}
            className="border-b border-black/5 last:border-b-0 dark:border-white/5"
          >
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="index" value={index} />
            <button
              type="submit"
              disabled={pendingIndex !== null}
              aria-label={`${item.done ? "Uncheck" : "Check"} ${item.name}`}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-black/[.03] disabled:cursor-wait disabled:opacity-70 dark:hover:bg-white/[.04]"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  item.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-black/20 dark:border-white/25"
                }`}
              >
                {item.done && <Check size={14} strokeWidth={3} />}
              </span>
              <span
                className={
                  item.done
                    ? "text-black/40 line-through dark:text-white/40"
                    : "text-sm"
                }
              >
                {item.name}
              </span>
            </button>
          </form>
        ))}
      </div>
      {message && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
    </>
  );
}
