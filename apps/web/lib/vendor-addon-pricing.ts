import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-addon-pricing.ts — Vendor AI ("the AI Chatbot") add-on pricing +
 * entitlement helpers.
 *
 * Owner-locked 2026-07-22: Vendor AI is a FLAT ₱1,500 / 28-day add-on on the
 * PAID tiers (solo/pro/enterprise), FREE for the vendor's FIRST cycle
 * (one-time per account). It turns ON the existing flag-dark Auto-Reply
 * Assistant (lib/vendor-autoreply/*). The inbox itself stays free.
 *
 * The price DECISION is a PURE function (no I/O, no clock, never a hardcoded
 * live price — the ₱1,500 comes FROM the admin-managed catalog
 * `vendor_billing_catalog.vendor_ai_addon`). The DB read + window helpers take
 * their Supabase client as an argument so this module has no server-only
 * import and stays unit-testable under `tsx --test`. Mirrors the shape of
 * setnayan-ai-pricing.ts (pure decision) + vendor-branches.ts (DB reader takes
 * the client).
 */

/** Catalog sku_code the ₱1,500 renewal price is read from (seeded by migration
 *  20270905761946). Also the literal `orders.service_key` for the add-on order —
 *  there is exactly ONE AI add-on per vendor, so no per-instance suffix (unlike
 *  the per-branch `vendor_additional_branch__{id}` key). */
export const VENDOR_AI_ADDON_SKU_CODE = 'vendor_ai_addon';

/** One add-on billing cycle = 28 days (matches the platform 28-day cadence). */
export const VENDOR_AI_ADDON_PERIOD_DAYS = 28;

/**
 * Fallback ₱1,500 / 28-day renewal price. The live catalog value wins; this is
 * the last-resort figure used only when the `vendor_ai_addon` row is missing or
 * unreadable (e.g. the seeding migration hasn't been applied, or a CI build with
 * no service-role key). Never hardcode this in UI copy — read via
 * {@link fetchVendorAiAddonPricePhp}.
 */
export const VENDOR_AI_ADDON_FALLBACK_PHP = 1500;

export type VendorAiAddonPriceInputs = {
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
 * The price (PHP) a Vendor AI add-on order should charge: ₱0 for the vendor's
 * FIRST 28-day cycle (the one-time free intro), the ₱1,500 catalog renewal for
 * every cycle after. Server-authoritative — the caller re-resolves `trialUsed`
 * from stored vendor state (vendor_profiles.ai_addon_trial_used_at), so a
 * tampered client can never force the free price on a renewal.
 *
 * PURE: no I/O. The renewal price is passed in from the catalog; the ₱0 free
 * cycle is expressed HERE (not as a ₱0 catalog row — vendor_billing_catalog has
 * a price_php > 0 CHECK).
 */
export function resolveVendorAiAddonPricePhp(input: VendorAiAddonPriceInputs): number {
  if (!input.trialUsed) return 0;
  return coercePrice(input.cyclePricePhp, VENDOR_AI_ADDON_FALLBACK_PHP);
}

/**
 * Is a Vendor AI add-on entitlement CURRENTLY active? Pure — `expiresAt` is the
 * stored vendor_profiles.ai_addon_expires_at; the add-on is live while
 * now < expiry. Lapse is automatic at read time (no cron), exactly like the
 * branch/tier windows.
 */
export function isVendorAiAddonActive(
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
 * time — mirrors extendUserAiSubscription). Pure; returns an ISO string.
 */
export function nextVendorAiAddonExpiry(
  currentExpiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  const cur = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(base + VENDOR_AI_ADDON_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Resolve the live Vendor AI add-on renewal price (in PHP) from the admin-managed
 * catalog, falling back to {@link VENDOR_AI_ADDON_FALLBACK_PHP} when the
 * `vendor_ai_addon` row is missing/unreadable. Mirrors fetchBranchFeePhp: reads
 * the single active row and treats any non-positive / non-finite price as
 * missing. Takes the client as an argument (import-type only) so this module has
 * no server-only import.
 */
export async function fetchVendorAiAddonPricePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', VENDOR_AI_ADDON_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return VENDOR_AI_ADDON_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : VENDOR_AI_ADDON_FALLBACK_PHP;
  } catch {
    return VENDOR_AI_ADDON_FALLBACK_PHP;
  }
}

/**
 * Read a vendor's add-on state (trial + entitlement window) with the given
 * client. Soft: any error / missing columns degrade to "never activated,
 * trial available" (both null) so a pre-migration DB never crashes a caller.
 */
export type VendorAiAddonState = {
  trialUsedAt: string | null;
  expiresAt: string | null;
};

export async function fetchVendorAiAddonState(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorAiAddonState> {
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('ai_addon_trial_used_at, ai_addon_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const row = data as
      | { ai_addon_trial_used_at?: string | null; ai_addon_expires_at?: string | null }
      | null;
    return {
      trialUsedAt: row?.ai_addon_trial_used_at ?? null,
      expiresAt: row?.ai_addon_expires_at ?? null,
    };
  } catch {
    return { trialUsedAt: null, expiresAt: null };
  }
}
