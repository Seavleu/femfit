/**
 * Client-safe dev account metadata (no passwords).
 * Full credentials live in lib/dev/accounts.server.ts (server-only).
 */

export type DevAccountKey = "dev1" | "dev2";

export const DEV_ACCOUNT_OPTIONS: Array<{
  key: DevAccountKey;
  label: string;
  description: string;
}> = [
  {
    key: "dev1",
    label: "dev1 — Customer",
    description: "Storefront shopper. No admin access.",
  },
  {
    key: "dev2",
    label: "dev2 — Admin",
    description: "Full admin access to orders, products, inventory, reviews.",
  },
];

export function isDevLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true"
  );
}
