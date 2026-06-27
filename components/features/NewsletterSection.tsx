"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    // TODO: wire to /api/v1/notifications or a simple Supabase insert
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center rounded-md border border-white/20 px-6 py-4">
        <p className="text-sm text-white/80">
          ✓ You&apos;re on the list. We&apos;ll be in touch!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row"
    >
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+855 12 345 678"
        className="h-12 flex-1 rounded-md border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
      />
      <button
        type="submit"
        className="h-12 rounded-md bg-rose-femfit px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Subscribe
      </button>
    </form>
  );
}