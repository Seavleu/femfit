"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mergeGuestCart } from "@/lib/cart/actions";
import { getDevLoginCredentials } from "@/lib/dev/actions";
import { DEV_ACCOUNT_OPTIONS, isDevLoginEnabled } from "@/lib/dev/accounts";
import type { DevAccountKey } from "@/lib/dev/accounts";

/**
 * Sign-in — phone OTP (PRD §3.6) + Google OAuth.
 *
 * Phone flow:
 *   1. User enters +855 phone → OTP via SMS
 *   2. Verify 6-digit code → mergeGuestCart → redirect
 *
 * Google flow:
 *   Continue with Google → /auth/callback exchanges code, merges cart, redirects
 */

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-mono outline-none transition-colors focus:ring-1 focus:ring-foreground/20";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const oauthError = searchParams.get("error") === "oauth";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+855");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? "Google sign-in failed. Please try again." : null
  );
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  function normalizePhone(input: string): string | null {
    let p = input.replace(/[\s-]/g, "");
    if (p.startsWith("0")) p = "+855" + p.slice(1);
    else if (p.startsWith("855")) p = "+" + p;
    else if (!p.startsWith("+855")) return null;
    if (!/^\+855\d{8,9}$/.test(p)) return null;
    return p;
  }

  function signInAsDev(key: DevAccountKey) {
    setError(null);
    startTransition(async () => {
      const creds = await getDevLoginCredentials(key);
      if (!creds.ok) {
        setError(creds.error);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (signInError) {
        setError(
          `${signInError.message} — run pnpm db:seed to create ${key}.`
        );
        return;
      }

      await mergeGuestCart();
      const dest =
        redirectTo && redirectTo !== "/"
          ? redirectTo
          : creds.redirectTo;
      router.push(dest);
      router.refresh();
    });
  }

  function signInWithGoogle() {
    setError(null);
    startTransition(async () => {
      // Store return path in a cookie (readable by the server callback).
      // Keep redirectTo URL clean for Supabase allowlist matching.
      document.cookie = `femfit_auth_redirect=${encodeURIComponent(redirectTo)}; path=/; max-age=600; samesite=lax`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (oauthErr) {
        setError(oauthErr.message || "Could not start Google sign-in.");
      }
    });
  }

  function sendOtp() {
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError(
        "Enter a valid Cambodian phone number (e.g. +85512345678 or 012345678)"
      );
      return;
    }

    startTransition(async () => {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });
      if (otpError) {
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

      await mergeGuestCart();
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="module p-6 md:p-8">
        <div className="mb-8 text-center">
          <h1 className="title-serif">
            {step === "phone" ? "Sign in" : "Enter code"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "phone"
              ? "Continue with Google or verify with your phone"
              : `Code sent to ${phone}`}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl border border-rose-femfit/30 bg-rose-femfit/10 px-4 py-3 text-sm text-rose-femfit"
            role="alert"
          >
            {error}
          </div>
        )}

        {step === "phone" && isDevLoginEnabled() && (
          <div className="mb-6 space-y-2">
            <p className="label-mono mb-2">Dev accounts</p>
            {DEV_ACCOUNT_OPTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => signInAsDev(a.key)}
                  disabled={isPending}
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-foreground">
                    {a.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.description}</span>
                </button>
              ))}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        {step === "phone" && (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-femfit-border bg-femfit-warm px-4 font-mono text-xs font-medium uppercase tracking-[0.12em] text-femfit-charcoal transition-colors hover:bg-muted disabled:opacity-50"
            >
              <GoogleIcon />
              {isPending ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {step === "phone" ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="label-mono mb-1.5 block">
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
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={sendOtp}
              disabled={isPending}
              className="btn-solid w-full disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send code"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="otp" className="label-mono mb-1.5 block">
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
                className={`${inputClass} text-center text-lg tracking-[0.5em]`}
              />
            </div>
            <button
              type="button"
              onClick={verifyOtp}
              disabled={isPending}
              className="btn-solid w-full disabled:opacity-50"
            >
              {isPending ? "Verifying..." : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
              className="w-full font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Use a different number
            </button>
          </div>
        )}

        <p className="mt-8 text-center font-mono text-2xs text-muted-foreground">
          By continuing you agree to FemFit&apos;s{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
