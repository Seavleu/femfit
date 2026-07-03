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
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${isPending ? "opacity-50" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{review.productName}</p>
          <p className="text-xs text-gray-500">by {review.customerName} · {new Date(review.createdAt).toLocaleDateString()}</p>
        </div>
        <span className="text-sm">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
      </div>

      {review.title && <p className="mb-1 text-sm font-medium">{review.title}</p>}
      {review.body && <p className="mb-3 text-sm text-gray-600">{review.body}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => handle("approve")} disabled={isPending}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
          Approve
        </button>
        <button type="button" onClick={() => handle("reject")} disabled={isPending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          Reject
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}