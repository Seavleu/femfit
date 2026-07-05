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

export const revalidate = 60; // ISR — re-render at most once per minute

export default async function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <Suspense fallback={<CategoryStripSkeleton />}>
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

/* ─────────────────────────── Hero ─────────────────────────── */

function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-end bg-femfit-gray md:min-h-[92vh]">
      {/* Background — warm gradient stand-in until real photography is added */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #F2F0EC 0%, #EAE5DE 40%, #DDD4C8 100%)",
        }}
        aria-hidden="true"
      />

      {/* Decorative circle accent */}
      <div
        className="absolute right-[8%] top-[15%] h-64 w-64 rounded-full opacity-20 md:h-96 md:w-96"
        style={{ background: "var(--ff-rose)" }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="container relative z-10 pb-16 md:pb-24">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-femfit-mid">
            New Season 2026
          </p>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-medium leading-[1.05] tracking-tight-xl text-femfit-charcoal md:text-7xl">
            Move with
            <br />
            <span className="text-rose-femfit italic">confidence.</span>
          </h1>

          {/* Sub */}
          <p className="mb-8 max-w-md text-base leading-relaxed text-femfit-mid md:text-lg">
            Premium gymnastic and activewear designed for Cambodia's active
            women. Fast delivery across Phnom Penh.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex h-12 items-center rounded-md bg-femfit-charcoal px-8 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Shop now
            </Link>
            <Link
              href="/products?sort=newest"
              className="inline-flex h-12 items-center rounded-md border border-femfit-charcoal px-8 text-sm font-medium text-femfit-charcoal transition-colors hover:bg-femfit-charcoal hover:text-white"
            >
              New arrivals
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex items-center gap-6">
            <div className="flex -space-x-2">
              {["#C4847A", "#A36B62", "#8A5550"].map((color, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-femfit-warm"
                  style={{ background: color }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-xs text-femfit-mid">
              Trusted by <span className="font-medium text-foreground">500+</span>{" "}
              women across Cambodia
            </p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex h-10 w-6 items-start justify-center rounded-full border border-femfit-mid/30 pt-1.5">
          <div className="h-1.5 w-1 animate-bounce rounded-full bg-femfit-mid" />
        </div>
      </div>
    </section>
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
    <section className="border-b border-femfit-border bg-femfit-warm py-6">
      <div className="container">
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide md:gap-3">
          <Link
            href="/products"
            className="flex-shrink-0 rounded-full border border-femfit-charcoal bg-femfit-charcoal px-5 py-2 text-xs font-medium text-white transition-colors hover:opacity-80"
          >
            All
          </Link>
          {items.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="flex-shrink-0 rounded-full border border-femfit-border px-5 py-2 text-xs font-medium text-femfit-mid transition-colors hover:border-femfit-charcoal hover:text-foreground"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryStripSkeleton() {
  return (
    <section className="border-b border-femfit-border bg-femfit-warm py-6">
      <div className="container">
        <div className="flex items-center justify-center gap-3">
          {[80, 96, 88, 72, 104].map((w, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-full bg-femfit-gray"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Featured Products ─────────────────────────── */

async function FeaturedProducts() {
  const products = await getFeaturedProducts(4);

  if (products.length === 0) return null;

  return (
    <section className="bg-femfit-warm py-16 md:py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Curated picks"
          title="Featured this season"
          href="/products?featured=true"
          linkLabel="View all"
        />
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={i < 2}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Best Sellers ─────────────────────────── */

async function BestSellers() {
  const products = await getBestSellers(8);

  if (products.length === 0) return null;

  return (
    <section className="bg-femfit-warm py-16 md:py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Top picks"
          title="Best sellers"
          href="/products?sort=bestsellers"
          linkLabel="See all"
        />
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} priority={false} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Values Strip ─────────────────────────── */

function ValuesStrip() {
  const values = [
    {
      icon: <TruckIcon />,
      title: "Fast Delivery",
      desc: "Same-day dispatch in Phnom Penh. 1–3 days nationwide.",
    },
    {
      icon: <PhoneIcon />,
      title: "COD Available",
      desc: "Pay cash on delivery — no upfront digital payment required.",
    },
    {
      icon: <ReturnIcon />,
      title: "7-Day Returns",
      desc: "Not the right fit? Return within 7 days of delivery.",
    },
    {
      icon: <ShieldIcon />,
      title: "Secure Payment",
      desc: "ABA Pay, KHQR, and cash on delivery accepted.",
    },
  ];

  return (
    <section className="border-y border-femfit-border bg-femfit-gray py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="flex flex-col items-start gap-3">
              <span className="text-rose-femfit">{v.icon}</span>
              <div>
                <p className="text-sm font-medium">{v.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-femfit-mid">
                  {v.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── New Arrivals ─────────────────────────── */

async function NewArrivals() {
  const products = await getNewArrivals(8);

  if (products.length === 0) return null;

  return (
    <section className="bg-femfit-warm py-16 md:py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Just landed"
          title="New arrivals"
          href="/products?sort=newest"
          linkLabel="See all"
        />
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} priority={false} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Newsletter ─────────────────────────── */

function NewsletterSection() {
  return (
    <section className="bg-femfit-charcoal py-16 md:py-20">
      <div className="container text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
          Stay in the loop
        </p>
        <h2 className="mb-3 text-3xl font-medium tracking-tight-xl text-white md:text-4xl">
          Early access &amp; exclusive offers
        </h2>
        <p className="mb-8 text-sm text-white/60">
          Get first access to new drops and members-only discounts.
        </p>
        <NewsletterForm />
        <p className="mt-3 text-xs text-white/30">
          By subscribing you agree to receive SMS updates. Unsubscribe anytime.
        </p>
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
    <div className="flex items-end justify-between">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.15em] text-femfit-mid">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-medium tracking-tight-xl md:text-3xl">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs font-medium text-femfit-mid underline-offset-2 hover:text-foreground hover:underline"
      >
        {linkLabel}
        <ChevronRightIcon />
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
    <section className="bg-femfit-warm py-16 md:py-24">
      <div className="container">
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-1 h-3 w-24 animate-pulse rounded bg-femfit-gray" />
            <div className="h-7 w-48 animate-pulse rounded bg-femfit-gray" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[3/4] animate-pulse rounded-lg bg-femfit-gray" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-femfit-gray" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-femfit-gray" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Icons ─────────────────────────── */

function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}