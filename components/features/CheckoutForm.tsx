"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createOrder } from "@/lib/orders/actions";
import { initiatePayment } from "@/lib/payments/actions";
import { CAMBODIA_PROVINCES, getShippingCents } from "@/lib/orders/schema";
import { formatMoney } from "@/lib/catalog/money";
import type { CartView } from "@/lib/cart/queries";
import type { AddressRow } from "@/lib/account/addresses";

interface Props {
  cart: CartView;
  savedAddresses: AddressRow[];
}

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-mono outline-none transition-colors focus:ring-1 focus:ring-foreground/20";

export function CheckoutForm({ cart, savedAddresses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultAddr = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
  const [mode, setMode] = useState<"saved" | "new">(
    savedAddresses.length > 0 ? "saved" : "new"
  );
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddr?.id ?? "");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+855");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [commune, setCommune] = useState("");
  const [street, setStreet] = useState("");
  const [notes, setNotes] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "aba_payway">("cod");

  const selectedSaved = savedAddresses.find((a) => a.id === selectedAddressId);
  const effectiveProvince =
    mode === "saved" ? selectedSaved?.province ?? "" : province;
  const shippingCents = effectiveProvince
    ? getShippingCents(effectiveProvince)
    : 0;
  const totalCents = cart.subtotal.amount + shippingCents;

  const isFormValid =
    mode === "saved"
      ? Boolean(selectedAddressId)
      : Boolean(province && fullName && phone && district && street);

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const orderResult = await createOrder(
        mode === "saved"
          ? {
              paymentMethod,
              addressId: selectedAddressId,
              customerNote: notes || undefined,
              idempotencyKey: crypto.randomUUID(),
            }
          : {
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
            }
      );

      if (!orderResult.ok) {
        setError(orderResult.error.detail || orderResult.error.title);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (paymentMethod === "cod") {
        router.push(`/checkout/success?order=${orderResult.data.orderId}`);
        return;
      }

      const paymentResult = await initiatePayment(orderResult.data.orderId);
      if (!paymentResult.ok) {
        setError(paymentResult.error.detail || paymentResult.error.title);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      window.location.href = paymentResult.data.redirectUrl;
    });
  }

  return (
    <div className="flex flex-col gap-10 lg:flex-row">
      <div className="flex-1 space-y-8">
        {error && (
          <div
            className="rounded-xl border border-rose-femfit/30 bg-rose-femfit/10 px-4 py-3 text-sm text-rose-femfit"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="module p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="label-mono">Shipping Address</h2>
            {savedAddresses.length > 0 && (
              <Link
                href="/account/addresses"
                className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
              >
                Manage
              </Link>
            )}
          </div>

          {savedAddresses.length > 0 && (
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("saved")}
                className={`h-9 rounded-xl px-3 font-mono text-2xs uppercase tracking-[0.1em] ${
                  mode === "saved"
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground"
                }`}
              >
                Saved
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`h-9 rounded-xl px-3 font-mono text-2xs uppercase tracking-[0.1em] ${
                  mode === "new"
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground"
                }`}
              >
                New address
              </button>
            </div>
          )}

          {mode === "saved" && savedAddresses.length > 0 ? (
            <div className="space-y-3">
              {savedAddresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${
                    selectedAddressId === a.id
                      ? "border-foreground bg-muted"
                      : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="savedAddress"
                    checked={selectedAddressId === a.id}
                    onChange={() => setSelectedAddressId(a.id)}
                    className="mt-1 accent-foreground"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {a.recipientName}
                      {a.isDefault && (
                        <span className="ml-2 font-mono text-2xs uppercase text-muted-foreground">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-2xs text-muted-foreground">{a.phone}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[a.streetDetail, a.commune, a.district, a.province]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </label>
              ))}
              <label className="block space-y-1.5">
                <span className="label-mono">Delivery notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none py-2`}
                  placeholder="Call on arrival, landmark…"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="label-mono mb-1.5 block">
                    Full name *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Sok Dara"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="label-mono mb-1.5 block">
                    Phone *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="+85512345678"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="province" className="label-mono mb-1.5 block">
                  Province *
                </label>
                <select
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select province</option>
                  {CAMBODIA_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="district" className="label-mono mb-1.5 block">
                    District *
                  </label>
                  <input
                    id="district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Chamkarmon"
                  />
                </div>
                <div>
                  <label htmlFor="commune" className="label-mono mb-1.5 block">
                    Commune
                  </label>
                  <input
                    id="commune"
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className={inputClass}
                    placeholder="Tonle Bassac"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="street" className="label-mono mb-1.5 block">
                  Street address *
                </label>
                <input
                  id="street"
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="#12, St. 240, Sangkat Chaktomuk"
                />
              </div>

              <div>
                <label htmlFor="notes" className="label-mono mb-1.5 block">
                  Delivery notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none py-2`}
                  placeholder="Building name, floor, landmark..."
                />
              </div>
            </div>
          )}
        </section>

        <section className="module p-6 md:p-8">
          <h2 className="label-mono mb-4">Payment Method</h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-foreground bg-muted px-4 py-3">
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="accent-foreground"
              />
              <div>
                <p className="text-sm font-medium">Cash on Delivery</p>
                <p className="text-xs text-muted-foreground">
                  Pay when you receive your order
                </p>
              </div>
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 opacity-60">
              <input type="radio" disabled className="accent-foreground" />
              <div>
                <p className="text-sm font-medium">ABA PayWay</p>
                <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
                  Coming later — digital pay deferred
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:w-80 lg:flex-shrink-0">
        <div className="module sticky top-24 p-6">
          <h2 className="label-mono mb-4">Order Summary</h2>

          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="font-mono text-2xs text-muted-foreground">
                    {item.variantLabel} × {item.quantity}
                  </p>
                </div>
                <span className="flex-shrink-0 font-mono text-sm">
                  {item.lineTotal.display}
                </span>
              </div>
            ))}
          </div>

          <dl className="space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono font-medium">{cart.subtotal.display}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-mono font-medium">
                {effectiveProvince
                  ? formatMoney(shippingCents, cart.subtotal.currency).display
                  : "Select address"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="font-medium">Total</dt>
              <dd className="font-mono text-base font-medium">
                {effectiveProvince
                  ? formatMoney(totalCents, cart.subtotal.currency).display
                  : cart.subtotal.display}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
            className="btn-solid mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Processing..."
              : paymentMethod === "cod"
                ? "Place Order — Cash on Delivery"
                : "Pay with ABA PayWay"}
          </button>

          <p className="mt-3 text-center font-mono text-2xs text-muted-foreground">
            By placing this order you agree to our Terms of Service
          </p>
        </div>
      </aside>
    </div>
  );
}
