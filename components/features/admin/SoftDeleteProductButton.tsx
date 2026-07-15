"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeleteProduct } from "@/lib/admin/catalog";

export function SoftDeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Soft-delete this product? It will disappear from the shop.")) {
      return;
    }
    startTransition(async () => {
      const result = await softDeleteProduct(productId);
      if (result.ok) {
        router.push("/admin/products");
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-xl border border-destructive/30 px-4 py-2 font-mono text-2xs uppercase tracking-[0.1em] text-destructive hover:bg-destructive/5 disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete product"}
    </button>
  );
}
