/**
 * setnayan-ai-type-pricing.ts — per-EVENT-TYPE Setnayan AI pricing (pure).
 *
 * Owner-locked 2026-07-22 ("go"): Setnayan AI is priced by AI LOAD — "how much
 * data is needed to help them" — on a DISCRETE 5-point ladder, not a range.
 *
 * ⚠ THIS HEADER LISTED PRICES THAT HAD NOT BEEN TRUE FOR MONTHS — it said
 * A ₱1,499 · B ₱899 · C ₱499 · D ₱99 while the constants below said 2,499 /
 * 1,499 / 899 / 199. A docblock that quotes prices becomes a second price list
 * the moment anybody reprices, so it now names the BANDS and the catalog, and
 * quotes no amount at all:
 *
 *   Tier A  Wedding
 *   Tier B  Debut · Corporate · Gala Night
 *   Tier C  Christening · Birthday · Celebration · Travel · Anniversary ·
 *           Graduation · Reunion          ← also where an UNASSIGNED kind lands
 *   Tier D  Tournament · Gender reveal · Date · Hangout
 *   Tier E  Simple Event — Setnayan AI is NOT OFFERED (no vendors to reach).
 *           ⚠ "not offered" is not "free"; there is no SKU and no price row.
 *
 * The live amounts are in `platform_retail_catalog_v2` and are owner-editable at
 * /admin/pricing → "Setnayan AI prices". The band ASSIGNMENT is likewise owner-
 * editable since 2026-08-28 and lives in `event_type_vocab.ai_price_tier`; the
 * map below is the fallback for an unreadable read.
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
 * event_type → tier (2026-07-22 reach study + owner locks). Anniversary /
 * graduation / reunion sit at C. Tournament dropped C → D (₱99 — ~25% reach, a
 * few specialist vendors; Travel stays C for the itinerary engine). gala_night =
 * B (₱899 — its 84% reach is Debut-level). date / hangout = D (₱99 — short
 * casual outings). simple_event = E (no vendors). Unknown types default to C.
 * See DECISION_LOG 2026-07-22 + the reach-matrix study.
 */
export const AI_TIER_BY_EVENT_TYPE: Readonly<Record<string, AiPriceTier>> = {
  wedding: 'A',
  debut: 'B',
  corporate: 'B',
  christening: 'C',
  birthday: 'C',
  celebration: 'C',
  travel: 'C',
  tournament: 'D',
  anniversary: 'C',
  graduation: 'C',
  reunion: 'C',
  gender_reveal: 'D',
  gala_night: 'B', // ₱899 — its 84% reach is Debut-level (owner-locked 2026-07-22).
  date: 'D', // casual romantic outing (dinner/lunch/movie date) — ₱99, Tier D.
  hangout: 'D', // casual barkada get-together (coffee, movie night) — ₱99, Tier D.
  simple_event: 'E',
  // ⚠ THE DEFAULT MADE EXPLICIT, NOT A PRICE DECISION. The owner approved the
  // funeral TYPE (2026-08-17) and has not tiered it; 'C' is exactly what an
  // unmapped type resolves to in code AND in the DB's setnayan_ai_price_tier()
  // ELSE branch, so this entry changes nothing — it only satisfies the
  // coverage guard's "no silent ₱499 default" rule by making the ₱499 visible.
  // Whether the assisted planner should offer itself for a funeral at all, or
  // at a different rung, is flagged as an open owner decision.
  wake: 'C',
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

/**
 * Last-resort REGULAR price per tier (catalog wins). Matches the locked ladder.
 * This is what an event pays to switch Setnayan AI on AFTER onboarding.
 */
export const AI_TIER_FALLBACK_PHP: Readonly<Record<AiPriceTier, number>> = {
  A: 2499,
  B: 1499,
  C: 899,
  D: 199,
  E: 0,
};

/**
 * Last-resort SIGN-UP price per tier — what the couple pays when they buy
 * Setnayan AI while creating the event (owner-locked 2026-08-12).
 *
 * ⚠ THESE TWO LADDERS MUST NEVER CROSS. The sign-up price is a discount, so
 * every rung must be ≤ its regular twin; a sign-up price ABOVE the regular one
 * would quietly punish the customer for buying early, which is the opposite of
 * the decision. `setnayan-ai-price-display-matches-charge.test.ts` asserts the
 * ordering rung by rung, so a future edit to one ladder cannot silently invert
 * the other.
 *
 * Catalog still wins (`onboarding_price_php`); these are the numbers used only
 * when the row is unreadable, so the charge degrades to the right price rather
 * than to zero or to full price.
 */
export const AI_TIER_ONBOARDING_FALLBACK_PHP: Readonly<Record<AiPriceTier, number>> = {
  A: 1499,
  B: 899,
  // ⚖ MOVED 2026-08-28 BY THE OWNER'S SINGLE-DISCOUNT RULING, not by a code
  // decision: all four bands now share ONE sign-up discount of 40%, replacing
  // four per-band discounts that had drifted to 40.02 / 40.03 / 44.49 / 50.25.
  // At 40% and whole-peso rounding, A and B are unchanged and these two move:
  //   C  ₱899 → ₱539  (was ₱499)
  //   D  ₱199 → ₱119  (was  ₱99)
  // He was shown this arithmetic and chose the number knowing it. These
  // constants are the LAST-RESORT values used only when the catalog row is
  // unreadable, so they must track the catalog or an outage would charge the
  // old price — which is what ai-tier-ladder-matches-the-catalog.db.test.ts
  // exists to catch, and what it caught here.
  C: 539,
  D: 119,
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

/**
 * Which of the two prices applies. `onboarding` is the discount a couple gets
 * for buying while they create the event; `regular` is everything afterwards.
 *
 * 🔒 SERVER-DECIDED, NEVER CLIENT-SUPPLIED. The only caller that may pass
 * `onboarding` is the event-commit path, which runs on the server — otherwise a
 * browser could ask for the cheap price at any time. Everything else defaults
 * to `regular`, so a new call site cannot get the discount by omission.
 */
export type AiPriceContext = 'onboarding' | 'regular';

/** The fallback price (PHP) for a type, used only when the catalog is unreadable. */
export function setnayanAiTierFallbackPhp(
  eventType: string | null | undefined,
  context: AiPriceContext = 'regular',
): number {
  const tier = setnayanAiTierForEventType(eventType);
  return context === 'onboarding'
    ? AI_TIER_ONBOARDING_FALLBACK_PHP[tier]
    : AI_TIER_FALLBACK_PHP[tier];
}
