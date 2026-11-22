/**
 * A test shop that may open a branch holds a DTI/SEC registration number.
 *
 * ⚖ Owner 2026-11-22 ("UNLIMITED = ONE REGISTERED BUSINESS"): every branch carries its shop's registration number, so
 * the database (`vendor_branches_carry_shop_registration`, migration 20271359913146) refuses a branch opened under a
 * shop with none. Tests that are about something else and just need a branch give the shop a number first.
 *
 * The number is derived from the shop's own id, so it is unique per shop and never collides with the one-verified-
 * shop-per-number rule. A shop that already holds a number keeps it.
 */
import type { PGlite } from '@electric-sql/pglite';

export async function giveShopARegistrationNumber(db: PGlite, vendorProfileId: string): Promise<void> {
  await db.query(
    `UPDATE public.vendor_profiles
        SET registration_number_raw = COALESCE(registration_number_raw, 'TEST-' || replace(vendor_profile_id::text, '-', ''))
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
}

/**
 * Seed a pair that was verified under one registration number BEFORE 22 Nov 2026, when one verified shop per number
 * became the rule. Such pairs can exist in production (the rule takes no badge back), and the mechanisms built for
 * them — one free first booking / one trial per business — must keep working on them. The rule's trigger is switched
 * off for exactly the seeding write, then back on.
 */
export async function seededBeforeTheOneVerifiedShopRule<T>(db: PGlite, write: () => Promise<T>): Promise<T> {
  await db.query('ALTER TABLE public.vendor_profiles DISABLE TRIGGER vendor_profiles_one_verified_per_registration');
  try {
    return await write();
  } finally {
    await db.query('ALTER TABLE public.vendor_profiles ENABLE TRIGGER vendor_profiles_one_verified_per_registration');
  }
}
