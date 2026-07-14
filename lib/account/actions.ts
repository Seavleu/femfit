"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { ok: true }
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
    message: "Enter a valid Cambodian phone number (e.g. +85512345678)",
  });

/**
 * Save the signed-in user's phone on their own profile row.
 * Uses the session-aware client so RLS (`auth.uid() = id`) enforces ownership.
 */
export async function updateProfilePhone(input: {
  phone: string;
}): Promise<Result> {
  const parsed = phoneSchema.safeParse(input.phone);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid phone number",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Must be signed in." };
  }

  const phone = parsed.data;

  // Reject if another profile already owns this number
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .neq("id", user.id)
    .maybeSingle();

  if (taken) {
    return { ok: false, error: "That phone number is already registered." };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateProfilePhone]", error);
    return { ok: false, error: "Could not save phone number. Please try again." };
  }

  if (!updated) {
    // Profile row missing (edge case) — insert own row; RLS must allow insert for auth.uid() = id
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      phone,
      email: user.email ?? null,
      updated_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error("[updateProfilePhone] insert", insertError);
      return { ok: false, error: "Could not save phone number. Please try again." };
    }
  }

  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true };
}
