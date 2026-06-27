import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  categories,
  products,
  productImages,
  productVariants,
} from "@/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { SortSelectClient } from "@/components/features/SortSelectClient";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse FemFit's full collection of gymnastic and activewear.",
};

export const revalidate = 60;

type SortOption = "newest" | "price_asc" | "price_desc" | "relevance";

interface SearchParams {
  category?: string;
  sort?: SortOption;
  min_price?: string;
  max_price?: string;
  size?: string;
  color?: string;
  in_stock?: string;
  cursor?: string;
}

const PAGE_SIZE = 20; // PRD §3.1: "first 20 results return in under 300ms"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="border-b border-femfit-border bg-femfit-warm py-8">
        <div className="container">
          <nav className="mb-3 flex items-center gap-2 text-xs text-femfit-mid">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span className="text-foreground">Shop</span>
          </nav>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
            {params.category ? formatCategoryName(params.category) : "All Products"}
          </h1>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full lg:w-56 lg:flex-shrink-0">
            <Suspense fallback={<FilterSkeleton />}>
              <Filters activeParams={params} />
            </Suspense>
          </aside>

          <div className="flex-1 min-w-0">
            <Suspense fallback={<GridSkeleton />} key={JSON.stringify(params)}>
              <ProductGrid params={params} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filters sidebar ────────────────────────────────────────────────────────────

