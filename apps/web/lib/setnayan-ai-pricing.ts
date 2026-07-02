/**
 * setnayan-ai-pricing.ts — per-EVENT Setnayan AI pricing (pure).
 *
 * Owner-locked 2026-07-02: Setnayan AI is priced PER EVENT. Every event's FIRST
 * 28-day cycle is the ₱499 intro (a DEFAULT — admin comps/grants can still
 * override), and each 28-day cycle after is ₱799. This module is the pure
 * price-selection math: given whether an event has already used its intro cycle,
 * it returns the price the next order should charge.
 *
 * Deliberately PURE + PRICE-AGNOSTIC: no I/O, no clock, and NEVER a hardcoded
 * live price — both the intro and the renewal price are passed in FROM THE
 * ADMIN-MANAGED CATALOG (`platform_retail_catalog_v2`), honoring the
 * "prices are catalog-authoritative, never hardcode" lock. The constants below
 * are only last-resort fallbacks for a missing/corrupt catalog read, so the math
 * degrades to a sane number instead of ₱0.
 *
 * FOUNDATION — this is the pricing decision only. The per-event 28-day window +
 * `setnayan_ai_intro_used` flag, the renewal catalog row, the buy-flow wiring,
 * the public "₱499 first / ₱799 after" copy, and the enabling flag land in later
 * PRs (all additive + default-OFF, so live behavior is unchanged until flipped).
 */

/** One per-event billing cycle = 28 days (matches the platform 28-day cadence). */
export const AI_EVENT_CYCLE_DAYS = 28;

/** Fallback INTRO price — the live catalog `SETNAYAN_AI` value today. Catalog wins. */
export const SETNAYAN_AI_INTRO_FALLBACK_PHP = 499;

/** Fallback RENEWAL price (owner 2026-07-02). Catalog wins. */
export const SETNAYAN_AI_RENEWAL_FALLBACK_PHP = 799;

/** The resolved two-tier per-event pricing (catalog values, with safe fallbacks). */
export type SetnayanAiEventPricing = {
  /** First 28-day cycle of an event. */
  introPhp: number;
  /** Every 28-day cycle after the first. */
  renewalPhp: number;
  cycleDays: number;
};

export type SetnayanAiEventPriceInputs = {
  /** Has this event already consumed its first-cycle ₱499 intro? */
  introUsed: boolean;
  /** Intro price from the catalog (falls back to ₱499 when missing/invalid). */
  introPricePhp?: number | null;
  /** Renewal price from the catalog (falls back to ₱799 when missing/invalid). */
  renewalPricePhp?: number | null;
};

/** A positive finite price, or the fallback when the catalog value is missing/invalid. */
function coercePrice(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Resolve the two-tier per-event pricing from catalog values. Centralizes the
 * intro/renewal pair so every surface (buy flow + "₱499 first / ₱799 after"
 * copy) reads ONE source and can never drift.
 */
export function setnayanAiEventPricing(
  introPricePhp?: number | null,
  renewalPricePhp?: number | null,
): SetnayanAiEventPricing {
  return {
    introPhp: coercePrice(introPricePhp, SETNAYAN_AI_INTRO_FALLBACK_PHP),
    renewalPhp: coercePrice(renewalPricePhp, SETNAYAN_AI_RENEWAL_FALLBACK_PHP),
    cycleDays: AI_EVENT_CYCLE_DAYS,
  };
}

/**
 * The price (PHP) a Setnayan AI order should charge for an event: the intro on
 * the event's FIRST cycle, the renewal on every cycle after. Server-authoritative
 * — the caller re-resolves `introUsed` from stored event state so a tampered
 * client can't force the intro price on a renewal.
 */
export function resolveSetnayanAiOrderPricePhp(input: SetnayanAiEventPriceInputs): number {
  const { introPhp, renewalPhp } = setnayanAiEventPricing(
    input.introPricePhp,
    input.renewalPricePhp,
  );
  return input.introUsed ? renewalPhp : introPhp;
}
