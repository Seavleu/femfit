import Link from "next/link";
import type { Metadata } from "next";
import { getCartWithItems } from "@/lib/cart/queries";
import { CartLineItem } from "@/components/features/CartLineItem";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your FemFit shopping cart.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getCartWithItems();
  const isEmpty = !cart || cart.isEmpty;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">Cart</span>
      </nav>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-2">Bag</p>
          <h1 className="title-serif">Your cart</h1>
        </div>
        {!isEmpty && (
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
            {cart!.itemCount} item{cart!.itemCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {isEmpty ? (
        <div className="module flex flex-col items-center justify-center px-6 py-24 text-center">
          <p className="title-serif mb-2">Cart is empty</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Browse the collection and add pieces you love.
          </p>
          <Link href="/products" className="btn-solid">
            Shop now
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="module p-4 md:p-6 lg:col-span-8">
            <div className="divide-y divide-border">
              {cart!.items.map((item) => (
                <CartLineItem key={item.id} item={item} />
              ))}
            </div>
          </div>

          <aside className="module h-fit p-5 md:p-6 lg:col-span-4 lg:sticky lg:top-24">
            <p className="label-mono mb-4">Summary</p>
            <div className="space-y-3 border-b border-border pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono text-xs tracking-wide">
                  {cart!.subtotal.display}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                  Calculated at checkout
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="font-serif text-xl">Total</span>
              <span className="font-mono text-sm tracking-wide">
                {cart!.subtotal.display}
              </span>
            </div>
            <Link href="/checkout" className="btn-solid w-full">
              Checkout
            </Link>
            <Link
              href="/products"
              className="mt-3 block text-center font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Continue shopping →
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
