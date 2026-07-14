import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | FemFit Admin" },
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/admin");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Products", href: "/admin/products" },
    { label: "Reviews", href: "/admin/reviews" },
    { label: "Inventory", href: "/admin/inventory" },
  ];

  return (
    <div className="dot-grid flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 p-4 lg:block">
        <div className="module flex h-full flex-col">
          <div className="border-b border-border px-5 py-5">
            <Link href="/admin" className="brand-dot flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-foreground" aria-hidden="true" />
              FEMFIT
            </Link>
            <span className="label-mono mt-2 block normal-case tracking-[0.12em]">Admin</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-4">
            <p className="truncate text-xs text-muted-foreground">{profile.full_name ?? user.email}</p>
            <Link href="/" className="label-mono mt-2 block normal-case tracking-[0.12em] hover:text-foreground">
              ← Back to store
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 px-3 py-3 lg:hidden">
          <div className="module flex h-14 items-center justify-between px-4">
            <Link href="/admin" className="brand-dot flex items-center gap-2 text-xs">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden="true" />
              FEMFIT
            </Link>
            <Link href="/" className="label-mono normal-case tracking-[0.12em]">← Store</Link>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-2 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="module-muted flex-shrink-0 rounded-xl px-3 py-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-3 pb-8 pt-2 md:px-6 md:pb-10 md:pt-4">{children}</main>
      </div>
    </div>
  );
}
