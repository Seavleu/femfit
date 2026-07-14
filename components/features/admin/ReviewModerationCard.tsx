"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateReview } from "@/lib/admin/actions";

interface Props {
  review: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: string;
    customerName: string;
    productName: string;
  };
}

export function ReviewModerationCard({ review }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await moderateReview({ reviewId: review.id, action });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={`module p-5 ${isPending ? "opacity-50" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{review.productName}</p>
          <p className="label-mono mt-1 normal-case tracking-normal">
            by {review.customerName} · {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="text-sm text-rose">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
      </div>

      {review.title && <p className="mb-1 text-sm font-medium">{review.title}</p>}
      {review.body && <p className="mb-3 text-sm text-muted-foreground">{review.body}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handle("approve")}
          disabled={isPending}
          className="rounded-xl bg-foreground px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-background hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handle("reject")}
          disabled={isPending}
          className="rounded-xl border border-destructive/30 px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
