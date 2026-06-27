import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Guest cart session management.
 *
 * Per DB Schema §6.5 carts can be owned by either:
 *   - A logged-in user (carts.user_id is set)
 *   - A guest session (carts.session_token is set, user_id is null)
 *
 * The session token is stored in an httpOnly cookie so it survives across
 * page loads and tabs but is not accessible to client JavaScript. When the
 * user logs in, mergeGuestCart() merges the guest cart_items into the
 * user's cart and the cookie is cleared.
 */

const SESSION_COOKIE_NAME = "femfit_cart_session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Read the guest session token from cookies, if present.
 * Returns null for users who have not yet started a cart.
 */
export async function getGuestSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Get the existing guest session token or create a new one.
 * Always returns a token. Sets the cookie if a new one is generated.
 */
export async function ensureGuestSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = randomUUID();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });
  return token;
}

/**
 * Clear the guest session cookie. Called after merging the guest cart
 * into the user's cart on login.
 */
export async function clearGuestSessionToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}