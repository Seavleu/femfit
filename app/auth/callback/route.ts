import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mergeGuestCart } from "@/lib/cart/actions";

/**
 * Google OAuth PKCE callback.
 * Exchanges the auth code for a session, ensures a profiles row exists
 * (phone may be null until checkout), merges any guest cart, then
 * redirects to the path stored in the femfit_auth_redirect cookie (or `/`).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieStore = await cookies();
  const rawRedirect =
    searchParams.get("redirect") ??
    cookieStore.get("femfit_auth_redirect")?.value ??
    "/";

  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  if (oauthError) {
    console.error("[auth/callback] provider error", {
      oauthError,
      errorDescription,
    });
    const res = NextResponse.redirect(new URL("/sign-in?error=oauth", origin));
    res.cookies.delete("femfit_auth_redirect");
    return res;
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = createServiceRoleClient();
        const { data: existing } = await admin
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!existing) {
          await admin.from("profiles").insert({
            id: user.id,
            email: user.email ?? null,
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              null,
            phone: null,
          });
        }
      }

      await mergeGuestCart();
      const res = NextResponse.redirect(new URL(redirectTo, origin));
      res.cookies.delete("femfit_auth_redirect");
      return res;
    }

    console.error("[auth/callback] exchangeCodeForSession", error);
  }

  const res = NextResponse.redirect(new URL("/sign-in?error=oauth", origin));
  res.cookies.delete("femfit_auth_redirect");
  return res;
}
