/**
 * V2 · Region-weighted inquiry-burn pricing — the token cost a vendor pays
 * to ANSWER a couple's inquiry / bid request.
 *
 * WHY THIS LIVES HERE
 * -------------------
 * Owner-locked 2026-06-05 (DECISION_LOG + Token_Economy_Flow_Map_2026-06-01):
 * the burn to answer an inquiry is region-weighted 1 / 2 / 3 tokens
 * (= ₱100 / ₱200 / ₱300 at ₱100/token, ₱300 ceiling), keyed to the
 * WEDDING's region (events.region), banded by that region's minimum wage.
 * This SUPERSEDES the earlier 3-4-5-6 ladder.
 *
 * The burn is an anti-spam / skin-in-the-game gate, NOT a value meter:
 * realized booking value is off-platform-invisible (RA 11967) and one
 * burn unlocks the whole (vendor, event) relationship, so it cannot be
 * priced to the booking. It is priced cheap at the low-ticket floor; the
 * value-scaling lives in the region-tiered subscription instead.
 *
 * Bands (by non-agri daily minimum wage; NCR ₱695 top, mid-2026):
 *   3 (₱300) — NCR · CALABARZON · Central Luzon                (wage ≥ ₱600)
 *   2 (₱200) — Cebu/C.Visayas · Iloilo/W.Visayas · Davao ·
 *              CDO/N.Mindanao · CAR · Ilocos · Cagayan · MIMAROPA   (~₱480-550)
 *   1 (₱100) — Bicol · E.Visayas · Zamboanga · SOCCSKSARGEN ·
 *              Caraga · BARMM                                       (~₱415-475)
 *
 * Keys are the onboarding region slugs that actually land in events.region
 * (see ONBOARDING_REGION_TO_PSGC in lib/regions.ts: 'ncr' · 'calabarzon' ·
 * 'c-visayas' · 'w-visayas' · 'c-luzon' · 'ilocos' · 'cagayan' · 'bicol' ·
 * 'mimaropa' · 'e-visayas' · 'zamboanga' · 'n-mindanao' · 'davao' ·
 * 'soccsksargen' · 'caraga' · 'barmm' · 'car' · 'abroad'). The underscore
 * variants used by lib/match-criteria.ts and the PSGC codes used by
 * vendor_profiles.hq_region are aliased too, so the lookup is robust to the
 * known region-slug drift across those three vocabularies.
 *
 * WHAT THIS MODULE DOES NOT DO (activation is a separate go-live)
 * --------------------------------------------------------------
 * • Does NOT charge anything. This is the pricing DEFINITION only. The
 *   inquiry-answer path (unlock-category.ts · chat acceptInquiry) is
 *   "economically inert" in the pilot by design; wiring the real
 *   consume_vendor_assets(vendor, regionBurnTokens(event.region)) call is
 *   a deliberate post-pilot activation that needs owner sign-off.
 * • Does NOT read the DB · pure function of a region slug, never throws.
 * • region→band SHOULD migrate to an admin-editable table when activated
 *   (re-band a region only when a wage order crosses a threshold); this
 *   constant is the V1 source of truth until then.
 *
 * Cross-references: DECISION_LOG 2026-06-05 · Token_Economy_Flow_Map_2026-06-01.html
 * · CLAUDE-CODE-BRIEF-v2.1 § 2.4 · lib/regions.ts ONBOARDING_REGION_TO_PSGC.
 */

/** Flat price of one vendor token, in pesos (owner-locked "₱100, no more 250"). */
export const TOKEN_PRICE_PHP = 100;

/** The top burn band — a wedding in NCR/CALABARZON/Central Luzon costs this many tokens. */
export const BURN_CEILING_TOKENS = 3;

export type BurnBand = 1 | 2 | 3;

/**
 * Human-editable source of truth: which region slugs sit in each burn band.
 * Onboarding slugs (events.region) first, then the underscore variants
 * (lib/match-criteria.ts) and PSGC codes (vendor_profiles.hq_region) as
 * aliases. When the burn economy activates, this should move to an
 * admin-editable table; until then it is the canonical mapping.
 */
export const BURN_BAND_REGIONS: Readonly<Record<BurnBand, readonly string[]>> = {
  3: ['ncr', 'calabarzon', 'c-luzon', 'central_luzon', 'IV-A', 'III'],
  2: [
    'c-visayas', 'central_visayas', 'w-visayas', 'western_visayas',
    'davao', 'n-mindanao', 'northern_mindanao', 'car', 'ilocos', 'cagayan',
    'mimaropa', 'VII', 'VI', 'XI', 'X', 'CAR', 'I', 'II', 'IV-B',
  ],
  1: [
    'bicol', 'e-visayas', 'eastern_visayas', 'zamboanga', 'soccsksargen',
    'caraga', 'barmm', 'V', 'VIII', 'IX', 'XII', 'XIII', 'BARMM',
  ],
} as const;

/**
 * Default band for an unknown / null / 'abroad' region — the kind floor.
 * The burn is an anti-spam gate, so an edge-case lead never costs more
 * than the cheapest band.
 */
export const DEFAULT_BURN_BAND: BurnBand = 1;

// Derived reverse lookup: region slug (lowercased) → band. Built once at load.
const REGION_TO_BAND = new Map<string, BurnBand>();
for (const [band, regions] of Object.entries(BURN_BAND_REGIONS)) {
  for (const slug of regions) {
    REGION_TO_BAND.set(slug.toLowerCase(), Number(band) as BurnBand);
  }
}

/**
 * Tokens a vendor burns to answer an inquiry for a wedding in `region`.
 * `region` is events.region (an onboarding slug). Unknown / null /
 * 'abroad' resolve to DEFAULT_BURN_BAND (1). Never throws.
 */
export function regionBurnTokens(region: string | null | undefined): BurnBand {
  if (!region) return DEFAULT_BURN_BAND;
  return REGION_TO_BAND.get(region.trim().toLowerCase()) ?? DEFAULT_BURN_BAND;
}

/** Peso cost of answering an inquiry for a wedding in `region` (tokens × ₱100). */
export function regionBurnPhp(region: string | null | undefined): number {
  return regionBurnTokens(region) * TOKEN_PRICE_PHP;
}
