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
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <div className="mb-8">
        <h1 className="title-serif">My Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile?.full_name ?? profile?.phone ?? user.phone ?? user.email}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="module p-6 transition-colors hover:bg-muted/30"
          >
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>

      <form action="/auth/sign-out" method="post" className="mt-8">
        <button
          type="submit"
          className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
