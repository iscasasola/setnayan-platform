import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-3d-booth-pricing.ts — 3D Booth add-on pricing + entitlement helpers.
 *
 * Owner-locked 2026-07-22: 3D Booth is a FLAT ₱1,500 / 28-day add-on on the
 * PRO / ENTERPRISE / CUSTOM tiers (verified only), FREE for the vendor's FIRST
 * cycle (one-time per account). When active, the vendor's booth renders BRANDED
 * (logo + poster) inside their couples' PUBLISHED 3D Plans; without it a
 * Pro/Enterprise vendor keeps the existing GENERIC (unbranded) booth. It is
 * Pro+ (not Solo+ like the AI add-on) because booth branding is already a
 * Pro/Enterprise perk (lib/seating-3d.ts boothCanBrand).
 *
 * The price DECISION is a PURE function (no I/O, no clock, never a hardcoded
 * live price — the ₱1,500 comes FROM the admin-managed catalog
 * `vendor_billing_catalog.vendor_3d_booth`). The DB read + window helpers take
 * their Supabase client as an argument so this module has no server-only
 * import and stays unit-testable under `tsx --test`. Deliberately a MIRROR of
 * vendor-addon-pricing.ts (the Vendor AI add-on) — same trial + window shape.
 */

/** Catalog sku_code the ₱1,500 renewal price is read from (seeded by migration
 *  20270908863003). Also the literal `orders.service_key` for the add-on order —
 *  there is exactly ONE 3D Booth add-on per vendor, so no per-instance suffix. */
export const VENDOR_3D_BOOTH_SKU_CODE = 'vendor_3d_booth';

/** One add-on billing cycle = 28 days (matches the platform 28-day cadence). */
export const VENDOR_3D_BOOTH_PERIOD_DAYS = 28;

/**
 * Fallback ₱1,500 / 28-day renewal price. The live catalog value wins; this is
 * the last-resort figure used only when the `vendor_3d_booth` row is missing or
 * unreadable (e.g. the seeding migration hasn't been applied, or a CI build with
 * no service-role key). Never hardcode this in UI copy — read via
 * {@link fetchVendor3dBoothPricePhp}.
 */
export const VENDOR_3D_BOOTH_FALLBACK_PHP = 1500;

export type Vendor3dBoothPriceInputs = {
  /** Has this vendor already consumed its one-time free first cycle? */
  trialUsed: boolean;
  /**
   * The standing renewal price from the catalog (falls back to ₱1,500 when
   * missing/invalid). Ignored on the free first cycle (which is always ₱0).
   */
  cyclePricePhp?: number | null;
};

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The price (PHP) a 3D Booth add-on order should charge: ₱0 for the vendor's
 * FIRST 28-day cycle (the one-time free intro), the ₱1,500 catalog renewal for
 * every cycle after. Server-authoritative — the caller re-resolves `trialUsed`
 * from stored vendor state (vendor_profiles.booth_addon_trial_used_at), so a
 * tampered client can never force the free price on a renewal.
 *
 * PURE: no I/O. The renewal price is passed in from the catalog; the ₱0 free
 * cycle is expressed HERE (not as a ₱0 catalog row — vendor_billing_catalog has
 * a price_php > 0 CHECK).
 */
export function resolveVendor3dBoothPricePhp(input: Vendor3dBoothPriceInputs): number {
  if (!input.trialUsed) return 0;
  return coercePrice(input.cyclePricePhp, VENDOR_3D_BOOTH_FALLBACK_PHP);
}

/**
 * Is a 3D Booth add-on entitlement CURRENTLY active? Pure — `expiresAt` is the
 * stored vendor_profiles.booth_addon_expires_at; the add-on is live while
 * now < expiry. Lapse is automatic at read time (no cron), exactly like the
 * AI-addon / branch / tier windows. This is the boolean the booth-render gate
 * (lib/seating-3d.ts boothIsBranded) consumes.
 */
export function isVendor3dBoothActive(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > nowMs;
}

/**
 * Compute the NEW entitlement-window end for a fresh 28-day cycle, stacking from
 * the LATER of now / the current expiry (an early re-up keeps the remaining
 * time — mirrors nextVendorAiAddonExpiry). Pure; returns an ISO string.
 */
export function nextVendor3dBoothExpiry(
  currentExpiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  const cur = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(base + VENDOR_3D_BOOTH_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Resolve the live 3D Booth add-on renewal price (in PHP) from the admin-managed
 * catalog, falling back to {@link VENDOR_3D_BOOTH_FALLBACK_PHP} when the
 * `vendor_3d_booth` row is missing/unreadable. Reads the single active row and
 * treats any non-positive / non-finite price as missing. Takes the client as an
 * argument (import-type only) so this module has no server-only import.
 */
export async function fetchVendor3dBoothPricePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', VENDOR_3D_BOOTH_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return VENDOR_3D_BOOTH_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : VENDOR_3D_BOOTH_FALLBACK_PHP;
  } catch {
    return VENDOR_3D_BOOTH_FALLBACK_PHP;
  }
}

/**
 * Read a vendor's add-on state (trial + entitlement window) with the given
 * client. Soft: any error / missing columns degrade to "never activated,
 * trial available" (both null) so a pre-migration DB never crashes a caller.
 */
export type Vendor3dBoothState = {
  trialUsedAt: string | null;
  expiresAt: string | null;
};

export async function fetchVendor3dBoothState(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Vendor3dBoothState> {
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('booth_addon_trial_used_at, booth_addon_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const row = data as
      | { booth_addon_trial_used_at?: string | null; booth_addon_expires_at?: string | null }
      | null;
    return {
      trialUsedAt: row?.booth_addon_trial_used_at ?? null,
      expiresAt: row?.booth_addon_expires_at ?? null,
    };
  } catch {
    return { trialUsedAt: null, expiresAt: null };
  }
}
