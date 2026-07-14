import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCartWithItems } from "@/lib/cart/queries";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/features/CheckoutForm";
import { listAddresses } from "@/lib/account/addresses";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your FemFit order.",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Must be logged in to checkout — per PRD §3.3
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect=/checkout");
  }

  // Google OAuth users may lack a phone — require it before checkout
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.phone) {
    redirect("/account/complete-profile?redirect=/checkout");
  }

  const cart = await getCartWithItems();
  const savedAddresses = await listAddresses();

  if (!cart || cart.isEmpty) {
    return (
      <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
        <div className="module flex flex-col items-center justify-center px-6 py-24 text-center">
          <p className="title-serif mb-2">Your cart is empty</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Add some items before checking out
          </p>
          <Link href="/products" className="btn-solid">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/cart" className="transition-colors hover:text-foreground">
          Cart
        </Link>
        <span>/</span>
        <span className="text-foreground">Checkout</span>
      </nav>
      <h1 className="title-serif mb-8">Checkout</h1>
      <CheckoutForm cart={cart} savedAddresses={savedAddresses} />
    </div>
  );
}
