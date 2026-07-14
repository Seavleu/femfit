"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { updateProfilePhone } from "@/lib/account/actions";

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-mono outline-none transition-colors focus:ring-1 focus:ring-foreground/20";

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/checkout";

  const [phone, setPhone] = useState("+855");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateProfilePhone({ phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const safe =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/checkout";
      router.push(safe);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm px-3 pb-10 pt-6 md:px-6">
      <div className="module p-6 md:p-8">
        <p className="label-mono mb-2 text-center">Almost there</p>
        <h1 className="title-serif text-center">Add your phone</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We need a Cambodian mobile number for delivery updates and COD
          confirmation calls.
        </p>

        {error && (
          <div
            className="mt-4 rounded-xl border border-rose-femfit/30 bg-rose-femfit/10 px-4 py-3 text-sm text-rose-femfit"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="phone" className="label-mono mb-1.5 block">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="+85512345678"
              autoFocus
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="btn-solid w-full disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save and continue"}
          </button>
          <Link
            href="/account"
            className="block text-center font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            ← Back to account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}
