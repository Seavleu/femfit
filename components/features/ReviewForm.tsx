"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "@/lib/reviews/actions";

interface Props {
  productId: string;
  orders: Array<{ orderId: string; orderNumber: string }>;
}

export function ReviewForm({ productId, orders }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [orderId, setOrderId] = useState(orders[0]?.orderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (orders.length === 0) return null;

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-5">
        <p className="font-medium">Thanks for your review</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It will appear on this page after moderation.
        </p>
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitReview({
        productId,
        orderId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 border-t border-border pt-8">
      <p className="label-mono">Write a review</p>
      <p className="text-sm text-muted-foreground">
        You purchased this item — share how it fits and feels.
      </p>

      {orders.length > 1 && (
        <label className="block space-y-1.5">
          <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
            Order
          </span>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {orders.map((o) => (
              <option key={o.orderId} value={o.orderId}>
                {o.orderNumber}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`h-9 w-9 rounded-lg font-mono text-sm transition-colors ${
              n <= rating
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:border-foreground"
            }`}
            aria-pressed={n <= rating}
          >
            {n}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
      />
      <textarea
        placeholder="What did you like? How was the fit?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending || !orderId} className="btn-solid">
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
