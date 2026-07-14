import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ReviewModerationCard } from "@/components/features/admin/ReviewModerationCard";

export const metadata: Metadata = { title: "Review Moderation" };

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
      <div>
        <p className="label-mono mb-2">Moderation</p>
        <h1 className="title-serif">Review Moderation</h1>
      </div>

      <div>
        <h2 className="label-mono mb-4">
          Pending Review ({(pendingReviews ?? []).length})
        </h2>
        {(!pendingReviews || pendingReviews.length === 0) ? (
          <div className="module px-5 py-12 text-center text-sm text-muted-foreground">
            No reviews waiting for moderation
          </div>
        ) : (
          <div className="space-y-3">
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

      <div>
        <h2 className="label-mono mb-4">Recently Approved</h2>
        <div className="module overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="label-mono px-4 py-3">Product</th>
                <th className="label-mono px-4 py-3">Rating</th>
                <th className="label-mono px-4 py-3">Title</th>
                <th className="label-mono px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentApproved ?? []).map((r) => {
                const product = r.products as { name: string } | null;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{product?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-rose">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.title ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
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
