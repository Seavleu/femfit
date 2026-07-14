import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isDevLoginEnabled, type DevAccountKey } from "@/lib/dev/accounts";
import { DEV_ACCOUNTS } from "@/lib/dev/accounts.server";

/**
 * Ensure a single dev auth user + profile exist.
 * Idempotent — safe to run on every seed. Not a server action (used by tsx seed).
 */
export async function ensureDevAccount(key: DevAccountKey): Promise<{
  userId: string;
  created: boolean;
}> {
  const account = DEV_ACCOUNTS[key];
  const admin = createServiceRoleClient();

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === account.email.toLowerCase()
  );

  let userId: string;
  let created = false;

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password: account.password,
      email_confirm: true,
      phone: account.phone,
      phone_confirm: true,
      user_metadata: { full_name: account.fullName, dev_key: account.key },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      phone: account.phone,
      phone_confirm: true,
      user_metadata: { full_name: account.fullName, dev_key: account.key },
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create ${account.key}: ${error?.message ?? "unknown error"}`
      );
    }
    userId = data.user.id;
    created = true;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: account.email,
      phone: account.phone,
      full_name: account.fullName,
      is_admin: account.isAdmin,
      preferred_currency: "USD",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(
      `Failed to upsert profile for ${account.key}: ${profileError.message}`
    );
  }

  return { userId, created };
}

export async function ensureAllDevAccounts() {
  if (!isDevLoginEnabled() && process.env.FORCE_SEED_DEV_ACCOUNTS !== "true") {
    console.log(
      "Skipping dev accounts (set FORCE_SEED_DEV_ACCOUNTS=true to seed outside development)."
    );
    return;
  }

  for (const key of Object.keys(DEV_ACCOUNTS) as DevAccountKey[]) {
    const result = await ensureDevAccount(key);
    const a = DEV_ACCOUNTS[key];
    console.log(
      `  ✓ ${a.key} (${a.isAdmin ? "admin" : "customer"}) ${result.created ? "created" : "updated"} — ${a.email} / ${a.password}`
    );
  }
}
