import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 pb-16 pt-8 md:px-6">
      <p className="label-mono mb-2">Support</p>
      <h1 className="title-serif mb-6">Help</h1>
      <div className="module space-y-6 p-6 md:p-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Questions about orders, sizing, or delivery in Cambodia? Reach us on
          Telegram or Facebook — we reply during business hours in Phnom Penh.
        </p>
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/account/orders" className="underline underline-offset-4">
              Track your order
            </Link>{" "}
            — status updates are set by our team when the courier collects or
            delivers (no live courier API).
          </li>
          <li>
            <Link href="/returns" className="underline underline-offset-4">
              Returns & exchanges
            </Link>
          </li>
          <li>
            <Link href="/size-guide" className="underline underline-offset-4">
              Size guide
            </Link>
          </li>
          <li>
            <a
              href="https://t.me/femfit"
              className="underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Telegram @femfit
            </a>
          </li>
          <li>
            <a href="mailto:hello@femfit.kh" className="underline underline-offset-4">
              hello@femfit.kh
            </a>{" "}
            — email replies (SMS notifications come later).
          </li>
        </ul>
        <Link href="/products" className="btn-ghost inline-flex">
          ← Continue shopping
        </Link>
      </div>
    </div>
  );
}
