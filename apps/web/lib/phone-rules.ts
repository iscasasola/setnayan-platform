import { parsePhPhone, type PhPhone } from './ph-phone';

/**
 * Which number rule applies where — the seam a second country slots into.
 *
 * Owner 2026-08-10: *"just place that variable. so it will be easy to add
 * countries next time. but for now, it is true that it will be just philippines
 * for now for the vendors."*
 *
 * ── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
 * It is the ONE place that answers "given where this shop is, is this number
 * real?". Today there is exactly one entry, because `lib/geo.ts` restricts both
 * geocoder lookups to `countrycodes=ph` and a vendor cannot pin a foreign
 * address at all.
 *
 * It is NOT a country matrix pretending to be finished. The value of writing it
 * now is that the country flows through the code as a VALUE — captured from the
 * pin, stored on the shop, passed to this function — so adding Singapore later
 * is a new entry rather than threading a new argument through every caller
 * under live data.
 *
 * ── 🔑 WHEN THE SECOND COUNTRY ARRIVES, DO NOT HAND-WRITE ITS RULES ─────────
 * The Philippine rules below were hand-written, and within an hour of shipping
 * they had missed an entire carrier's mobile range (DITO's 0895–0899) and
 * accepted area codes the plan never assigned. That is ONE country, written
 * carefully, by someone reading the plan. Doing that two hundred times is not a
 * bigger version of the same job — it is a numbering-plan database, and one
 * already exists (`libphonenumber`).
 *
 * So the second country is the moment to replace this map's contents with a
 * library, not the moment to add a second hand-written parser. The shape here
 * is designed to make that swap a one-file change.
 *
 * ── AND THE OTHER THING THAT MOVES THAT DAY ────────────────────────────────
 * The wizard asks for the contact number on step 3 and the location on step 4.
 * That order only works while the country is known in advance. The day a second
 * country opens, **the location step must come first** — otherwise the number
 * is validated before anyone knows which rules apply. Merging the two steps was
 * considered and rejected: step 4's map needs the whole screen.
 */

/** Countries a vendor can currently be in. One, deliberately. */
export const SUPPORTED_VENDOR_COUNTRIES = ['PH'] as const;
export type VendorCountry = (typeof SUPPORTED_VENDOR_COUNTRIES)[number];

export function isSupportedVendorCountry(c: string | null | undefined): c is VendorCountry {
  return !!c && (SUPPORTED_VENDOR_COUNTRIES as readonly string[]).includes(c.toUpperCase());
}

const RULES: Record<VendorCountry, (raw: string) => PhPhone> = {
  PH: parsePhPhone,
};

/**
 * Check a contact number against the rules of the country the shop is in.
 *
 * An unknown or unset country falls back to the Philippines rather than
 * accepting anything. That is the honest default while the map cannot produce
 * anything else — and it fails CLOSED, so if the map is ever opened without
 * this map being updated, foreign numbers are refused rather than waved
 * through. A refusal gets reported; a silent acceptance does not.
 */
export function parseVendorPhone(raw: string, country?: string | null): PhPhone {
  const key: VendorCountry = isSupportedVendorCountry(country)
    ? (country.toUpperCase() as VendorCountry)
    : 'PH';
  return RULES[key](raw);
}
