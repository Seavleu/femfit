"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const phoneSchema = z
  .string()
  .trim()
  .transform((raw) => {
    let p = raw.replace(/[\s-]/g, "");
    if (p.startsWith("0")) p = "+855" + p.slice(1);
    else if (p.startsWith("855")) p = "+" + p;
    return p;
  })
  .refine((p) => /^\+855\d{8,9}$/.test(p), {
    message: "Enter a valid Cambodian phone (+855…)",
  });

const addressSchema = z.object({
  recipientName: z.string().min(2).max(100),
  phone: phoneSchema,
  province: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  commune: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
  streetDetail: z.string().max(200).optional(),
  landmark: z.string().max(200).optional(),
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export interface AddressRow {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  commune: string | null;
  village: string | null;
  streetDetail: string | null;
  landmark: string | null;
  isDefault: boolean;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listAddresses(): Promise<AddressRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    recipientName: r.recipientName,
    phone: r.phone,
    province: r.province,
    district: r.district,
    commune: r.commune,
    village: r.village,
    streetDetail: r.streetDetail,
    landmark: r.landmark,
    isDefault: r.isDefault,
  }));
}

export async function createAddress(input: AddressInput): Promise<Result<{ id: string }>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" };
  }

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Must be signed in." };

  const data = parsed.data;
  const makeDefault = data.isDefault ?? false;

  try {
    if (makeDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    }

    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .limit(1);

    const [row] = await db
      .insert(addresses)
      .values({
        userId,
        recipientName: data.recipientName.trim(),
        phone: data.phone,
        province: data.province.trim(),
        district: data.district.trim(),
        commune: data.commune?.trim() || null,
        village: data.village?.trim() || null,
        streetDetail: data.streetDetail?.trim() || null,
        landmark: data.landmark?.trim() || null,
        isDefault: makeDefault || existing.length === 0,
      })
      .returning({ id: addresses.id });

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[createAddress]", err);
    return { ok: false, error: "Could not save address." };
  }
}

export async function updateAddress(
  id: string,
  input: AddressInput
): Promise<Result> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" };
  }

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Must be signed in." };

  const data = parsed.data;

  try {
    if (data.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    }

    const updated = await db
      .update(addresses)
      .set({
        recipientName: data.recipientName.trim(),
        phone: data.phone,
        province: data.province.trim(),
        district: data.district.trim(),
        commune: data.commune?.trim() || null,
        village: data.village?.trim() || null,
        streetDetail: data.streetDetail?.trim() || null,
        landmark: data.landmark?.trim() || null,
        isDefault: data.isDefault ?? false,
        updatedAt: new Date(),
      })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .returning({ id: addresses.id });

    if (updated.length === 0) return { ok: false, error: "Address not found." };

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[updateAddress]", err);
    return { ok: false, error: "Could not update address." };
  }
}

export async function deleteAddress(id: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Must be signed in." };

  try {
    const deleted = await db
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .returning({ id: addresses.id, isDefault: addresses.isDefault });

    if (deleted.length === 0) return { ok: false, error: "Address not found." };

    if (deleted[0].isDefault) {
      const [next] = await db
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, userId))
        .orderBy(desc(addresses.updatedAt))
        .limit(1);
      if (next) {
        await db
          .update(addresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(addresses.id, next.id));
      }
    }

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[deleteAddress]", err);
    return { ok: false, error: "Could not delete address." };
  }
}

export async function setDefaultAddress(id: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Must be signed in." };

  try {
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));

    const updated = await db
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .returning({ id: addresses.id });

    if (updated.length === 0) return { ok: false, error: "Address not found." };

    revalidatePath("/account/addresses");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[setDefaultAddress]", err);
    return { ok: false, error: "Could not update default address." };
  }
}
