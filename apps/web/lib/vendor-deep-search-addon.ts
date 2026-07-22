import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/**
 * vendor-deep-search-addon.ts — Deep Search (vendor-facing) pricing +
 * eligibility + the free-per-cycle allowance math.
 *
 * Owner-locked 2026-07-22: Deep Search is a PER-USE metered add-on — ₱500 per
 * search — that lets a PAID-tier (verified) vendor run the web-research deep
 * search on their OWN business and auto-fill their profile from the resulting
 * "What We Learned" review (the vendor-run version of the admin verification
 * deep search; it REUSES the same engine in lib/vendor-deep-search.ts).
 *
 *   • ALL PAID tiers (Solo / Pro / Enterprise / Custom), verified only. NOT the
 *     free / verified-only tier.
 *   • Pro / Enterprise / Custom get 1 FREE search per 28-day cycle, then ₱500.
 *   • Solo pays ₱500 EVERY time (no free allowance).
 *
 * The price DECISION, eligibility GATE, and cycle-boundary math are PURE
 * functions (no I/O, no clock, never a hardcoded live price — the ₱500 comes
 * FROM the admin-managed catalog `vendor_billing_catalog.vendor_deep_search`).
 * The DB readers take their Supabase client as an argument so this module has no
 * server-only import and stays unit-testable under `tsx --test`. Mirrors
 * vendor-photo-challenge.ts + vendor-addon-pricing.ts.
 */

/** Catalog sku_code the ₱500 price is read from (seeded by migration
 *  20270907924171). Also the literal `orders.service_key` for a paid Deep
 *  Search order — there is at most one PENDING metered order at a time, and the
 *  order carries vendor_profile_id, so no per-instance key suffix is needed. */
export const VENDOR_DEEP_SEARCH_SKU_CODE = 'vendor_deep_search';

/** The free-allowance cadence = 28 days (the platform 28-day cycle). The owner's
 *  "1 free per 28-day cycle" resets on this cadence for every subscriber,
 *  monthly OR annual — see {@link deepSearchCycleStartMs}. */
export const VENDOR_DEEP_SEARCH_PERIOD_DAYS = 28;

/**
 * Fallback ₱500 / search price. The live catalog value wins; this is the
 * last-resort figure used only when the `vendor_deep_search` row is missing or
 * unreadable (e.g. the seeding migration hasn't been applied, or a CI build with
 * no service-role key). Never hardcode this in UI copy — read via
 * {@link fetchVendorDeepSearchPricePhp}.
 */
export const VENDOR_DEEP_SEARCH_FALLBACK_PHP = 500;

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ── Eligibility gate ─────────────────────────────────────────────────────────

export type DeepSearchDenyReason =
  /** Tier below Solo (Free/Verified) — a PAID-tier add-on. */
  | 'tier_too_low'
  /** Paid tier but the shop is not verified yet. */
  | 'unverified';

export type DeepSearchEligibilityInput = {
  /** vendor_profiles.tier_state. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state. */
  verification: string | null | undefined;
};

export type DeepSearchEligibility =
  | { ok: true }
  | { ok: false; reason: DeepSearchDenyReason };

/**
 * THE eligibility decision — pure, so the run action (server) and the surface
 * (client) share one source of truth. Checked in the same order the action
 * rejects, so the surfaced reason always matches what a submit would return:
 * tier → verification.
 *
 * "Paid tiers only" is `isTierAtLeast('solo')`, so Solo, Pro, Enterprise, and
 * the negotiated Custom tier all pass — Free and Verified (the two free tiers)
 * do not. This mirrors the AI-addon gate.
 */
