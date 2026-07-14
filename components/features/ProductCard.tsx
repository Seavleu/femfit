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
      className={cn(
        "group module flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-0.5",
        className
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {product.primaryImageUrl ? (
          <Image
            src={product.primaryImageUrl}
            alt={product.primaryImageAlt ?? product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
          />
        ) : (
          <PlaceholderImage name={product.name} />
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="rounded-md bg-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background">
              New
            </span>
          )}
          {hasDiscount && (
            <span className="rounded-md bg-rose-femfit px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
              Sale
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-serif text-lg leading-snug tracking-tight text-foreground">
          {product.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-wide text-foreground">
              {price.display}
            </span>
            {hasDiscount && (
              <span className="font-mono text-xs text-muted-foreground line-through">
                {compareAt!.display}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
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
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span className="font-mono text-2xl tracking-[0.2em] text-muted-foreground">
        {initials}
      </span>
    </div>
  );
}
