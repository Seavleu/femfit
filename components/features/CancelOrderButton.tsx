"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/orders/actions";

interface Props {
  orderId: string;
  status: string;
}

export function CancelOrderButton({ orderId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!["pending_payment", "confirmed"].includes(status)) return null;

  function handleCancel() {
    if (
      !confirm(
        "Cancel this order? Stock will be returned and you cannot undo this."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="flex h-10 w-full items-center justify-center rounded-xl border border-destructive/30 font-mono text-2xs uppercase tracking-[0.1em] text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
      >
        {isPending ? "Cancelling…" : "Cancel order"}
      </button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
