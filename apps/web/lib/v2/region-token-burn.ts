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
 * Region resolution is now delegated to the canonical region source
 * (lib/region-source · public.regions.burn_band), keyed on the onboarding
 * hyphen slugs that land in events.region ('ncr' · 'calabarzon' · 'c-visayas' ·
 * 'c-luzon' · … · 'abroad'). The underscore variants (lib/match-criteria.ts)
 * and the PSGC codes (vendor_profiles.hq_region) are aliased there too, so the
 * burn lookup is robust to the known region-slug drift across all four
 * vocabularies — that's the whole point of the 2026-06-19 canonical-source fix.
 *
 * WHAT THIS MODULE DOES NOT DO (activation is a separate go-live)
 * --------------------------------------------------------------
 * • Does NOT charge anything. This is the pricing DEFINITION only. The
 *   inquiry-answer path (unlock-category.ts · chat acceptInquiry) is
 *   "economically inert" in the pilot by design; wiring the real
 *   consume_vendor_assets(vendor, regionBurnTokens(event.region)) call is
 *   a deliberate post-pilot activation that needs owner sign-off.
 * • Pure function of a region slug, never throws (region-source's resolver is
 *   sync + never-throw; on a DB miss it falls back to its static band table).
 * • region→band now lives in public.regions.burn_band (admin-editable when the
 *   region table gets an editor); region-source hydrates from it, and the
 *   static fallback in region-source is the V1 source of truth until then.
 *
 * Cross-references: DECISION_LOG 2026-06-05 · Token_Economy_Flow_Map_2026-06-01.html
 * · CLAUDE-CODE-BRIEF-v2.1 § 2.4 · lib/region-source.ts (canonical region source).
 */

import { resolveRegion } from '@/lib/region-source';

/** Flat price of one vendor token, in pesos (owner-locked "₱100, no more 250"). */
export const TOKEN_PRICE_PHP = 100;

/** The top burn band — a wedding in NCR/CALABARZON/Central Luzon costs this many tokens. */
export const BURN_CEILING_TOKENS = 3;

export type BurnBand = 1 | 2 | 3;

/**
 * @deprecated Burn bands are now resolved through the canonical region source
 * (lib/region-source.ts · public.regions.burn_band), which absorbs every
 * spelling. This const is kept ONLY for lineage / any direct importer; new code
 * should call `regionBurnTokens()` (which reads region-source) instead.
 *
 * Human-editable source of truth (pre-fix): which region slugs sit in each burn
 * band. Onboarding slugs (events.region) first, then the underscore variants
 * (lib/match-criteria.ts) and PSGC codes (vendor_profiles.hq_region) as aliases.
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

/**
 * Tokens a vendor burns to answer an inquiry for a wedding in `region`.
 * `region` is events.region (an onboarding slug), but resolution now goes
 * through the canonical region source, so ANY of the four spellings (hyphen
 * slug · underscore variant · PSGC code · 'cagayan-valley') resolves correctly.
 * Unknown / null / 'abroad' resolve to DEFAULT_BURN_BAND (1). Pure · never
 * throws (region-source's resolver never throws; on a DB miss it falls back to
 * the static band table).
 */
export function regionBurnTokens(region: string | null | undefined): BurnBand {
  return resolveRegion(region)?.burn_band ?? DEFAULT_BURN_BAND;
}

/** Peso cost of answering an inquiry for a wedding in `region` (tokens × ₱100). */
export function regionBurnPhp(region: string | null | undefined): number {
  return regionBurnTokens(region) * TOKEN_PRICE_PHP;
}
