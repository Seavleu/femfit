"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/orders/actions";
import { initiatePayment } from "@/lib/payments/actions";
import { CAMBODIA_PROVINCES, getShippingCents } from "@/lib/orders/schema";
import { formatMoney } from "@/lib/catalog/money";
import type { CartView } from "@/lib/cart/queries";

interface Props {
  cart: CartView;
}

export function CheckoutForm({ cart }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Address fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+855");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [commune, setCommune] = useState("");
  const [street, setStreet] = useState("");
  const [notes, setNotes] = useState("");

  // Payment method — both COD and ABA now available
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "aba_payway">("cod");

  const shippingCents = province ? getShippingCents(province) : 0;
  const totalCents = cart.subtotal.amount + shippingCents;

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      // 1. Create the order
      const orderResult = await createOrder({
        paymentMethod,
        shippingAddress: {
          fullName,
          phone,
          province: province as (typeof CAMBODIA_PROVINCES)[number],
          district,
          commune: commune || undefined,
          street,
          notes: notes || undefined,
        },
        idempotencyKey: crypto.randomUUID(),
      });

      if (!orderResult.ok) {
        setError(orderResult.error.detail || orderResult.error.title);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // 2. COD → success page directly
      if (paymentMethod === "cod") {
        router.push(`/checkout/success?order=${orderResult.data.orderId}`);
        return;
      }

      // 3. ABA → create payment session and redirect to ABA
      const paymentResult = await initiatePayment(orderResult.data.orderId);

      if (!paymentResult.ok) {
        setError(paymentResult.error.detail || paymentResult.error.title);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Redirect to ABA's hosted checkout page
      window.location.href = paymentResult.data.redirectUrl;
    });
  }

  const isFormValid = province && fullName && phone && district && street;

  return (
    <div className="flex flex-col gap-10 lg:flex-row">
      {/* Left: Form */}
      <div className="flex-1 space-y-8">
        {error && (
          <div
            className="rounded-md border border-rose-femfit/30 bg-rose-femfit/10 px-4 py-3 text-sm text-rose-femfit"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Shipping address */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-femfit-mid">
            Shipping Address
          </h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                  Full name *
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
                  placeholder="Sok Dara"
                />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                  Phone *
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
                  placeholder="+85512345678"
                />
              </div>
            </div>

            <div>
              <label htmlFor="province" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                Province *
              </label>
              <select
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
              >
                <option value="">Select province</option>
                {CAMBODIA_PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="district" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                  District *
                </label>
                <input
                  id="district"
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
                  placeholder="Chamkarmon"
                />
              </div>
              <div>
                <label htmlFor="commune" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                  Commune
                </label>
                <input
                  id="commune"
                  type="text"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
                  placeholder="Tonle Bassac"
                />
              </div>
            </div>

            <div>
              <label htmlFor="street" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                Street address *
              </label>
              <input
                id="street"
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-femfit-border bg-white px-3 text-sm outline-none transition-colors focus:border-femfit-charcoal"
                placeholder="#12, St. 240, Sangkat Chaktomuk"
              />
            </div>

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                Delivery notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-femfit-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-femfit-charcoal resize-none"
                placeholder="Building name, floor, landmark..."
              />
            </div>
          </div>
        </section>

        {/* Payment method */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-femfit-mid">
            Payment Method
          </h2>
          <div className="space-y-3">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                paymentMethod === "cod"
                  ? "border-femfit-charcoal bg-femfit-gray/50"
                  : "border-femfit-border hover:border-femfit-mid"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="accent-femfit-charcoal"
              />
              <div>
                <p className="text-sm font-medium">Cash on Delivery</p>
                <p className="text-xs text-femfit-mid">
                  Pay when you receive your order
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                paymentMethod === "aba_payway"
                  ? "border-femfit-charcoal bg-femfit-gray/50"
                  : "border-femfit-border hover:border-femfit-mid"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="aba_payway"
                checked={paymentMethod === "aba_payway"}
                onChange={() => setPaymentMethod("aba_payway")}
                className="accent-femfit-charcoal"
              />
              <div>
                <p className="text-sm font-medium">ABA PayWay</p>
                <p className="text-xs text-femfit-mid">
                  Pay with ABA, KHQR, or card — instant confirmation
                </p>
              </div>
            </label>
          </div>
        </section>
      </div>

      {/* Right: Order summary */}
      <aside className="lg:w-80 lg:flex-shrink-0">
        <div className="sticky top-24 rounded-lg border border-femfit-border bg-white p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-femfit-mid">
            Order Summary
          </h2>

          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="text-xs text-femfit-mid">
                    {item.variantLabel} × {item.quantity}
                  </p>
                </div>
                <span className="flex-shrink-0">{item.lineTotal.display}</span>
              </div>
            ))}
          </div>

          <dl className="space-y-3 border-t border-femfit-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-femfit-mid">Subtotal</dt>
              <dd className="font-medium">{cart.subtotal.display}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-femfit-mid">Shipping</dt>
              <dd className="font-medium">
                {province
                  ? formatMoney(shippingCents, cart.subtotal.currency).display
                  : "Select province"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-femfit-border pt-3">
              <dt className="font-medium">Total</dt>
              <dd className="text-base font-medium">
                {province
                  ? formatMoney(totalCents, cart.subtotal.currency).display
                  : cart.subtotal.display}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-femfit-charcoal text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Processing..."
              : paymentMethod === "cod"
                ? "Place Order — Cash on Delivery"
                : "Pay with ABA PayWay"}
          </button>

          <p className="mt-3 text-center text-xs text-femfit-mid">
            By placing this order you agree to our Terms of Service
          </p>
        </div>
      </aside>
    </div>
  );
}