"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart/actions";

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  priceCents: number | null;
  stockQuantity: number;
}

interface VariantSelectorProps {
  productId: string;
  productName: string;
  variants: Variant[];
  basePriceCents: number;
  currency: string;
}

export function VariantSelector({
  productName,
  variants,
}: VariantSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[],
    [variants]
  );
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants]
  );

  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizes.length === 1 ? sizes[0] : null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors.length === 1 ? colors[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const selectedVariant = useMemo(() => {
    return variants.find(
      (v) =>
        (sizes.length === 0 || v.size === selectedSize) &&
        (colors.length === 0 || v.color === selectedColor)
    );
  }, [variants, sizes.length, colors.length, selectedSize, selectedColor]);

  function sizeIsAvailable(size: string): boolean {
    if (selectedColor) {
      const v = variants.find(
        (x) => x.size === size && x.color === selectedColor
      );
      return v ? v.stockQuantity > 0 : false;
    }
    return variants.some((x) => x.size === size && x.stockQuantity > 0);
  }

  function colorIsAvailable(color: string): boolean {
    if (selectedSize) {
      const v = variants.find(
        (x) => x.color === color && x.size === selectedSize
      );
      return v ? v.stockQuantity > 0 : false;
    }
    return variants.some((x) => x.color === color && x.stockQuantity > 0);
  }

  const canAddToCart =
    (sizes.length === 0 || selectedSize !== null) &&
    (colors.length === 0 || selectedColor !== null) &&
    selectedVariant !== undefined &&
    selectedVariant.stockQuantity >= quantity;

  const maxQuantity = selectedVariant?.stockQuantity ?? 0;

  function handleAddToCart() {
    if (!canAddToCart || !selectedVariant) return;
    setFeedback(null);

    startTransition(async () => {
      const result = await addToCart({
        variantId: selectedVariant.id,
        quantity,
      });
      if (result.ok) {
        setFeedback({
          type: "success",
          message: `Added to cart — ${productName}`,
        });
        router.refresh();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: "error", message: result.error.message });
      }
    });
  }

  const colorSwatchMap: Record<string, string> = {
    Black: "#1A1A1A",
    White: "#F5F5F3",
    "Rose Pink": "#C4847A",
    Navy: "#1B2A4A",
    Sage: "#7D8F7B",
  };

  return (
    <div className="space-y-5">
      {colors.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label-mono">Color</span>
            {selectedColor && (
              <span className="text-sm">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = colorIsAvailable(color);
              const active = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  disabled={!available}
                  aria-label={`Select color ${color}`}
                  className={`relative h-10 w-10 rounded-full border-2 transition-all ${
                    active
                      ? "border-foreground"
                      : "border-border hover:border-muted-foreground"
                  } ${!available && "cursor-not-allowed opacity-40"}`}
                >
                  <span
                    className="block h-full w-full rounded-full border-2 border-white"
                    style={{ background: colorSwatchMap[color] ?? "#ccc" }}
                  />
                  {!available && (
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="block h-[2px] w-8 rotate-45 bg-muted-foreground" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label-mono">Size</span>
            <Link
              href="/size-guide"
              className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground underline-offset-2 hover:underline"
            >
              Size guide
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = sizeIsAvailable(size);
              const active = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  disabled={!available}
                  className={`flex h-11 min-w-[3rem] items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:border-foreground"
                  } ${!available && "cursor-not-allowed text-muted-foreground line-through opacity-50 hover:border-border"}`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <span className="label-mono mb-2 block">Quantity</span>
        <div className="flex h-11 w-fit items-center rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-full w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <MinusIcon />
          </button>
          <span className="w-12 text-center text-sm font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQuantity || 10, q + 1))}
            disabled={maxQuantity > 0 && quantity >= maxQuantity}
            className="flex h-full w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <PlusIcon />
          </button>
        </div>
        {selectedVariant && selectedVariant.stockQuantity < 5 && selectedVariant.stockQuantity > 0 && (
          <p className="mt-1.5 text-xs text-rose">
            Only {selectedVariant.stockQuantity} left in stock
          </p>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart || isPending}
          className="btn-solid w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Adding..."
            : !selectedVariant
              ? "Select size and color"
              : selectedVariant.stockQuantity === 0
                ? "Out of stock"
                : "Add to cart"}
        </button>

        {feedback && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm ${
              feedback.type === "success"
                ? "module-muted border border-border"
                : "border border-rose/30 bg-rose-light text-rose"
            }`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            <span>{feedback.message}</span>
            {feedback.type === "success" && (
              <Link
                href="/cart"
                className="flex-shrink-0 font-mono text-2xs uppercase tracking-[0.1em] underline-offset-2 hover:underline"
              >
                View cart →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}
