"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex items-center rounded-xl border border-border bg-card px-5 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-foreground">
          You&apos;re on the list. We&apos;ll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+855 12 345 678"
        className="h-12 flex-1 rounded-xl border border-border bg-card px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
      />
      <button type="submit" className="btn-solid shrink-0">
        Subscribe
      </button>
    </form>
  );
}
