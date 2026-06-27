import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCartWithItems } from "@/lib/cart/queries";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/features/CheckoutForm";

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
    // Redirect to sign-in with return URL
    redirect("/sign-in?redirect=/checkout");
  }

  const cart = await getCartWithItems();

  if (!cart || cart.isEmpty) {
    return (
      <div className="min-h-screen bg-femfit-warm">
        <div className="container flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-lg font-medium">Your cart is empty</p>
          <p className="mb-6 text-sm text-femfit-mid">
            Add some items before checking out
          </p>
          <Link
            href="/products"
            className="rounded-md bg-femfit-charcoal px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="border-b border-femfit-border bg-femfit-warm">
        <div className="container py-8 md:py-12">
          <nav className="mb-3 flex items-center gap-2 text-xs text-femfit-mid">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>/</span>
            <Link href="/cart" className="hover:text-foreground">
              Cart
            </Link>
            <span>/</span>
            <span className="text-foreground">Checkout</span>
          </nav>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
            Checkout
          </h1>
        </div>
      </div>

      <div className="container py-8">
        <CheckoutForm cart={cart} />
      </div>
    </div>
  );
}