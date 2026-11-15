import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/**
 * vendor-deep-search-addon.ts — Deep Search (vendor-facing) pricing + eligibility.
 *
 * Owner-locked 2026-07-22: Deep Search is a PER-USE metered add-on that lets a verified vendor run the web-research
 * deep search on their OWN business and auto-fill their profile from the resulting "What We Learned" review (the
 * vendor-run version of the admin verification deep search; it REUSES the same engine in lib/vendor-deep-search.ts).
 *
 * ⚖ 2026-11-09 (DECISION_LOG 🔎💳 "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN — NO FREE SEARCH ON PRO/ULTRA"). Owner,
 * verbatim: *"Deep search is 1 use only"* + *"Yes remove deepsearch from pro and ultra."*
 *   • ONE price, ₱499 per search, on every plan — the one `vendor_billing_catalog.vendor_deep_search` row. The ₱799
 *     entry row (`vendor_deep_search_entry`) is RETIRED into it (migration `*_deep_search_one_price_and_plan_caps.sql`).
 *   • ONE use per purchase: every search is its own apply-then-pay order, and the activation hook runs exactly one
 *     search for it (`activateVendorDeepSearchOrder` in lib/sku-activation.ts).
 *   • ⛔ The Pro/Ultra "1 free search per 28-day cycle" is GONE — there is no free path, no cycle and no allowance
 *     count any more. Past free uses stay in `vendor_deep_search_uses` (`was_free = true`) as history.
 *
 * The price DECISION and eligibility GATE are PURE functions (no I/O, no clock, never a hardcoded live price — the
 * price comes FROM the admin-managed catalog). The DB reader takes its Supabase client as an argument so this module
 * has no server-only import and stays unit-testable under `tsx --test`.
 * 🔒 lib/vendor-deep-search-addon.test.ts
 */

/** Catalog sku_code the ₱500 price is read from (seeded by migration
 *  20270907924171). Also the literal `orders.service_key` for a paid Deep
 *  Search order — there is at most one PENDING metered order at a time, and the
 *  order carries vendor_profile_id, so no per-instance key suffix is needed. */
export const VENDOR_DEEP_SEARCH_SKU_CODE = 'vendor_deep_search';

/**
 * Fallback per-search price (the one row's, 2026-11-09). The live catalog value wins; this is the
 * last-resort figure used only when the `vendor_deep_search` row is missing or
 * unreadable (e.g. the seeding migration hasn't been applied, or a CI build with
 * no service-role key). Never hardcode this in UI copy — read via
 * {@link fetchVendorDeepSearchPricePhp}.
 */
export const VENDOR_DEEP_SEARCH_FALLBACK_PHP = 499;

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ── Eligibility gate ─────────────────────────────────────────────────────────

export type DeepSearchDenyReason =
  /** Tier below Supplier Plus (Free/Verified) — a PAID-tier add-on. */
  | 'tier_too_low'
  /** Paid tier but the shop is not verified yet. */
  | 'unverified';

export type DeepSearchEligibilityInput = {
  /** vendor_profiles.tier_state. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state. */
  verification: string | null | undefined;
  /**
   * The server's answer to `vendorPaywallApplies(isTierAtLeast(tier, 'solo'))`
   * (lib/vendor-feature-gate.ts) — whether the paid-plan requirement is asked
   * right now. Omitted → the tier rule applies unconditionally (the pure
   * default the tests pin). Every server caller passes it, so while
   * VENDOR_TIER_FEATURE_GATE is off a verified Free shop may run a search.
   */
  tierPaywall?: boolean;
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
 * "Paid tiers only" is `isTierAtLeast('solo')`, so Supplier Plus, Pro and Ultra
 * (`enterprise`) pass — Free and Verified (the two free tiers)
 * do not. This mirrors the AI-addon gate.
 */
export function deepSearchEligibility(
  input: DeepSearchEligibilityInput,
): DeepSearchEligibility {
  const tierShort = input.tierPaywall ?? !isTierAtLeast(input.tier, 'solo');
  if (tierShort) return { ok: false, reason: 'tier_too_low' };
  if (input.verification !== 'verified') return { ok: false, reason: 'unverified' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the vendor UI). */
export const DEEP_SEARCH_DENY_MESSAGE: Record<DeepSearchDenyReason, string> = {
  tier_too_low:
    'Running a Deep Search is part of the paid plans (Supplier Plus, Supplier Pro, Supplier Ultra). Pick one on the Plans page to run it.',
  unverified: 'Get your shop verified first — Deep Search unlocks once you’re verified.',
};

// ── The price ─────────────────────────────────────────────────────────────────

export type DeepSearchPriceInput = {
  /**
   * The standing per-search price from the catalog (falls back to {@link VENDOR_DEEP_SEARCH_FALLBACK_PHP} when
   * missing/invalid).
   */
  cyclePricePhp?: number | null;
};

/**
 * The price (PHP) a Deep Search run charges: the catalog price, on every plan, for every run — never ₱0 (owner
 * 2026-11-09: no free search on Pro/Ultra). Server-authoritative: the run action re-reads the catalog itself and never
 * trusts a client price. Callers gate eligibility (verified) FIRST via {@link deepSearchEligibility}.
 */
export function resolveDeepSearchPricePhp(input: DeepSearchPriceInput): number {
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
    if (error) {
      console.error('[supabase-error] vendor-deep-search-addon: price (using fallback)', error);
      return VENDOR_DEEP_SEARCH_FALLBACK_PHP;
    }
    if (!data) return VENDOR_DEEP_SEARCH_FALLBACK_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : VENDOR_DEEP_SEARCH_FALLBACK_PHP;
  } catch {
    return VENDOR_DEEP_SEARCH_FALLBACK_PHP;
  }
}
