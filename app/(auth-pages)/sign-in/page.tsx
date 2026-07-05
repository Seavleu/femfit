"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mergeGuestCart } from "@/lib/cart/actions";

/**
 * Phone OTP sign-in — per PRD §3.6 and API Spec §7.3.
 *
 * Flow:
 *   1. User enters phone number (+855 format enforced)
 *   2. Supabase Auth sends OTP via SMS provider (configured in Dashboard)
 *   3. User enters 6-digit code
 *   4. On success: merge guest cart, redirect to `redirect` param or home
 *
 * Rate limiting per Sys Design §9.1 (3 OTP/hr/phone) is enforced
 * server-side in Supabase Auth settings + our rate limiter middleware.
 */

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+855");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  function normalizePhone(input: string): string | null {
    // Accept +855XXXXXXXX, 855XXXXXXXX, 0XXXXXXXX (local format)
    let p = input.replace(/[\s-]/g, "");
    if (p.startsWith("0")) p = "+855" + p.slice(1);
    else if (p.startsWith("855")) p = "+" + p;
    else if (!p.startsWith("+855")) return null;
    // +855 followed by 8-9 digits
    if (!/^\+855\d{8,9}$/.test(p)) return null;
    return p;
  }

  function sendOtp() {
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Enter a valid Cambodian phone number (e.g. +85512345678 or 012345678)");
      return;
    }

    startTransition(async () => {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });
      if (otpError) {
        // Rate limit errors come through here too
        setError(
          otpError.message.includes("rate")
            ? "Too many attempts. Please wait before requesting another code."
            : otpError.message
        );
        return;
      }
      setPhone(normalized);
      setStep("otp");
    });
  }

  function verifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code sent to your phone");
      return;
    }

    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (verifyError) {
        setError(
          verifyError.message.includes("expired")
            ? "Code expired. Request a new one."
            : "Invalid code. Please check and try again."
        );
        return;
      }

      // Merge guest cart into user cart — per cart milestone design
      await mergeGuestCart();

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-femfit-warm px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            {step === "phone" ? "Sign in" : "Enter code"}
          </h1>
          <p className="mt-2 text-sm text-femfit-mid">
            {step === "phone"
              ? "We'll send a verification code to your phone"
              : `Code sent to ${phone}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-femfit/30 bg-rose-femfit/10 px-4 py-3 text-sm text-rose-femfit" role="alert">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="+85512345678"
                autoFocus
                className="h-12 w-full rounded-md border border-femfit-border bg-white px-4 text-sm outline-none transition-colors focus:border-femfit-charcoal"
              />
            </div>
            <button
              type="button"
              onClick={sendOtp}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center rounded-md bg-femfit-charcoal text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send code"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="otp" className="mb-1.5 block text-xs font-medium text-femfit-mid">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                placeholder="123456"
                autoFocus
                className="h-12 w-full rounded-md border border-femfit-border bg-white px-4 text-center text-lg tracking-[0.5em] outline-none transition-colors focus:border-femfit-charcoal"
              />
            </div>
            <button
              type="button"
              onClick={verifyOtp}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center rounded-md bg-femfit-charcoal text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Verifying..." : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setOtp(""); setError(null); }}
              className="w-full text-center text-xs text-femfit-mid hover:text-foreground"
            >
              ← Use a different number
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-femfit-mid">
          By continuing you agree to FemFit&apos;s{" "}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}