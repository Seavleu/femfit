"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionOrderStatus } from "@/lib/admin/actions";

interface Props {
  orderId: string;
  currentStatus: string;
  nextStatuses: { value: string; label: string }[];
}

/**
 * Order status transition buttons — per Sys Design §8.4 state machine.
 * Only valid transitions are shown (computed server-side in the detail page).
 */
export function OrderActions({ orderId, currentStatus, nextStatuses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [showTracking, setShowTracking] = useState(false);

  function handleTransition(newStatus: string) {
    if (newStatus === "shipped" && !showTracking) {
      setShowTracking(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await transitionOrderStatus({
        orderId,
        newStatus,
        trackingNumber: trackingNumber || undefined,
        adminNote: adminNote || undefined,
      });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const dangerStatuses = ["cancelled", "refunded"];

  return (
    <div className="space-y-3">
      {showTracking && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
          />
          <textarea
            placeholder="Note (optional)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 resize-none"
          />
        </div>
      )}

      {nextStatuses.map((ns) => (
        <button
          key={ns.value}
          type="button"
          onClick={() => handleTransition(ns.value)}
          disabled={isPending}
          className={`flex h-9 w-full items-center justify-center rounded-md text-sm font-medium transition-opacity disabled:opacity-50 ${
            dangerStatuses.includes(ns.value)
              ? "border border-red-300 text-red-600 hover:bg-red-50"
              : "bg-gray-900 text-white hover:opacity-90"
          }`}
        >
          {isPending ? "Processing..." : ns.label}
        </button>
      ))}

      {!showTracking && currentStatus !== "shipped" && (
        <textarea
          placeholder="Admin note (optional)"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 resize-none"
        />
      )}

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}