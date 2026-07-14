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
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <div className="module mb-3 p-6 md:p-8">
        <nav className="mb-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span className="text-foreground">Shop</span>
        </nav>
        <p className="label-mono mb-2">Catalog</p>
        <h1 className="title-serif">
          {params.category ? formatCategoryName(params.category) : "All products"}
        </h1>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <aside className="module w-full p-5 lg:w-56 lg:flex-shrink-0">
          <Suspense fallback={<FilterSkeleton />}>
            <Filters activeParams={params} />
          </Suspense>
        </aside>

        <div className="min-w-0 flex-1">
          <Suspense fallback={<GridSkeleton />} key={JSON.stringify(params)}>
            <ProductGrid params={params} />
          </Suspense>
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
        <Link href="/products" className="font-mono text-2xs uppercase tracking-[0.12em] text-rose-femfit hover:underline">
          Clear all filters
        </Link>
      )}

      {/* Categories */}
      <div>
        <p className="label-mono mb-3">Category</p>
        <ul className="space-y-2">
          <li>
            <Link
              href={filterUrl("category", null)}
              className={`text-sm transition-colors ${!activeParams.category ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </Link>
          </li>
          {cats.map((cat) => (
            <li key={cat.id}>
              <Link
                href={filterUrl("category", cat.slug)}
                className={`text-sm transition-colors ${activeParams.category === cat.slug ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Price range — PRD §3.1 filter requirement */}
      <div>
        <p className="label-mono mb-3">Price</p>
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
                  className={`text-sm transition-colors ${active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
        <p className="label-mono mb-3">Size</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const active = activeParams.size === size;
            return (
              <Link
                key={size}
                href={filterUrl("size", active ? null : size)}
                className={`flex h-8 w-10 items-center justify-center rounded-lg border font-mono text-2xs font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
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
        <p className="label-mono mb-3">Color</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => {
            const active = activeParams.color === color;
            return (
              <Link
                key={color}
                href={filterUrl("color", active ? null : color)}
                className={`flex h-7 items-center gap-1.5 rounded-xl border px-3 font-mono text-2xs transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
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
            activeParams.in_stock === "true" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            activeParams.in_stock === "true" ? "border-foreground bg-foreground" : "border-border"
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
    <div className="module p-4 md:p-5">
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {visible.map((product, i) => {
          const price = formatMoney(product.basePriceCents, product.currency);
          const compareAt = product.compareAtPriceCents
            ? formatMoney(product.compareAtPriceCents, product.currency)
            : null;
          const inStock = Number(product.totalStock) > 0;
          const isNew = product.createdAt > thirtyDaysAgo;
          const hasDiscount = compareAt && product.compareAtPriceCents! > product.basePriceCents;

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-transform duration-300 hover:-translate-y-0.5"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt={product.primaryImageAlt ?? product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={i < 4}
                  />
                ) : (
                  <PlaceholderImage name={product.name} />
                )}

                <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                  {isNew && (
                    <span className="rounded-md bg-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background">New</span>
                  )}
                  {hasDiscount && (
                    <span className="rounded-md bg-rose-femfit px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white">Sale</span>
                  )}
                </div>

                {!inStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">Out of stock</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="font-serif text-lg leading-snug tracking-tight">{product.name}</p>
                <div className="mt-auto flex items-center gap-2">
                  <span className="font-mono text-xs tracking-wide">{price.display}</span>
                  {hasDiscount && (
                    <span className="font-mono text-xs text-muted-foreground line-through">{compareAt!.display}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {(hasMore || offset > 0) && (
        <div className="mt-10 flex items-center justify-center gap-3">
          {offset > 0 && (
            <Link
              href={paginationUrl(params, Math.max(0, offset - PAGE_SIZE))}
              className="btn-ghost h-10 px-5"
            >
              ← Previous
            </Link>
          )}
          {hasMore && (
            <Link
              href={paginationUrl(params, offset + PAGE_SIZE)}
              className="btn-solid h-10 px-5"
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
    <div className="module flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <p className="font-serif text-2xl">No products found</p>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">Try adjusting your filters</p>
      <Link href="/products" className="btn-ghost">
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
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${60 + j * 10}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="module p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border">
            <div className="aspect-[3/4] animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderImage({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span className="font-mono text-2xl tracking-[0.2em] text-muted-foreground">{initials}</span>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  const colorMap: Record<string, string> = {
    Black: "#121212",
    White: "#F5F5F5",
    "Rose Pink": "#E83E8C",
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