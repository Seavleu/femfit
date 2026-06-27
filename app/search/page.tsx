import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  products,
  productImages,
  productVariants,
  categories,
} from "@/db/schema";
import { and, desc, eq, isNull, sql, or, ilike } from "drizzle-orm";
import { SearchBarClient } from "@/components/features/SearchBar";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = {
  title: "Search",
  description: "Search FemFit for activewear, leggings, sports bras and more.",
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="border-b border-femfit-border bg-femfit-warm">
        <div className="container py-8 md:py-12">
          <nav className="mb-3 flex items-center gap-2 text-xs text-femfit-mid">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span className="text-foreground">Search</span>
          </nav>
          <h1 className="mb-6 text-2xl font-medium tracking-tight md:text-3xl">
            {query ? `Results for "${query}"` : "Search"}
          </h1>
          <div className="max-w-2xl">
            <SearchBarClient defaultValue={query} size="large" autoFocus />
          </div>
        </div>
      </div>

      <div className="container py-8">
        {!query ? (
          <SearchPrompt />
        ) : (
          <Suspense fallback={<SearchSkeleton />} key={query}>
            <SearchResults query={query} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ── Search results ─────────────────────────────────────────────────────────────

async function SearchResults({ query }: { query: string }) {
  const tsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `${t.replace(/[^\w]/g, "")}:*`)
    .join(" & ");

  const ilikePattern = `%${query}%`;

  // Compute total stock per product for in-stock-first ranking (PRD §3.1)
  const totalStockSql = sql<number>`(
    select coalesce(sum(${productVariants.stockQuantity}), 0)
    from ${productVariants}
    where ${productVariants.productId} = ${products.id}
      and ${productVariants.isActive} = true
  )`;

  const results = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      basePriceCents: products.basePriceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      categoryName: categories.name,
      primaryImageUrl: productImages.url,
      primaryImageAlt: productImages.altText,
      totalStock: totalStockSql,
      rank: sql<number>`coalesce(ts_rank(${products.searchVector}, to_tsquery('english', ${tsQuery || "*"})), 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(
      and(
        eq(products.isActive, true),
        isNull(products.deletedAt),
        or(
          tsQuery
            ? sql`${products.searchVector} @@ to_tsquery('english', ${tsQuery})`
            : sql`false`,
          ilike(products.name, ilikePattern),
          ilike(products.description, ilikePattern)
        )
      )
    )
    // PRD §3.1: "Out-of-stock items are ranked below in-stock items"
    // Order: in-stock first, then by FTS relevance, then by recency
    .orderBy(
      sql`(${totalStockSql} > 0) desc`,
      desc(sql`rank`),
      desc(products.createdAt)
    )
    .limit(48);

  if (results.length === 0) {
    return <NoResults query={query} />;
  }

  return (
    <div>
      <p className="mb-6 text-sm text-femfit-mid">
        {results.length} {results.length === 1 ? "result" : "results"}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {results.map((r, i) => {
          const price = formatMoney(r.basePriceCents, r.currency);
          const compareAt = r.compareAtPriceCents
            ? formatMoney(r.compareAtPriceCents, r.currency)
            : null;
          const inStock = Number(r.totalStock) > 0;
          const hasDiscount = compareAt && r.compareAtPriceCents! > r.basePriceCents;

          return (
            <Link key={r.id} href={`/products/${r.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-femfit-gray">
                {r.primaryImageUrl ? (
                  <Image
                    src={r.primaryImageUrl}
                    alt={r.primaryImageAlt ?? r.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={i < 4}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-femfit-mid">
                    {r.name[0]}
                  </div>
                )}
                {!inStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <span className="text-xs font-medium text-femfit-mid">Out of stock</span>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                {r.categoryName && (
                  <p className="text-2xs font-medium uppercase tracking-widest text-femfit-mid">
                    {r.categoryName}
                  </p>
                )}
                <p className="text-sm font-medium leading-snug">{r.name}</p>
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
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  const suggestions = ["leggings", "sports bra", "tank top", "shorts"];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-femfit-gray">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-femfit-mid" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <p className="mb-1 font-medium">No results for &ldquo;{query}&rdquo;</p>
      <p className="mb-8 text-sm text-femfit-mid">Try a different search term, or browse popular categories below</p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <Link
            key={s}
            href={`/search?q=${encodeURIComponent(s)}`}
            className="rounded-full border border-femfit-border px-4 py-2 text-xs font-medium text-femfit-mid transition-colors hover:border-femfit-charcoal hover:text-foreground"
          >
            {s}
          </Link>
        ))}
      </div>
      <Link href="/products" className="mt-6 text-sm font-medium text-rose-femfit underline-offset-2 hover:underline">
        Browse all products →
      </Link>
    </div>
  );
}

function SearchPrompt() {
  const popular = ["compression leggings", "sports bra", "biker shorts", "tank top", "resistance bands", "water bottle"];
  return (
    <div className="py-12">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-femfit-mid">Popular searches</h2>
      <div className="flex flex-wrap gap-2">
        {popular.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full border border-femfit-border px-4 py-2 text-sm text-femfit-mid transition-colors hover:border-femfit-charcoal hover:text-foreground"
          >
            {term}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div>
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-femfit-gray" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
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