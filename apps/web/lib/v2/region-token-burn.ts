/**
 * V2 · Region-weighted inquiry-burn pricing — the token cost a vendor pays
 * to ANSWER a couple's inquiry / bid request.
 *
 * WHY THIS LIVES HERE
 * -------------------
 * Owner-locked 2026-06-05 (DECISION_LOG + Token_Economy_Flow_Map_2026-06-01):
 * the burn to answer an inquiry was region-weighted 1 / 2 / 3 tokens, keyed to
 * the WEDDING's region (events.region), banded by that region's minimum wage.
 *
 * ⚠ FLATTENED 2026-07-12 (PRICING LOCK ②, DB migration 20270728200000): the
 * burn is now a CONSTANT 1 token for ALL regions — public.regions.burn_band = 1
 * everywhere. Paired with the ₱100 → ₱200 token reprice (migration
 * 20270728100000), every inquiry costs a flat 1 × ₱200 = ₱200. The 1/2/3 band
 * MACHINERY is kept intact below (the DB column + resolver still support bands
 * 1-3 so an admin could re-band from /admin/token-bands), but the live DATA is
 * flat 1, so the effective cost is a uniform ₱200. This SUPERSEDED the earlier
 * 3-4-5-6 ladder.
 *
 * The burn is an anti-spam / skin-in-the-game gate, NOT a value meter:
 * realized booking value is off-platform-invisible (RA 11967) and one
 * burn unlocks the whole (vendor, event) relationship, so it cannot be
 * priced to the booking. It is priced cheap at the low-ticket floor; the
 * value-scaling lives in the region-tiered subscription instead.
 *
 * Bands (retained machinery — currently ALL flattened to band 1 = ₱200 at the
 * ₱200/token rate; the min-wage grouping below is the historical band map an
 * admin could restore):
 *   3 — NCR · CALABARZON · Central Luzon                (wage ≥ ₱600)
 *   2 — Cebu/C.Visayas · Iloilo/W.Visayas · Davao ·
 *       CDO/N.Mindanao · CAR · Ilocos · Cagayan · MIMAROPA   (~₱480-550)
 *   1 — Bicol · E.Visayas · Zamboanga · SOCCSKSARGEN ·
 *       Caraga · BARMM                                       (~₱415-475)
 *
 * Region resolution is now delegated to the canonical region source
 * (lib/region-source · public.regions.burn_band), keyed on the onboarding
 * hyphen slugs that land in events.region ('ncr' · 'calabarzon' · 'c-visayas' ·
 * 'c-luzon' · … · 'abroad'). The underscore variants (lib/match-criteria.ts)
 * and the PSGC codes (vendor_profiles.hq_region) are aliased there too, so the
 * burn lookup is robust to the known region-slug drift across all four
 * vocabularies — that's the whole point of the 2026-06-19 canonical-source fix.
 *
 * WHAT THIS MODULE DOES NOT DO
 * ---------------------------
 * • Does NOT charge anything itself — this module is the pricing DEFINITION only
 *   (a pure region→token-count function). The actual consume is LIVE and lives
 *   in the DB RPC `unlock_vendor_event` (chat acceptInquiry), which burns 1–3
 *   region-banded tokens for VERIFIED / SOLO / PRO / ENTERPRISE vendors (FREE is
 *   blocked; the 2026-06-25 retune put VERIFIED on the burning path too) via
 *   consume_vendor_assets_per_voucher. RECONCILED 2026-07-01 (burn-band single
 *   source · migration 20270331100000): the RPC now resolves events.region →
 *   `public.regions.burn_band` by alias-match — the SAME map this module reads.
 *   The old parallel `token_burn_bands` table is retired (it mis-keyed 6 regions
 *   and under-charged them); there is no longer a second min-wage map to drift.
 * • Pure function of a region slug, never throws (region-source's resolver is
 *   sync + never-throw; on a DB miss it falls back to its static band table).
 * • region→band lives in public.regions.burn_band, admin-editable at
 *   /admin/token-bands (repointed onto regions in the same 2026-07-01 PR);
 *   region-source hydrates from it, and its static fallback mirrors the seed.
 *
 * Cross-references: DECISION_LOG 2026-06-05 · Token_Economy_Flow_Map_2026-06-01.html
 * · CLAUDE-CODE-BRIEF-v2.1 § 2.4 · lib/region-source.ts (canonical region source).
 */

import { resolveRegion } from '@/lib/region-source';

/**
 * Flat DISPLAY price of one vendor token, in pesos. ₱200 since the 2026-07-12
 * PRICING LOCK (token unit ₱100 → ₱200; the CHARGE moved in DB migration
 * 20270728100000_vendor_token_pack_reprice_200). This is the display mirror of
 * that charge — vendor_billing_catalog.price_php ÷ token_grant_count = ₱200 —
 * so every vendor/admin surface reads the same peso figure the pack sells at.
 */
export const TOKEN_PRICE_PHP = 200;

/** The top burn band — a wedding in NCR/CALABARZON/Central Luzon costs this many tokens. */
export const BURN_CEILING_TOKENS = 3;

export type BurnBand = 1 | 2 | 3;

// (The deprecated `BURN_BAND_REGIONS` band→region map was removed 2026-06-25 — it
// was a drift-prone second copy of the mapping, unreferenced by any live code path.
// Burn bands resolve entirely through the canonical region source — region-source.ts
// backed by `public.regions.burn_band` — via `regionBurnTokens()` below.)

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

/** Peso cost of answering an inquiry for a wedding in `region` (tokens × ₱200). */
export function regionBurnPhp(region: string | null | undefined): number {
  return regionBurnTokens(region) * TOKEN_PRICE_PHP;
}
