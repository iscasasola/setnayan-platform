import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/**
 * vendor-photo-challenge.ts — Photo Challenge add-on pricing + eligibility.
 *
 * Owner-locked 2026-07-22: Photo Challenge is a FLAT ₱400 / EVENT add-on. A
 * BOOKED Pro/Enterprise (verified) vendor SPONSORS guest photo-engagement
 * challenges (the flag-dark Papic Games / missions feature) for a booked event
 * where Papic is active. It is PER-EVENT (metered), NOT a subscription — there
 * is NO free first cycle (the owner set a trial only for the AI + 3D add-ons).
 * Guests + couple play free; the vendor pays ₱400.
 *
 * The price DECISION + eligibility GATE are PURE functions (no I/O, no clock,
 * never a hardcoded live price — the ₱400 comes FROM the admin-managed catalog
 * `vendor_billing_catalog.vendor_photo_challenge`). The DB readers take their
 * Supabase client as an argument so this module has no server-only import and
 * stays unit-testable under `tsx --test`. Mirrors vendor-addon-pricing.ts.
 */

/** Catalog sku_code the ₱400 price is read from (seeded by migration
 *  20270907628470). Also the literal `orders.service_key` for a sponsorship
 *  order — there is one Photo Challenge sponsorship per (vendor, event); the
 *  order carries event_id + vendor_profile_id, so no per-instance key suffix. */
export const VENDOR_PHOTO_CHALLENGE_SKU_CODE = 'vendor_photo_challenge';

/**
 * Fallback ₱400 / event price. The live catalog value wins; this is the
 * last-resort figure used only when the `vendor_photo_challenge` row is missing
 * or unreadable (e.g. the seeding migration hasn't been applied, or a CI build
 * with no service-role key). Never hardcode this in UI copy — read via
 * {@link fetchVendorPhotoChallengePricePhp}.
 */
export const VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP = 400;

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The price (PHP) a Photo Challenge sponsorship order should charge: the ₱400
 * catalog price for the event (or the fallback when the catalog value is
 * missing/invalid). PURE: no I/O; the price is passed in from the catalog.
 * There is no per-event trial — every sponsorship is the full per-event price.
 */
export function resolveVendorPhotoChallengePricePhp(
  cyclePricePhp?: number | null,
): number {
  return coercePrice(cyclePricePhp, VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP);
}

// ── Eligibility gate ─────────────────────────────────────────────────────────

export type PhotoChallengeDenyReason =
  /** Tier below Pro (Solo/Verified/Free) — Pro/Enterprise only. */
  | 'tier_too_low'
  /** Paid tier but the shop is not verified yet. */
  | 'unverified'
  /** The vendor is not booked on this event. */
  | 'not_booked'
  /** Papic is not active on this event — nothing to run a challenge on. */
  | 'papic_inactive'
  /** Already sponsored for this event — one per (vendor, event). */
  | 'already_sponsored';

export type PhotoChallengeEligibilityInput = {
  /** vendor_profiles.tier_state. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state. */
  verification: string | null | undefined;
  /** Does this vendor own a BOOKED event_vendors row on the event? */
  booked: boolean;
  /** Is Papic active on the event (eventPapicActive)? */
  papicActive: boolean;
  /** Does a papic_photo_challenge_sponsorships row already exist for (vendor, event)? */
  alreadySponsored: boolean;
};

export type PhotoChallengeEligibility =
  | { ok: true }
  | { ok: false; reason: PhotoChallengeDenyReason };

/**
 * THE eligibility decision — pure, so the buy action (server) and the client
 * card share one source of truth. Checked in the same order the action rejects,
 * so the surfaced reason always matches what a submit would return: tier →
 * verification → booked → Papic active → not-already-sponsored.
 *
 * "Pro/Enterprise only" is `isTierAtLeast('pro')`, so Pro, Enterprise, and the
 * negotiated Custom tier (which runs as Enterprise-or-better) all pass — Solo,
 * Verified, and Free do not. This mirrors the RPC's `('pro','enterprise',
 * 'custom')` gate.
 */
export function photoChallengeEligibility(
  input: PhotoChallengeEligibilityInput,
): PhotoChallengeEligibility {
  if (!isTierAtLeast(input.tier, 'pro')) return { ok: false, reason: 'tier_too_low' };
  if (input.verification !== 'verified') return { ok: false, reason: 'unverified' };
  if (!input.booked) return { ok: false, reason: 'not_booked' };
  if (!input.papicActive) return { ok: false, reason: 'papic_inactive' };
  if (input.alreadySponsored) return { ok: false, reason: 'already_sponsored' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the vendor UI). */
export const PHOTO_CHALLENGE_DENY_MESSAGE: Record<PhotoChallengeDenyReason, string> = {
  tier_too_low:
    'Photo Challenge is a Pro / Enterprise add-on. Upgrade your plan to sponsor one.',
  unverified: 'Get your shop verified first — Photo Challenge unlocks once you’re verified.',
  not_booked: 'You can only sponsor a Photo Challenge on an event you’re booked for.',
  papic_inactive:
    'Photo Challenge runs on Papic — it’s available once the couple has Papic active for this event.',
  already_sponsored: 'You’ve already sponsored a Photo Challenge for this event.',
};

// ── DB readers (client passed in — no server-only import) ────────────────────

/**
 * Resolve the live Photo Challenge price (PHP) from the admin-managed catalog,
 * falling back to {@link VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP} when the
 * `vendor_photo_challenge` row is missing/unreadable. Mirrors
 * fetchVendorAiAddonPricePhp: reads the single active row and treats any
 * non-positive / non-finite price as missing.
 */
export async function fetchVendorPhotoChallengePricePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0
      ? price
      : VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
  } catch {
    return VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP;
  }
}

/**
 * Is Photo Challenge already sponsored for this (event, vendor)? Reads the
 * entitlement row. Soft: any error / missing table degrades to `false` (not
 * sponsored) so a pre-migration DB never crashes a caller. Under the vendor's
 * own RLS session this only ever sees the caller's own org's rows
 * (papic_photo_challenge_sponsorships_vendor_read).
 */
export async function fetchPhotoChallengeSponsored(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('papic_photo_challenge_sponsorships')
      .select('sponsorship_id')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) return false;
    return data != null;
  } catch {
    return false;
  }
}
