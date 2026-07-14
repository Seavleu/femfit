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
 * Cambodian couriers typically have no API — admin marks shipped/delivered
 * manually after physical handoff. Tracking number is optional.
 */
export function OrderActions({ orderId, currentStatus, nextStatuses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [showShipForm, setShowShipForm] = useState(false);

  function handleTransition(newStatus: string) {
    if (newStatus === "shipped" && !showShipForm) {
      setShowShipForm(true);
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
        setShowShipForm(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const dangerStatuses = ["cancelled", "refunded"];

  return (
    <div className="space-y-3">
      <p className="font-mono text-2xs leading-relaxed text-muted-foreground">
        Delivery is manual in Cambodia — mark status after you hand the parcel
        to the courier or confirm the customer received it. No courier API.
      </p>

      {showShipForm && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Optional tracking / note for your records
          </p>
          <input
            type="text"
            placeholder="Tracking number (optional)"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-foreground"
          />
          <textarea
            placeholder="Courier name or note (optional)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTransition("shipped")}
              disabled={isPending}
              className="flex h-9 flex-1 items-center justify-center rounded-xl bg-foreground font-mono text-2xs uppercase tracking-[0.1em] text-background disabled:opacity-50"
            >
              {isPending ? "…" : "Confirm shipped"}
            </button>
            <button
              type="button"
              onClick={() => setShowShipForm(false)}
              className="btn-ghost h-9 px-3"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {!showShipForm &&
        nextStatuses.map((ns) => (
          <button
            key={ns.value}
            type="button"
            onClick={() => handleTransition(ns.value)}
            disabled={isPending}
            className={`flex h-10 w-full items-center justify-center rounded-xl font-mono text-2xs uppercase tracking-[0.1em] transition-opacity disabled:opacity-50 ${
              dangerStatuses.includes(ns.value)
                ? "border border-destructive/30 text-destructive hover:bg-destructive/5"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {isPending ? "Processing..." : ns.label}
          </button>
        ))}

      {!showShipForm && (
        <textarea
          placeholder="Admin note (optional)"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
