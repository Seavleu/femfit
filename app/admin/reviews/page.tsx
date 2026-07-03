import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ReviewModerationCard } from "@/components/features/admin/ReviewModerationCard";

export const metadata: Metadata = { title: "Review Moderation" };

/**
 * Review moderation queue — per PRD §3.5.
 * Shows pending reviews for admin to approve or reject.
 * "New reviews start in moderation queue" — enforced by RLS
 * insert policy (is_approved=false on INSERT).
 */
export default async function AdminReviewsPage() {
  const admin = createServiceRoleClient();

  const { data: pendingReviews } = await admin
    .from("reviews")
    .select(`
      id, rating, title, body, created_at, is_approved,
      profiles(full_name, phone),
      products(name, slug)
    `)
    .eq("is_approved", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const { data: recentApproved } = await admin
    .from("reviews")
    .select("id, rating, title, body, created_at, products(name)")
    .eq("is_approved", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Review Moderation</h1>

      {/* Pending queue */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Pending Review ({(pendingReviews ?? []).length})
        </h2>
        {(!pendingReviews || pendingReviews.length === 0) ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
            No reviews waiting for moderation
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReviews.map((review) => {
              const profile = review.profiles as { full_name: string | null; phone: string | null } | null;
              const product = review.products as { name: string; slug: string } | null;
              return (
                <ReviewModerationCard
                  key={review.id}
                  review={{
                    id: review.id,
                    rating: review.rating,
                    title: review.title,
                    body: review.body,
                    createdAt: review.created_at,
                    customerName: profile?.full_name ?? profile?.phone ?? "Anonymous",
                    productName: product?.name ?? "Unknown product",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Recently approved */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-gray-500">Recently Approved</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentApproved ?? []).map((r) => {
                const product = r.products as { name: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{product?.name ?? "—"}</td>
                    <td className="px-4 py-3">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.title ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}