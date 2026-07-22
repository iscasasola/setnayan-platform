/**
 * setnayan-ai-type-pricing.ts — per-EVENT-TYPE Setnayan AI pricing (pure).
 *
 * Owner-locked 2026-07-22 ("go"): Setnayan AI is priced by AI LOAD — "how much
 * data is needed to help them" — on a DISCRETE 5-point ladder, not a range:
 *
 *   Tier A  ₱1,499  Wedding
 *   Tier B  ₱999    Debut · Corporate
 *   Tier C  ₱499    Christening · Birthday · Celebration · Travel · Tournament
 *                   · Anniversary · Graduation · Reunion
 *   Tier D  ₱99     Gender reveal · Dinner Date
 *   Tier E  ₱0      Simple Event / any digital-services-only (no vendors →
 *                   Setnayan AI is not present → nothing to price)
 *
 * This module is the pure CLASSIFICATION only: event_type → tier → the catalog
 * SKU whose `retail_price_php` is the price. It never hardcodes a LIVE price —
 * the amounts live in `platform_retail_catalog_v2` (admin-editable, owner rule
 * "prices are catalog-authoritative"). The `*_FALLBACK_PHP` constants are the
 * last-resort values used ONLY when the catalog row is unreadable, so the charge
 * degrades to the locked number instead of ₱0. The tier ASSIGNMENT (which type
 * is which tier) is product config, not a price, so it lives here.
 *
 * Server-side price resolution (reads the catalog) is in
 * lib/setnayan-ai-event-pricing.ts; the checkout re-resolve + studio display
 * call it. This file has no I/O so the map is unit-testable.
 */

export type AiPriceTier = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * event_type → tier. Explicit for every canonical type (14). Anniversary /
 * graduation / reunion were not in the 2026-07-17 load study; they are assigned
 * to C (standard event) pending owner review — see the DECISION_LOG note.
 */
export const AI_TIER_BY_EVENT_TYPE: Readonly<Record<string, AiPriceTier>> = {
  wedding: 'A',
  debut: 'B',
  corporate: 'B',
  christening: 'C',
  birthday: 'C',
  celebration: 'C',
  travel: 'C',
  tournament: 'C',
  anniversary: 'C',
  graduation: 'C',
  reunion: 'C',
  gender_reveal: 'D',
  dinner_date: 'D',
  simple_event: 'E',
};

/**
 * Tier for an unmapped / unknown event type. Standard-event (C) is the safe
 * middle: a future vendor-inclusive type is neither over- nor under-charged
 * relative to the known spread. simple_event and every known type are mapped
 * explicitly, so this only bites a brand-new type before it's tiered.
 */
export const AI_TIER_DEFAULT: AiPriceTier = 'C';

/**
 * The catalog SKU whose `retail_price_php` is a tier's price. Tier A is the
 * existing sellable `SETNAYAN_AI` row; B/C/D are price-source-only rows
 * (is_active=FALSE). Tier E has no SKU — Setnayan AI isn't present, so there's
 * nothing to charge.
 */
export const AI_TIER_SKU: Readonly<Record<AiPriceTier, string | null>> = {
  A: 'SETNAYAN_AI',
  B: 'SETNAYAN_AI_B',
  C: 'SETNAYAN_AI_C',
  D: 'SETNAYAN_AI_D',
  E: null,
};

/** Last-resort price per tier (catalog wins). Matches the locked ladder. */
export const AI_TIER_FALLBACK_PHP: Readonly<Record<AiPriceTier, number>> = {
  A: 1499,
  B: 999,
  C: 499,
  D: 99,
  E: 0,
};

/** Resolve an event type to its price tier (default C for unknown types). */
export function setnayanAiTierForEventType(eventType: string | null | undefined): AiPriceTier {
  if (!eventType) return AI_TIER_DEFAULT;
  return AI_TIER_BY_EVENT_TYPE[eventType] ?? AI_TIER_DEFAULT;
}

/** The catalog SKU for a type's price (null when Setnayan AI isn't present). */
export function setnayanAiTierSkuForEventType(eventType: string | null | undefined): string | null {
  return AI_TIER_SKU[setnayanAiTierForEventType(eventType)];
}

/** The fallback price (PHP) for a type, used only when the catalog is unreadable. */
export function setnayanAiTierFallbackPhp(eventType: string | null | undefined): number {
  return AI_TIER_FALLBACK_PHP[setnayanAiTierForEventType(eventType)];
}
