import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  categories,
  products,
  productImages,
  productVariants,
  reviews,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { VariantSelector } from "@/components/features/VariantSelector";

export const revalidate = 60;

interface ProductDetailProps {
  params: Promise<{ slug: string }>;
}

// ── Metadata (SEO) ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: ProductDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.primaryImageUrl ? [product.primaryImageUrl] : [],
    },
  };
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getProduct(slug: string) {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      name: products.name,
      description: products.description,
      basePriceCents: products.basePriceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      isActive: products.isActive,
      categoryId: products.categoryId,
      createdAt: products.createdAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      primaryImageUrl: productImages.url,
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
        eq(products.slug, slug),
        eq(products.isActive, true),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

async function getProductImages(productId: string) {
  return db
    .select({
      id: productImages.id,
      url: productImages.url,
      altText: productImages.altText,
      sortOrder: productImages.sortOrder,
      isPrimary: productImages.isPrimary,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.sortOrder);
}

async function getProductVariants(productId: string) {
  return db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      priceCents: productVariants.priceCents,
      stockQuantity: productVariants.stockQuantity,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.isActive, true)
      )
    );
}

async function getReviewSummary(productId: string) {
  const [summary] = await db
    .select({
      count: sql<number>`count(*)`,
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.isApproved, true),
        isNull(reviews.deletedAt)
      )
    );

  return {
    count: Number(summary?.count ?? 0),
    avg: Number(summary?.avg ?? 0),
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({ params }: ProductDetailProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [images, variants, reviewSummary] = await Promise.all([
    getProductImages(product.id),
    getProductVariants(product.id),
    getReviewSummary(product.id),
  ]);

  const galleryImages =
    images.length > 0
      ? images
      : product.primaryImageUrl
        ? [
            {
              id: "primary",
              url: product.primaryImageUrl,
              altText: product.name,
              sortOrder: 0,
              isPrimary: true,
            },
          ]
        : [];

  const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
  const inStock = totalStock > 0;
  const isNew =
    product.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-femfit-warm">
      {/* Breadcrumbs */}
      <div className="border-b border-femfit-border py-4">
        <div className="container">
          <nav className="flex items-center gap-2 text-xs text-femfit-mid">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-foreground">
              Shop
            </Link>
            {product.categorySlug && (
              <>
                <span>/</span>
                <Link
                  href={`/products?category=${product.categorySlug}`}
                  className="hover:text-foreground"
                >
                  {product.categoryName}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="truncate text-foreground">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Image gallery */}
          <ImageGallery images={galleryImages} productName={product.name} />

          {/* Product info */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductInfo
              product={product}
              variants={variants}
              reviewSummary={reviewSummary}
              inStock={inStock}
              isNew={isNew}
            />
          </div>
        </div>

        {/* Description section */}
        <div className="mt-16 grid grid-cols-1 gap-12 border-t border-femfit-border pt-12 md:grid-cols-2 md:gap-20">
          <div>
            <h2 className="mb-4 text-lg font-medium tracking-tight">
              Product details
            </h2>
            <p className="text-sm leading-relaxed text-femfit-mid">
              {product.description ?? "No description available yet."}
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-medium tracking-tight">
              Care &amp; sizing
            </h2>
            <ul className="space-y-2 text-sm text-femfit-mid">
              <li>• Machine wash cold with similar colors</li>
              <li>• Tumble dry low or hang to dry</li>
              <li>• Do not bleach or iron print</li>
              <li>• Fits true to size — see size chart for measurements</li>
            </ul>
          </div>
        </div>

        {/* Reviews placeholder */}
        <Suspense fallback={null}>
          <ReviewsSection productId={product.id} summary={reviewSummary} />
        </Suspense>

        {/* Related products */}
        {product.categoryId && (
          <Suspense fallback={null}>
            <RelatedProducts
              categoryId={product.categoryId}
              currentProductId={product.id}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ── Image Gallery ──────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

function ImageGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-lg bg-femfit-gray">
        <div className="flex h-full items-center justify-center">
          <span className="text-femfit-mid">No image available</span>
        </div>
      </div>
    );
  }

  const [primary, ...rest] = images;

  return (
    <div className="space-y-3">
      {/* Primary image */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-femfit-gray">
        <Image
          src={primary.url}
          alt={primary.altText ?? productName}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Thumbnails */}
      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {rest.slice(0, 4).map((img) => (
            <div
              key={img.id}
              className="relative aspect-square overflow-hidden rounded-md bg-femfit-gray"
            >
              <Image
                src={img.url}
                alt={img.altText ?? productName}
                fill
                className="object-cover"
                sizes="120px"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Product Info ───────────────────────────────────────────────────────────────

function ProductInfo({
  product,
  variants,
  reviewSummary,
  inStock,
  isNew,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    compareAtPriceCents: number | null;
    currency: string;
    categoryName: string | null;
  };
  variants: Array<{
    id: string;
    size: string | null;
    color: string | null;
    priceCents: number | null;
    stockQuantity: number;
  }>;
  reviewSummary: { count: number; avg: number };
  inStock: boolean;
  isNew: boolean;
}) {
  const price = formatMoney(product.basePriceCents, product.currency);
  const compareAt = product.compareAtPriceCents
    ? formatMoney(product.compareAtPriceCents, product.currency)
    : null;
  const hasDiscount =
    compareAt && product.compareAtPriceCents! > product.basePriceCents;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPriceCents! - product.basePriceCents) /
          product.compareAtPriceCents!) *
          100
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Category + badges */}
      <div className="flex items-center gap-3">
        {product.categoryName && (
          <span className="text-xs font-medium uppercase tracking-widest text-femfit-mid">
            {product.categoryName}
          </span>
        )}
        {isNew && (
          <span className="rounded bg-femfit-charcoal px-2 py-0.5 text-2xs font-medium text-white">
            New
          </span>
        )}
        {hasDiscount && (
          <span className="rounded bg-rose-femfit px-2 py-0.5 text-2xs font-medium text-white">
            -{discountPercent}%
          </span>
        )}
      </div>

      {/* Name */}
      <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
        {product.name}
      </h1>

      {/* Reviews summary */}
      {reviewSummary.count > 0 ? (
        <div className="flex items-center gap-2">
          <StarRating rating={reviewSummary.avg} />
          <span className="text-sm text-femfit-mid">
            {reviewSummary.avg.toFixed(1)} ({reviewSummary.count}{" "}
            {reviewSummary.count === 1 ? "review" : "reviews"})
          </span>
        </div>
      ) : (
        <p className="text-sm text-femfit-mid">No reviews yet</p>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-medium">{price.display}</span>
        {hasDiscount && (
          <span className="text-lg text-femfit-mid line-through">
            {compareAt!.display}
          </span>
        )}
      </div>

      {/* Stock status */}
      {!inStock ? (
        <div className="flex items-center gap-2 text-sm text-rose-femfit">
          <span className="h-2 w-2 rounded-full bg-rose-femfit" />
          Out of stock — check back soon
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-femfit-mid">
          <span className="h-2 w-2 rounded-full bg-green-600" />
          In stock — ready to ship
        </div>
      )}

      {/* Variant selector — Client Component */}
      <VariantSelector
        productId={product.id}
        productName={product.name}
        variants={variants}
        basePriceCents={product.basePriceCents}
        currency={product.currency}
      />

      {/* Shipping info */}
      <div className="space-y-3 rounded-lg border border-femfit-border bg-femfit-warm p-4 text-sm">
        <div className="flex items-start gap-3">
          <TruckSmallIcon />
          <div>
            <p className="font-medium">Free shipping over $50</p>
            <p className="text-femfit-mid">Same-day dispatch in Phnom Penh</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-femfit-border pt-3">
          <ReturnSmallIcon />
          <div>
            <p className="font-medium">7-day returns</p>
            <p className="text-femfit-mid">
              Hassle-free returns within 7 days of delivery
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-femfit-border pt-3">
          <ShieldSmallIcon />
          <div>
            <p className="font-medium">Secure payment</p>
            <p className="text-femfit-mid">
              ABA Pay, KHQR, and cash on delivery accepted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reviews Section ────────────────────────────────────────────────────────────

async function ReviewsSection({
  productId,
  summary,
}: {
  productId: string;
  summary: { count: number; avg: number };
}) {
  if (summary.count === 0) return null;

  const recentReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.isApproved, true),
        isNull(reviews.deletedAt)
      )
    )
    .orderBy(sql`${reviews.createdAt} desc`)
    .limit(3);

  return (
    <section className="mt-16 border-t border-femfit-border pt-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="mb-2 text-2xl font-medium tracking-tight">
            Customer reviews
          </h2>
          <div className="flex items-center gap-3">
            <StarRating rating={summary.avg} />
            <span className="text-sm text-femfit-mid">
              {summary.avg.toFixed(1)} from {summary.count}{" "}
              {summary.count === 1 ? "review" : "reviews"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {recentReviews.map((review) => (
          <div
            key={review.id}
            className="border-b border-femfit-border pb-6 last:border-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <StarRating rating={review.rating} small />
              <span className="text-xs text-femfit-mid">
                {new Date(review.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {review.title && (
              <p className="mb-1 text-sm font-medium">{review.title}</p>
            )}
            {review.body && (
              <p className="text-sm leading-relaxed text-femfit-mid">
                {review.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Related Products ───────────────────────────────────────────────────────────

async function RelatedProducts({
  categoryId,
  currentProductId,
}: {
  categoryId: string;
  currentProductId: string;
}) {
  const related = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      basePriceCents: products.basePriceCents,
      currency: products.currency,
      primaryImageUrl: productImages.url,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(
      and(
        eq(products.categoryId, categoryId),
        eq(products.isActive, true),
        isNull(products.deletedAt),
        sql`${products.id} != ${currentProductId}`
      )
    )
    .limit(4);

  if (related.length === 0) return null;

  return (
    <section className="mt-16 border-t border-femfit-border pt-12">
      <h2 className="mb-8 text-2xl font-medium tracking-tight">
        You might also like
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {related.map((p) => {
          const price = formatMoney(p.basePriceCents, p.currency);
          return (
            <Link key={p.id} href={`/products/${p.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-femfit-gray">
                {p.primaryImageUrl ? (
                  <Image
                    src={p.primaryImageUrl}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-femfit-mid">
                    {p.name[0]}
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium leading-snug">{p.name}</p>
                <p className="text-sm">{price.display}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StarRating({
  rating,
  small = false,
}: {
  rating: number;
  small?: boolean;
}) {
  const size = small ? 14 : 16;
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={n <= filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={n <= filled ? "text-rose-femfit" : "text-femfit-border"}
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function formatMoney(amountCents: number, currency: string = "USD") {
  const display =
    currency === "USD"
      ? `$${(amountCents / 100).toFixed(2)}`
      : `៛${amountCents.toLocaleString()}`;
  return { amount: amountCents, currency, display };
}

function TruckSmallIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-rose-femfit"
      aria-hidden="true"
    >
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function ReturnSmallIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-rose-femfit"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ShieldSmallIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-rose-femfit"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}