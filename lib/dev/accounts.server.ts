import type { DevAccountKey } from "@/lib/dev/accounts";

/**
 * Server-only credentials for explicit local accounts.
 * Do not import this module from client components.
 */

export interface DevAccount {
  key: DevAccountKey;
  email: string;
  password: string;
  phone: string;
  fullName: string;
  isAdmin: boolean;
}

export const DEV_ACCOUNTS: Record<DevAccountKey, DevAccount> = {
  dev1: {
    key: "dev1",
    email: "dev1@femfit.local",
    password: "dev1dev1",
    phone: "+855100000001",
    fullName: "Dev Customer",
    isAdmin: false,
  },
  dev2: {
    key: "dev2",
    email: "dev2@femfit.local",
    password: "dev2dev2",
    phone: "+855100000002",
    fullName: "Dev Admin",
    isAdmin: true,
  },
};
