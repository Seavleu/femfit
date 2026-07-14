import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Returns & Exchanges" };

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 pb-16 pt-8 md:px-6">
      <p className="label-mono mb-2">Policies</p>
      <h1 className="title-serif mb-6">Returns & exchanges</h1>
      <div className="module space-y-5 p-6 md:p-8 text-sm leading-relaxed text-muted-foreground">
        <p>
          Unworn items with tags attached can be returned or exchanged within{" "}
          <span className="text-foreground">7 days</span> of delivery. Contact
          us with your order number before sending anything back.
        </p>
        <p>
          COD refusals and cancelled orders before packing are handled in your{" "}
          <Link href="/account/orders" className="underline underline-offset-4 text-foreground">
            order history
          </Link>
          . Refunds for paid orders are processed manually once ABA PayWay is
          live; until then we coordinate via Telegram.
        </p>
        <p>
          Hygiene items (underwear, socks) and sale items marked final sale are
          not returnable.
        </p>
        <Link href="/help" className="btn-ghost inline-flex">
          ← Help
        </Link>
      </div>
    </div>
  );
}