async function Filters({ activeParams }: { activeParams: SearchParams }) {
  const cats = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(categories.sortOrder);

  const sizes = ["XS", "S", "M", "L", "XL"];
  const colors = ["Black", "White", "Rose Pink", "Navy", "Sage"];

  // Price range buckets in USD cents — covers full catalog
  const priceRanges = [
    { label: "Under $15", min: "0", max: "1499" },
    { label: "$15 – $25", min: "1500", max: "2499" },
    { label: "$25 – $50", min: "2500", max: "4999" },
    { label: "Over $50", min: "5000", max: "999999" },
  ];

  function filterUrl(key: keyof SearchParams, value: string | null, extra?: Record<string, string | null>) {
    const p = new URLSearchParams();
    const carry: Array<keyof SearchParams> = [
      "sort", "category", "size", "color", "in_stock", "min_price", "max_price",
    ];
    for (const k of carry) {
      const v = activeParams[k];
      if (v) p.set(k, v);
    }
    if (value === null) p.delete(key);
    else p.set(key, value);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
    }
    p.delete("cursor"); // reset pagination on filter change
    const qs = p.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  }

  const hasActive = ["category", "size", "color", "in_stock", "min_price", "max_price"]
    .some((k) => activeParams[k as keyof SearchParams]);

  return (
    <div className="space-y-8">
      {hasActive && (
        <Link href="/products" className="text-xs font-medium text-rose-femfit hover:underline">
          Clear all filters
        </Link>
      )}

      {/* Categories */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-femfit-mid">Category</p>
        <ul className="space-y-2">
          <li>
            <Link
              href={filterUrl("category", null)}
              className={`text-sm transition-colors ${!activeParams.category ? "font-medium text-foreground" : "text-femfit-mid hover:text-foreground"}`}
            >
              All
            </Link>
          </li>
          {cats.map((cat) => (
            <li key={cat.id}>
              <Link
                href={filterUrl("category", cat.slug)}
                className={`text-sm transition-colors ${activeParams.category === cat.slug ? "font-medium text-foreground" : "text-femfit-mid hover:text-foreground"}`}
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Price range — PRD §3.1 filter requirement */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-femfit-mid">Price</p>
        <ul className="space-y-2">
          {priceRanges.map((range) => {
            const active =
              activeParams.min_price === range.min &&
              activeParams.max_price === range.max;
            return (
              <li key={range.label}>
                <Link
                  href={filterUrl("min_price", active ? null : range.min, {
                    max_price: active ? null : range.max,
                  })}
                  className={`text-sm transition-colors ${active ? "font-medium text-foreground" : "text-femfit-mid hover:text-foreground"}`}
                >
                  {range.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Size */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-femfit-mid">Size</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const active = activeParams.size === size;
            return (
              <Link
                key={size}
                href={filterUrl("size", active ? null : size)}
                className={`flex h-8 w-10 items-center justify-center rounded border text-xs font-medium transition-colors ${
                  active
                    ? "border-femfit-charcoal bg-femfit-charcoal text-white"
                    : "border-femfit-border text-femfit-mid hover:border-femfit-charcoal hover:text-foreground"
                }`}
              >
                {size}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Color */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-femfit-mid">Color</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => {
            const active = activeParams.color === color;
            return (
              <Link
                key={color}
                href={filterUrl("color", active ? null : color)}
                className={`flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                  active
                    ? "border-femfit-charcoal bg-femfit-charcoal text-white"
                    : "border-femfit-border text-femfit-mid hover:border-femfit-charcoal hover:text-foreground"
                }`}
              >
                <ColorSwatch color={color} />
                {color}
              </Link>
            );
          })}
        </div>
      </div>

      {/* In stock only */}
      <div>
        <Link
          href={filterUrl("in_stock", activeParams.in_stock === "true" ? null : "true")}
          className={`flex items-center gap-2 text-sm transition-colors ${
            activeParams.in_stock === "true" ? "font-medium text-foreground" : "text-femfit-mid hover:text-foreground"
          }`}
        >
          <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            activeParams.in_stock === "true" ? "border-femfit-charcoal bg-femfit-charcoal" : "border-femfit-border"
          }`}>
            {activeParams.in_stock === "true" && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </span>
          In stock only
        </Link>
      </div>
    </div>
  );
}

// ── Product Grid (DB-level filtering, in-stock-first ordering) ────────────────

async function ProductGrid({ params }: { params: SearchParams }) {
  // Resolve category slug → ID
  let categoryId: string | null = null;
  if (params.category) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, params.category))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  // Base conditions on products
  const conditions = [eq(products.isActive, true), isNull(products.deletedAt)];
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (params.min_price) conditions.push(gte(products.basePriceCents, parseInt(params.min_price, 10)));
  if (params.max_price) conditions.push(lte(products.basePriceCents, parseInt(params.max_price, 10)));

  // Variant filter via EXISTS subquery — keeps filtering in the DB
  // so pagination works correctly per API Spec §7.1
  const variantPredicates = [eq(productVariants.productId, products.id), eq(productVariants.isActive, true)];
  if (params.size) variantPredicates.push(eq(productVariants.size, params.size));
  if (params.color) variantPredicates.push(eq(productVariants.color, params.color));
  if (params.in_stock === "true") variantPredicates.push(gte(productVariants.stockQuantity, 1));

  if (params.size || params.color || params.in_stock === "true") {
    conditions.push(
      exists(
        db.select({ one: sql`1` })
          .from(productVariants)
          .where(and(...variantPredicates))
      )
    );
  }

  // Sort: per PRD §3.1, out-of-stock items rank below in-stock items.
  // We compute total_stock per product via correlated subquery for the ORDER BY.
  const totalStockSql = sql<number>`(
    select coalesce(sum(${productVariants.stockQuantity}), 0)
    from ${productVariants}
    where ${productVariants.productId} = ${products.id}
      and ${productVariants.isActive} = true
  )`;
  const inStockFirst = sql`(${totalStockSql} > 0) desc`;

  const sortMap = {
    newest: [inStockFirst, desc(products.createdAt)],
    price_asc: [inStockFirst, asc(products.basePriceCents)],
    price_desc: [inStockFirst, desc(products.basePriceCents)],
    relevance: [inStockFirst, desc(products.createdAt)], // no FTS rank without a query
  } as const;
  const orderBy = sortMap[(params.sort as SortOption) ?? "newest"] ?? sortMap.newest;

  // Pagination — cursor is base64-encoded `${createdAt.iso}|${id}`
  // simple form: we just use createdAt as the cursor for now
  const offset = params.cursor ? parseInt(params.cursor, 10) || 0 : 0;

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      basePriceCents: products.basePriceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      createdAt: products.createdAt,
      primaryImageUrl: productImages.url,
      primaryImageAlt: productImages.altText,
      totalStock: totalStockSql,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(PAGE_SIZE + 1) // fetch one extra to know if there's a next page
    .offset(offset);

  const hasMore = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (visible.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-femfit-mid">
          Showing {visible.length} product{visible.length !== 1 ? "s" : ""}
          {hasMore && " (more available)"}
        </p>
        <SortSelectClient
          current={params.sort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "price_asc", label: "Price: low to high" },
            { value: "price_desc", label: "Price: high to low" },
            { value: "relevance", label: "Relevance" },
          ]}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        {visible.map((product, i) => {
          const price = formatMoney(product.basePriceCents, product.currency);
          const compareAt = product.compareAtPriceCents
            ? formatMoney(product.compareAtPriceCents, product.currency)
            : null;
          const inStock = Number(product.totalStock) > 0;
          const isNew = product.createdAt > thirtyDaysAgo;
          const hasDiscount = compareAt && product.compareAtPriceCents! > product.basePriceCents;

          return (
            <Link key={product.id} href={`/products/${product.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-femfit-gray">
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt={product.primaryImageAlt ?? product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={i < 4}
                  />
                ) : (
                  <PlaceholderImage name={product.name} />
                )}

                <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                  {isNew && (
                    <span className="rounded bg-femfit-charcoal px-2 py-0.5 text-2xs font-medium text-white">New</span>
                  )}
                  {hasDiscount && (
                    <span className="rounded bg-rose-femfit px-2 py-0.5 text-2xs font-medium text-white">Sale</span>
                  )}
                </div>

                {!inStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <span className="text-xs font-medium text-femfit-mid">Out of stock</span>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium leading-snug">{product.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{price.display}</span>
                  {hasDiscount && (
                    <span className="text-sm text-femfit-mid line-through">{compareAt!.display}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {(hasMore || offset > 0) && (
        <div className="mt-12 flex items-center justify-center gap-3">
          {offset > 0 && (
            <Link
              href={paginationUrl(params, Math.max(0, offset - PAGE_SIZE))}
              className="rounded-md border border-femfit-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-femfit-gray"
            >
              ← Previous
            </Link>
          )}
          {hasMore && (
            <Link
              href={paginationUrl(params, offset + PAGE_SIZE)}
              className="rounded-md bg-femfit-charcoal px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginationUrl(params: SearchParams, offset: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== "cursor" && v) p.set(k, String(v));
  }
  if (offset > 0) p.set("cursor", String(offset));
  return `/products${p.toString() ? `?${p.toString()}` : ""}`;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-femfit-gray">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-femfit-mid" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <p className="mb-1 font-medium">No products found</p>
      <p className="mb-6 text-sm text-femfit-mid">Try adjusting your filters</p>
      <Link href="/products" className="rounded-md border border-femfit-charcoal px-5 py-2.5 text-sm font-medium transition-colors hover:bg-femfit-charcoal hover:text-white">
        Clear filters
      </Link>
    </div>
  );
}

function FilterSkeleton() {
  return (
    <div className="space-y-8">
      {[120, 160, 140].map((w, i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-femfit-gray" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="h-4 animate-pulse rounded bg-femfit-gray" style={{ width: `${60 + j * 10}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-femfit-gray" />
        <div className="h-8 w-36 animate-pulse rounded bg-femfit-gray" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[3/4] animate-pulse rounded-lg bg-femfit-gray" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-femfit-gray" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-femfit-gray" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderImage({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center bg-femfit-gray">
      <span className="text-2xl font-medium text-femfit-mid">{initials}</span>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  const colorMap: Record<string, string> = {
    Black: "#1A1A1A",
    White: "#F5F5F3",
    "Rose Pink": "#C4847A",
    Navy: "#1B2A4A",
    Sage: "#7D8F7B",
  };
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-white/40"
      style={{ background: colorMap[color] ?? "#ccc" }}
      aria-hidden="true"
    />
  );
}

function formatCategoryName(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}