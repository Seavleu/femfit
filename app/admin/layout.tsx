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
    { label: "Coupons", href: "/admin/coupons" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-16 items-center border-b border-gray-200 px-5">
          <Link href="/admin" className="text-lg font-semibold tracking-tight">FEMFIT</Link>
          <span className="ml-2 rounded bg-femfit-charcoal px-1.5 py-0.5 text-2xs font-medium text-white">Admin</span>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-gray-200 p-4">
          <p className="truncate text-xs text-gray-500">{profile.full_name ?? user.email}</p>
          <Link href="/" className="mt-1 block text-xs text-gray-400 hover:text-gray-600">← Back to store</Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
          <Link href="/admin" className="text-base font-semibold">FEMFIT Admin</Link>
          <Link href="/" className="text-xs text-gray-500">← Store</Link>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}