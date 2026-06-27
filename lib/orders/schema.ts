import { z } from "zod";

/**
 * Checkout input validation schemas.
 *
 * Per API Spec §7.2 POST /api/v1/orders:
 *   - payment_method: "cod" | "aba_payway"
 *   - shipping address: inline or address_id reference
 *   - coupon_code: optional
 *   - idempotency_key: required (UUID v4)
 *
 * Per DB Schema §6.6 orders table:
 *   - Denormalized shipping address (shipping_full_name, shipping_phone, etc.)
 *   - E.164 phone format
 *   - Cambodia provinces
 */

// Cambodia provinces — per PRD §1.1 (nationwide delivery)
export const CAMBODIA_PROVINCES = [
  "Phnom Penh",
  "Banteay Meanchey",
  "Battambang",
  "Kampong Cham",
  "Kampong Chhnang",
  "Kampong Speu",
  "Kampong Thom",
  "Kampot",
  "Kandal",
  "Kep",
  "Koh Kong",
  "Kratie",
  "Mondulkiri",
  "Oddar Meanchey",
  "Pailin",
  "Preah Sihanouk",
  "Preah Vihear",
  "Prey Veng",
  "Pursat",
  "Ratanakiri",
  "Siem Reap",
  "Stung Treng",
  "Svay Rieng",
  "Takeo",
  "Tboung Khmum",
] as const;

// E.164 phone: +855 followed by 8 or 9 digits
const phoneRegex = /^\+855\d{8,9}$/;

export const shippingAddressSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name is required")
    .max(100, "Name too long"),
  phone: z
    .string()
    .regex(phoneRegex, "Phone must be Cambodia format: +855XXXXXXXXX"),
  province: z.enum(CAMBODIA_PROVINCES, {
    errorMap: () => ({ message: "Please select a province" }),
  }),
  district: z.string().min(1, "District is required").max(100),
  commune: z.string().max(100).optional(),
  street: z.string().min(1, "Street address is required").max(255),
  notes: z.string().max(500).optional(),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["cod", "aba_payway"], {
    errorMap: () => ({ message: "Please select a payment method" }),
  }),
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().max(50).optional(),
  idempotencyKey: z.string().uuid("Invalid idempotency key"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Flat shipping rate in USD cents.
 * Per PRD §3.3: "Flat rate shipping for v1."
 * Phnom Penh: $2.50, other provinces: $4.00
 */
export function getShippingCents(province: string): number {
  return province === "Phnom Penh" ? 250 : 400;
}