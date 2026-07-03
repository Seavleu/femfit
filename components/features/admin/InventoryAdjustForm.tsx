"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustInventory } from "@/lib/admin/actions";

interface Props {
  variantId: string;
  sku: string;
  currentStock: number;
}

export function InventoryAdjustForm({ variantId, sku, currentStock }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const changeQty = parseInt(qty, 10);
    if (isNaN(changeQty) || changeQty === 0) {
      setError("Enter a non-zero number");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required for audit trail");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adjustInventory({ variantId, changeQty, reason: reason.trim() });
      if (result.ok) {
        setOpen(false);
        setQty("");
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
        Adjust
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
        placeholder="+5 or -3" className="h-7 w-16 rounded border border-gray-300 px-2 text-xs outline-none" />
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason..." className="h-7 w-32 rounded border border-gray-300 px-2 text-xs outline-none" />
      <button type="button" onClick={submit} disabled={isPending}
        className="h-7 rounded bg-gray-900 px-2 text-xs text-white hover:opacity-90 disabled:opacity-50">
        {isPending ? "..." : "Save"}
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(null); }}
        className="h-7 px-1 text-xs text-gray-400 hover:text-gray-600">✕</button>
      {error && <span className="text-2xs text-red-600">{error}</span>}
    </div>
  );
}