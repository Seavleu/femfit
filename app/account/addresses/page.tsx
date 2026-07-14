import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAddresses } from "@/lib/account/addresses";
import { AddressBook } from "@/components/features/AddressBook";

export const metadata: Metadata = { title: "Addresses" };
export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/account/addresses");

  const addresses = await listAddresses();

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        <Link href="/account" className="hover:text-foreground">
          Account
        </Link>
        <span>/</span>
        <span className="text-foreground">Addresses</span>
      </nav>
      <p className="label-mono mb-2">Delivery</p>
      <h1 className="title-serif mb-6">Addresses</h1>
      <AddressBook initialAddresses={addresses} />
    </div>
  );
}
