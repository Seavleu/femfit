import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/features/ProductCard";
import { NewsletterForm } from "@/components/features/NewsletterSection";
import {
  getFeaturedProducts,
  getNewArrivals,
  getActiveCategories,
  getBestSellers,
} from "@/lib/catalog/queries";

export const revalidate = 60;

export default async function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-3 pb-8 pt-6 md:px-6 md:pt-8">
      <BentoHero />
      <Suspense fallback={<ModuleSkeleton className="mt-3 h-16" />}>
        <CategoryStrip />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton title="Featured" count={4} />}>
        <FeaturedProducts />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton title="Best Sellers" count={4} />}>
        <BestSellers />
      </Suspense>
      <ValuesStrip />
      <Suspense fallback={<ProductGridSkeleton title="New Arrivals" count={4} />}>
        <NewArrivals />
      </Suspense>
      <NewsletterSection />
    </div>
  );
}

/* ─────────────────────────── Bento Hero ─────────────────────────── */

function BentoHero() {
  return (
    <section className="grid gap-3 md:grid-cols-12 md:grid-rows-[auto_auto]">
      {/* Brand + CTA module — dominant left */}
      <div className="module relative flex min-h-[420px] flex-col justify-between overflow-hidden p-6 md:col-span-7 md:min-h-[520px] md:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, rgba(232,62,140,0.18), transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(245,230,66,0.2), transparent 45%)",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="label-mono mb-6">Season 2026</p>
          <p className="brand-dot mb-4 text-base md:text-lg">FEMFIT</p>
          <h1 className="max-w-md font-serif text-4xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Move with confidence.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground md:text-base">
            Gymnastic and activewear designed for Cambodia&apos;s athletes.
            Fast delivery across Phnom Penh.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-3 pt-8">
          <Link href="/products" className="btn-solid">
            Shop now
          </Link>
          <Link href="/products?sort=newest" className="btn-ghost">
            New arrivals
          </Link>
        </div>
      </div>

      {/* Right column stack */}
      <div className="grid gap-3 md:col-span-5 md:grid-rows-2">
        {/* Specs / values teaser */}
        <div className="module-muted flex flex-col justify-between p-5 md:p-6">
          <div className="flex items-start justify-between">
            <p className="font-serif text-2xl">Specs</p>
            <span className="label-mono">Technical</span>
          </div>
          <ul className="mt-6 space-y-3 font-mono text-2xs uppercase tracking-[0.12em] text-foreground">
            <li className="flex items-center gap-3">
              <Dot /> Same-day PP dispatch
            </li>
            <li className="flex items-center gap-3">
              <Dot /> Cash on delivery
            </li>
            <li className="flex items-center gap-3">
              <Dot /> 7-day returns
            </li>
            <li className="flex items-center gap-3">
              <Dot /> ABA · KHQR · COD
            </li>
          </ul>
        </div>

        {/* Campaign / visual module */}
        <div className="module relative flex min-h-[200px] flex-col justify-end overflow-hidden p-5 md:p-6">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #121212 0%, #2a2a2a 45%, #E83E8C 100%)",
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <p className="label-mono text-white/50">Campaign</p>
            <p className="mt-2 font-serif text-2xl text-white">Listen to your body.</p>
            <Link
              href="/products"
              className="mt-4 inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.14em] text-white/80 transition-colors hover:text-white"
            >
              Explore collection →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-foreground"
      aria-hidden="true"
    />
  );
}

/* ─────────────────────────── Categories ─────────────────────────── */

async function CategoryStrip() {
  const cats = await getActiveCategories();
  const fallbackCategories = [
    { id: "1", slug: "leggings", name: "Leggings" },
    { id: "2", slug: "sports-bras", name: "Sports Bras" },
    { id: "3", slug: "tank-tops", name: "Tank Tops" },
    { id: "4", slug: "shorts", name: "Shorts" },
    { id: "5", slug: "accessories", name: "Accessories" },
  ];
  const items = cats.length > 0 ? cats : fallbackCategories;

  return (
    <section className="module mt-3 p-3">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <Link
          href="/products"
          className="flex-shrink-0 rounded-xl bg-foreground px-4 py-2.5 font-mono text-2xs uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85"
        >
          All
        </Link>
        {items.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className="flex-shrink-0 rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Featured ─────────────────────────── */

async function FeaturedProducts() {
  const products = await getFeaturedProducts(4);
  if (products.length === 0) return null;

  return (
    <section className="mt-10 md:mt-14">
      <SectionHeader
        eyebrow="Curated"
        title="Featured"
        href="/products?featured=true"
        linkLabel="View all"
      />
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Best Sellers ─────────────────────────── */

async function BestSellers() {
  const products = await getBestSellers(8);
  if (products.length === 0) return null;

  return (
    <section className="mt-10 md:mt-14">
      <SectionHeader
        eyebrow="Top picks"
        title="Best sellers"
        href="/products?sort=bestsellers"
        linkLabel="See all"
      />
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} priority={false} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Values ─────────────────────────── */

function ValuesStrip() {
  const values = [
    {
      title: "Fast delivery",
      desc: "Same-day dispatch in Phnom Penh. 1–3 days nationwide.",
      tag: "Logistics",
    },
    {
      title: "COD available",
      desc: "Pay cash on delivery — no upfront digital payment required.",
      tag: "Payment",
    },
    {
      title: "7-day returns",
      desc: "Not the right fit? Return within 7 days of delivery.",
      tag: "Policy",
    },
    {
      title: "Secure pay",
      desc: "ABA Pay, KHQR, and cash on delivery accepted.",
      tag: "Security",
    },
  ];

  return (
    <section className="mt-10 grid gap-3 md:mt-14 md:grid-cols-4">
      {values.map((v) => (
        <div key={v.title} className="module-muted p-5">
          <p className="label-mono">{v.tag}</p>
          <p className="mt-3 font-serif text-xl">{v.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {v.desc}
          </p>
        </div>
      ))}
    </section>
  );
}

/* ─────────────────────────── New Arrivals ─────────────────────────── */

async function NewArrivals() {
  const products = await getNewArrivals(8);
  if (products.length === 0) return null;

  return (
    <section className="mt-10 md:mt-14">
      <SectionHeader
        eyebrow="Just landed"
        title="New arrivals"
        href="/products?sort=newest"
        linkLabel="See all"
      />
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} priority={false} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Newsletter ─────────────────────────── */

function NewsletterSection() {
  return (
    <section className="module mt-10 overflow-hidden md:mt-14">
      <div className="grid md:grid-cols-2">
        <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-10">
          <p className="label-mono">Stay in the loop</p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight md:text-4xl">
            Early access &amp; exclusive offers
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            First drops and members-only discounts, by SMS.
          </p>
        </div>
        <div className="flex flex-col justify-center bg-muted/30 p-6 md:p-10">
          <NewsletterForm />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Unsubscribe anytime
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Shared UI ─────────────────────────── */

function SectionHeader({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="label-mono mb-2">{eyebrow}</p>
        <h2 className="title-serif">{title}</h2>
      </div>
      <Link
        href={href}
        className="mb-1 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

function ProductGridSkeleton({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <section className="mt-10 md:mt-14" aria-label={`Loading ${title}`}>
      <div className="mb-5 h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="module overflow-hidden">
            <div className="aspect-[3/4] animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModuleSkeleton({ className }: { className?: string }) {
  return <div className={`module animate-pulse bg-muted ${className ?? ""}`} />;
}
