"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateCartItem, removeCartItem } from "@/lib/cart/actions";
import type { CartLineItem as CartLineItemType } from "@/lib/cart/queries";

interface Props {
  item: CartLineItemType;
}

export function CartLineItem({ item }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localQty, setLocalQty] = useState(item.quantity);

  const canDecrease = localQty > 1;
  const canIncrease = localQty < item.stockAvailable;

  function changeQuantity(next: number) {
    if (next < 1 || next > 99) return;
    if (next > item.stockAvailable) {
      setError(`Only ${item.stockAvailable} left in stock.`);
      return;
    }
    setError(null);
    setLocalQty(next);
    startTransition(async () => {
      const result = await updateCartItem({ itemId: item.id, quantity: next });
      if (!result.ok) {
        setError(result.error.message);
        setLocalQty(item.quantity); // revert optimistic update
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItem({ itemId: item.id });
      if (!result.ok) setError(result.error.message);
    });
  }

  return (
    <div
      className={`flex gap-4 border-b border-femfit-border py-6 transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {/* Image */}
      <Link
        href={`/products/${item.productSlug}`}
        className="relative h-28 w-24 flex-shrink-0 overflow-hidden rounded-md bg-femfit-gray sm:h-32 sm:w-28"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.imageAlt ?? item.productName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 96px, 112px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-femfit-mid">
            {item.productName[0]}
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.productSlug}`}
              className="block truncate text-sm font-medium hover:text-rose-femfit"
            >
              {item.productName}
            </Link>
            <p className="mt-1 text-xs text-femfit-mid">{item.variantLabel}</p>
            <p className="mt-0.5 text-2xs text-femfit-mid">SKU: {item.sku}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-sm font-medium">{item.lineTotal.display}</p>
            {localQty > 1 && (
              <p className="text-xs text-femfit-mid">
                {item.unitPrice.display} each
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-md border border-femfit-border">
            <button
              type="button"
              onClick={() => changeQuantity(localQty - 1)}
              disabled={!canDecrease || isPending}
              className="flex h-8 w-8 items-center justify-center text-femfit-mid transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {localQty}
            </span>
            <button
              type="button"
              onClick={() => changeQuantity(localQty + 1)}
              disabled={!canIncrease || isPending}
              className="flex h-8 w-8 items-center justify-center text-femfit-mid transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="text-xs text-femfit-mid underline-offset-2 hover:text-rose-femfit hover:underline disabled:cursor-not-allowed"
          >
            Remove
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-femfit" role="alert">
            {error}
          </p>
        )}

        {item.stockAvailable <= 3 && item.stockAvailable > 0 && (
          <p className="text-xs text-femfit-mid">
            Only {item.stockAvailable} left in stock
          </p>
        )}
      </div>
    </div>
  );
}