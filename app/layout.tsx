import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { SearchBarClient } from "@/components/features/SearchBar";
import { getCartItemCount } from "@/lib/cart/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FemFit", template: "%s | FemFit" },
  description: "Premium gymnastic and activewear for Cambodia.",
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  ),
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}

async function SiteHeader() {
  const navLinks = [
    { label: "Shop", href: "/products" },
    { label: "Leggings", href: "/products?category=leggings" },
    { label: "Sports Bras", href: "/products?category=sports-bras" },
    { label: "New Arrivals", href: "/products?sort=newest" },
  ];

  // Cart count for badge — runs on every nav render but is fast
  // (single SUM query, cached at the cart row level). Wrap in try/catch
  // so the header never breaks even if cart queries fail.
  let cartCount = 0;
  try {
    cartCount = await getCartItemCount();
  } catch (err) {
    console.error("[SiteHeader] failed to load cart count", err);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-femfit-border bg-femfit-warm/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xl font-medium tracking-tight text-femfit-charcoal dark:text-white"
        >
          FEMFIT
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-femfit-mid transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden flex-1 max-w-sm md:block lg:max-w-md">
          <SearchBarClient size="small" />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-md text-femfit-mid transition-colors hover:bg-femfit-gray hover:text-foreground md:hidden"
          >
            <SearchIcon />
          </Link>
          <Link
            href="/sign-in"
            className="hidden text-sm text-femfit-mid transition-colors hover:text-foreground md:block"
          >
            Sign in
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ""}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-femfit-mid transition-colors hover:bg-femfit-gray hover:text-foreground"
          >
            <BagIcon />
            {cartCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-femfit px-1 text-2xs font-medium text-white"
                aria-hidden="true"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          <button
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-femfit-mid hover:bg-femfit-gray lg:hidden"
          >
            <MenuIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  const shopLinks = [
    { label: "All Products", href: "/products" },
    { label: "Leggings", href: "/products?category=leggings" },
    { label: "Sports Bras", href: "/products?category=sports-bras" },
    { label: "New Arrivals", href: "/products?sort=newest" },
  ];
  const helpLinks = ["Track Order", "Returns", "Sizing Guide", "Contact Us"];

  return (
    <footer className="border-t border-femfit-border bg-femfit-warm">
      <div className="container py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="text-xl font-medium tracking-tight">FEMFIT</p>
            <p className="mt-3 text-sm leading-relaxed text-femfit-mid">
              Premium activewear crafted for Cambodia&apos;s active women.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-femfit-mid">
              Shop
            </p>
            <ul className="space-y-3">
              {shopLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-femfit-mid hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-femfit-mid">
              Help
            </p>
            <ul className="space-y-3">
              {helpLinks.map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-femfit-mid hover:text-foreground"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-femfit-mid">
              Contact
            </p>
            <ul className="space-y-3">
              <li className="text-sm text-femfit-mid">Phnom Penh, Cambodia</li>
              <li>
                <a href="https://t.me/femfit" className="text-sm text-femfit-mid hover:text-foreground">
                  Telegram
                </a>
              </li>
              <li>
                <a href="https://facebook.com/femfit" className="text-sm text-femfit-mid hover:text-foreground">
                  Facebook
                </a>
              </li>
              <li>
                <a href="https://instagram.com/femfit" className="text-sm text-femfit-mid hover:text-foreground">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-femfit-border pt-8 md:flex-row">
          <p className="text-xs text-femfit-mid">
            &copy; {new Date().getFullYear()} FemFit. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <PaymentBadge label="ABA Pay" />
            <PaymentBadge label="KHQR" />
            <PaymentBadge label="COD" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function PaymentBadge({ label }: { label: string }) {
  return (
    <span className="rounded border border-femfit-border px-2 py-1 text-2xs font-medium text-femfit-mid">
      {label}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}