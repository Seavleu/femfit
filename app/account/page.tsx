import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

/**
 * Account overview — per PRD §3.4.
 * Shows profile summary and links to orders and addresses.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/account");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  const { count: orderCount } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const sections = [
    { title: "My Orders", desc: `${orderCount ?? 0} orders`, href: "/account/orders" },
    { title: "Addresses", desc: "Manage delivery addresses", href: "/account/addresses" },
  ];

  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="border-b border-femfit-border">
        <div className="container py-8 md:py-12">
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">My Account</h1>
          <p className="mt-2 text-sm text-femfit-mid">
            {profile?.full_name ?? profile?.phone ?? user.phone ?? user.email}
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {sections.map((s) => (
            <Link key={s.href} href={s.href}
              className="rounded-lg border border-femfit-border bg-white p-6 transition-shadow hover:shadow-sm">
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-femfit-mid">{s.desc}</p>
            </Link>
          ))}
        </div>

        <form action="/auth/sign-out" method="post" className="mt-8">
          <button type="submit" className="text-sm text-femfit-mid underline-offset-2 hover:text-foreground hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}