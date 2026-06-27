import Link from "next/link";
import Image from "next/image";
import type { ProductCard as ProductCardType } from "@/lib/catalog/queries";
import { formatMoney } from "@/lib/catalog/money";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductCardType;
  className?: string;
  priority?: boolean;
}

export function ProductCard({
  product,
  className,
  priority = false,
}: ProductCardProps) {
  const price = formatMoney(product.basePriceCents, product.currency);
  const compareAt = product.compareAtPriceCents
    ? formatMoney(product.compareAtPriceCents, product.currency)
    : null;
  const hasDiscount =
    compareAt && product.compareAtPriceCents! > product.basePriceCents;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn("group block", className)}
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-femfit-gray">
        {product.primaryImageUrl ? (
          <Image
            src={product.primaryImageUrl}
            alt={product.primaryImageAlt ?? product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
          />
        ) : (
          <PlaceholderImage name={product.name} />
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="rounded bg-femfit-charcoal px-2 py-0.5 text-2xs font-medium text-white">
              New
            </span>
          )}
          {hasDiscount && (
            <span className="rounded bg-rose-femfit px-2 py-0.5 text-2xs font-medium text-white">
              Sale
            </span>
          )}
        </div>

        {/* Out of stock overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <span className="text-xs font-medium text-femfit-mid">
              Out of stock
            </span>
          </div>
        )}

        {/* "View product" hover overlay — Server Component safe */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          <div className="bg-femfit-charcoal py-3 text-center text-xs font-medium tracking-wide text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            View product
          </div>
        </div>
      </div>

      {/* Product info */}
      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium leading-snug text-foreground">
          {product.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{price.display}</span>
          {hasDiscount && (
            <span className="text-sm text-femfit-mid line-through">
              {compareAt!.display}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PlaceholderImage({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full w-full items-center justify-center bg-femfit-gray">
      <span className="text-2xl font-medium text-femfit-mid">{initials}</span>
    </div>
  );
}