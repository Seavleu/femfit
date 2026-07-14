"use server";

import { z } from "zod";
import { isDevLoginEnabled } from "@/lib/dev/accounts";
import { DEV_ACCOUNTS } from "@/lib/dev/accounts.server";

const keySchema = z.enum(["dev1", "dev2"]);

/**
 * Returns credentials for the client-side password sign-in.
 * Only available when dev login is enabled.
 */
export async function getDevLoginCredentials(key: string): Promise<
  | { ok: true; email: string; password: string; redirectTo: string }
  | { ok: false; error: string }
> {
  if (!isDevLoginEnabled()) {
    return { ok: false, error: "Dev login is disabled." };
  }

  const parsed = keySchema.safeParse(key);
  if (!parsed.success) {
    return { ok: false, error: "Unknown dev account." };
  }

  const account = DEV_ACCOUNTS[parsed.data];
  return {
    ok: true,
    email: account.email,
    password: account.password,
    redirectTo: account.isAdmin ? "/admin" : "/",
  };
}
