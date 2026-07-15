"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createVariant, updateVariant } from "@/lib/admin/catalog";
import { centsToDisplay, parseMoneyToCents } from "@/lib/admin/catalog-utils";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-foreground/20";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

interface VariantRow {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  priceCents: number | null;
  stockQuantity: number;
  isActive: boolean;
}

export function VariantManager({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState("M");
  const [color, setColor] = useState("");
  const [stock, setStock] = useState("10");
  const [price, setPrice] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const stockQuantity = Number.parseInt(stock, 10);
    if (Number.isNaN(stockQuantity) || stockQuantity < 0) {
      setError("Stock must be a non-negative integer.");
      return;
    }
    if (!size && !color.trim()) {
      setError("Provide at least a size or color.");
      return;
    }
    const priceCents = price.trim() ? parseMoneyToCents(price) : null;
    if (price.trim() && priceCents === null) {
      setError("Invalid variant price.");
      return;
    }

    startTransition(async () => {
      const result = await createVariant({
        productId,
        size: size || null,
        color: color.trim() || null,
        stockQuantity,
        priceCents,
        isActive: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setColor("");
      setStock("10");
      setPrice("");
      router.refresh();
    });
  }

  function handleStockBlur(variant: VariantRow, raw: string) {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next) || next < 0 || next === variant.stockQuantity) return;
    setError(null);
    startTransition(async () => {
      const result = await updateVariant({
        variantId: variant.id,
        stockQuantity: next,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function toggleActive(variant: VariantRow) {
    startTransition(async () => {
      const result = await updateVariant({
        variantId: variant.id,
        isActive: !variant.isActive,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="module overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="label-mono px-4 py-3">SKU</th>
              <th className="label-mono px-4 py-3">Size</th>
              <th className="label-mono px-4 py-3">Color</th>
              <th className="label-mono px-4 py-3 text-right">Price</th>
              <th className="label-mono px-4 py-3 text-right">Stock</th>
              <th className="label-mono px-4 py-3 text-center">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No variants yet — add size/color below.
                </td>
              </tr>
            ) : (
              variants.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-mono text-2xs">{v.sku}</td>
                  <td className="px-4 py-3">{v.size ?? "—"}</td>
                  <td className="px-4 py-3">{v.color ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-2xs text-muted-foreground">
                    {v.priceCents != null
                      ? `$${centsToDisplay(v.priceCents)}`
                      : "base"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      defaultValue={v.stockQuantity}
                      disabled={isPending}
                      onBlur={(e) => handleStockBlur(v, e.target.value)}
                      className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-right font-mono text-sm outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActive(v)}
                      disabled={isPending}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        v.isActive ? "bg-foreground" : "bg-muted"
                      }`}
                      aria-label={v.isActive ? "Deactivate" : "Activate"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${
                          v.isActive ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="module space-y-4 p-6">
        <p className="label-mono">Add variant</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="label-mono">Size</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="label-mono">Color</span>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={inputClass}
              placeholder="Black"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="label-mono">Stock</span>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="label-mono">Price override</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
              placeholder="optional"
              inputMode="decimal"
            />
          </label>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={isPending} className="btn-solid">
          {isPending ? "Adding…" : "Add variant"}
        </button>
      </form>
    </div>
  );
}
