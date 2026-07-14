import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { SearchBarClient } from "@/components/features/SearchBar";
import { RegisterServiceWorker } from "@/components/features/RegisterServiceWorker";
import { getCartItemCount } from "@/lib/cart/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FemFit", template: "%s | FemFit" },
  description: "Premium gymnastic and activewear for Cambodia.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FemFit",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.svg" }],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <html
      lang="en"
      className={`${geist.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="dot-grid min-h-screen font-sans text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {!isAdmin && <SiteHeader />}
          <main className="relative z-0">{children}</main>
          {!isAdmin && <SiteFooter />}
          <RegisterServiceWorker />
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
    { label: "New", href: "/products?sort=newest" },
  ];

  let cartCount = 0;
  try {
    cartCount = await getCartItemCount();
  } catch (err) {
    console.error("[SiteHeader] failed to load cart count", err);
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 md:px-6 md:pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur-md md:px-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="brand-dot text-foreground">
            FEMFIT
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden flex-1 max-w-xs md:block lg:max-w-sm">
          <SearchBarClient size="small" />
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <SearchIcon />
          </Link>
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
          >
            Sign in
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ""}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BagIcon />
            {cartCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] font-medium text-background"
                aria-hidden="true"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
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
  const helpLinks = [
    { label: "Track Order", href: "/account/orders" },
    { label: "Returns", href: "/returns" },
    { label: "Sizing Guide", href: "/size-guide" },
    { label: "Contact Us", href: "/help" },
  ];

  return (
    <footer className="relative z-0 mt-8 border-t border-border/60 px-3 pb-8 pt-10 md:px-6">
      <div className="module mx-auto max-w-6xl p-6 md:p-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="brand-dot">FEMFIT</p>
            <p className="mt-4 font-serif text-lg leading-snug text-foreground/80">
              Activewear engineered for Cambodia&apos;s athletes.
            </p>
          </div>

          <div>
            <p className="label-mono mb-4">Shop</p>
            <ul className="space-y-2.5">
              {shopLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-mono mb-4">Help</p>
            <ul className="space-y-2.5">
              {helpLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-mono mb-4">Contact</p>
            <ul className="space-y-2.5">
              <li className="text-sm text-muted-foreground">Phnom Penh, Cambodia</li>
              <li>
                <a href="https://t.me/femfit" className="text-sm text-muted-foreground hover:text-foreground">
                  Telegram
                </a>
              </li>
              <li>
                <a href="https://facebook.com/femfit" className="text-sm text-muted-foreground hover:text-foreground">
                  Facebook
                </a>
              </li>
              <li>
                <a href="https://instagram.com/femfit" className="text-sm text-muted-foreground hover:text-foreground">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 md:flex-row md:items-center">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
            &copy; {new Date().getFullYear()} FemFit
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
    <span className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="20" y1="8" y2="8" />
      <line x1="4" x2="20" y1="16" y2="16" />
    </svg>
  );
}