export function deepSearchEligibility(
  input: DeepSearchEligibilityInput,
): DeepSearchEligibility {
  if (!isTierAtLeast(input.tier, 'solo')) return { ok: false, reason: 'tier_too_low' };
  if (input.verification !== 'verified') return { ok: false, reason: 'unverified' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the vendor UI). */
export const DEEP_SEARCH_DENY_MESSAGE: Record<DeepSearchDenyReason, string> = {
  tier_too_low:
    'Deep Search is available on the paid plans (Solo, Pro, Enterprise). Upgrade to run it.',
  unverified: 'Get your shop verified first — Deep Search unlocks once you’re verified.',
};

/**
 * Does this tier get the 1-free-search-per-cycle allowance? Pro / Enterprise /
 * Custom do; Solo does NOT (Solo pays ₱500 every time). Rank-derived so Custom —
 * which runs as Enterprise-or-better — inherits the free allowance automatically.
 */
export function deepSearchHasFreeAllowance(tier: string | null | undefined): boolean {
  return isTierAtLeast(tier, 'pro');
}

// ── The free-per-cycle allowance: cycle-start + price ─────────────────────────

/**
 * The start (epoch ms) of the vendor's CURRENT 28-day Deep Search cycle — the
 * window whose used-count decides whether the next search is free.
 *
 * The owner's "1 free per 28-day cycle" resets on a 28-day cadence for EVERY
 * subscriber (monthly and annual alike). We anchor that cadence to the vendor's
 * subscription window (`vendor_profiles.tier_expires_at`) so the free search
 * refreshes in phase with their billing day: the cycle boundaries fall on
 * tier_expires_at, tier_expires_at − 28d, − 56d, … and the CURRENT cycle start
 * is the most recent such boundary at or before `now`. This walks backward from
 * expiry (not forward from an activation date we don't store), so it works
 * identically for a monthly plan (expiry ≈ now + a few days) and an annual plan
 * (expiry ≈ now + many months) — both get a boundary every 28 days.
 *
 * FALLBACK (documented): when tier_expires_at is missing/invalid (shouldn't
 * happen for a paid tier, but a pre-migration or mid-lapse read can), we fall
 * back to a ROLLING 28-day window ending now (start = now − 28d). Pure.
 */
export function deepSearchCycleStartMs(
  tierExpiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  const periodMs = VENDOR_DEEP_SEARCH_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const exp = tierExpiresAt ? Date.parse(tierExpiresAt) : NaN;
  if (!Number.isFinite(exp)) return nowMs - periodMs; // rolling-window fallback
  // Number of whole 28-day periods between now and expiry, rounded UP, gives the
  // count of boundaries strictly after `now` up to (and including) expiry. The
  // current cycle start is that many periods below expiry. (When now === a
  // boundary exactly, ceil keeps that boundary as the start.)
  const periodsAhead = Math.ceil((exp - nowMs) / periodMs);
  return exp - periodsAhead * periodMs;
}

export type DeepSearchPriceInput = {
  /** vendor_profiles.tier_state (decides Solo-always-pay vs Pro+-free-first). */
  tier: string | null | undefined;
  /** Count of THIS vendor's deep-search uses since {@link deepSearchCycleStartMs}. */
  usesThisCycle: number;
  /**
   * The standing per-search price from the catalog (falls back to ₱500 when
   * missing/invalid). Ignored on a free search (which is always ₱0).
   */
  cyclePricePhp?: number | null;
};

/**
 * The price (PHP) a Deep Search run should charge:
 *   • Pro / Enterprise / Custom → ₱0 for the FIRST run of the cycle (0 uses so
 *     far), the ₱500 catalog price for every run after.
 *   • Solo → always the ₱500 catalog price (no free allowance).
 *
 * Server-authoritative — the caller re-resolves `usesThisCycle` by COUNTING the
 * vendor's vendor_deep_search_uses rows since the cycle start (never trusts the
 * client), so a tampered client can't force ₱0. PURE: no I/O; the ₱500 is passed
 * in from the catalog, and the ₱0 free search is expressed HERE (not as a ₱0
 * catalog row — vendor_billing_catalog has a price_php > 0 CHECK). Callers gate
 * eligibility (paid + verified) FIRST via {@link deepSearchEligibility}; this
 * assumes an eligible vendor.
 */
export function resolveDeepSearchPricePhp(input: DeepSearchPriceInput): number {
  if (deepSearchHasFreeAllowance(input.tier) && input.usesThisCycle <= 0) return 0;
  return coercePrice(input.cyclePricePhp, VENDOR_DEEP_SEARCH_FALLBACK_PHP);
}

// ── DB readers (client passed in — no server-only import) ────────────────────

/**
 * Resolve the live Deep Search price (PHP) from the admin-managed catalog,
 * falling back to {@link VENDOR_DEEP_SEARCH_FALLBACK_PHP} when the
 * `vendor_deep_search` row is missing/unreadable. Mirrors
 * fetchVendorPhotoChallengePricePhp: reads the single active row and treats any
 * non-positive / non-finite price as missing.
 */
export async function fetchVendorDeepSearchPricePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', VENDOR_DEEP_SEARCH_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return VENDOR_DEEP_SEARCH_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : VENDOR_DEEP_SEARCH_FALLBACK_PHP;
  } catch {
    return VENDOR_DEEP_SEARCH_FALLBACK_PHP;
  }
}

/**
 * Count a vendor's Deep Search uses at/after `sinceIso` (the cycle start). This
 * is the authoritative allowance counter — 0 means the free search is still
 * available for a Pro+ vendor. Soft: any error / missing table degrades to a
 * SAFE HIGH count (1) so a pre-migration DB never accidentally hands out a free
 * search it can't record (fail toward charging, not toward free). Under the
 * vendor's own RLS session this only ever sees the caller's own org's rows
 * (vendor_deep_search_uses_vendor_read); pass an admin client for authority.
 */
export async function countDeepSearchUsesSince(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sinceIso: string,
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('vendor_deep_search_uses')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .gte('used_at', sinceIso);
    if (error) return 1;
    return count ?? 0;
  } catch {
    return 1;
  }
}
