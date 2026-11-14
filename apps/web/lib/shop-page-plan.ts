/**
 * shop-page-plan.ts — what the public shop page (`/v/[slug]`) shows by plan, for the pieces the supplier website by
 * plan (owner-approved 2026-10-30, `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`, its "What shows,
 * by plan" table) adds to the card column: the reach line + ring, the shop's own web address, the pinned review.
 *
 * 🔑 NO SECOND COPY OF A CAP. Every number and every "which plan" is read from the shipped sources:
 *   · reach  — `effectiveOuterRadiusKm` (lib/vendor-service-radius.ts): the plan's `serviceRadiusKm` (read from
 *              lib/vendor-tier-caps.ts — Ultra is `Infinity`, "nationwide", since 2026-11-04) clamping the shop's own
 *              declared outer ring — the SAME number couples' search and the supplier's own Where you work map draw;
 *   · own address — `tierCaps(tier).customWebsiteName` (Supplier Plus and up since 2026-11-04; the Pro page parts read
 *              `premiumPage`, the cap the page calls `premiumLayout`);
 *   · pinned review — the page's own `proPicksRender` (Pro+, flag-aware) and `reviewCommentsViewable`.
 *
 * Pure, so its test executes it.
 */
import { effectiveOuterRadiusKm } from './vendor-service-radius';

export type ShopReach =
  /** Couples find this shop by distance: "Serves up to 20 km around Tagaytay". */
  | { kind: 'ring'; km: number }
  /** A shop Setnayan has not verified yet reaches 0 km (owner 2026-10-29, "Free = 0 km because unverified"). */
  | { kind: 'until_verified' }
  /** Verified, on a plan that reaches nationwide (Ultra, owner 2026-11-04) and no narrower ring of its own. */
  | { kind: 'nationwide' }
  /** Verified, and the plan/declaration still gives no ring — say the city only, never a claim. */
  | { kind: 'city_only' };

export function shopReach(input: {
  verified: boolean;
  tier: string | null | undefined;
  declaredOuterKm: number | null | undefined;
}): ShopReach {
  if (!input.verified) return { kind: 'until_verified' };
  const km = effectiveOuterRadiusKm(input.declaredOuterKm, input.tier);
  if (km === Infinity) return { kind: 'nationwide' };
  return Number.isFinite(km) && km > 0 ? { kind: 'ring', km } : { kind: 'city_only' };
}

/**
 * 📍 DOES THE SHOP HAVE A "WHERE"? (map card follow-up, live re-walk 2026-11-14.) The calm shop page's Where tab and
 * its section are drawn only when there is something to put behind them: a pin (a map + Get directions) or an address
 * or city (the reach line + a Get directions search). A shop with none of those got a "Where" tab that scrolled to an
 * empty heading. One answer for the tab AND the section, so they can never disagree.
 */
export function shopHasWhere(place: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address: string | null | undefined;
  city: string | null | undefined;
}): boolean {
  const pinned =
    place.latitude != null && place.longitude != null && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
  return pinned || Boolean(place.address?.trim()) || Boolean(place.city?.trim());
}

/** The reach fact line's words. Null when there is no city to say it about. */
export function shopReachLine(reach: ShopReach, city: string | null | undefined): string | null {
  const c = city?.trim();
  if (!c) return reach.kind === 'ring' ? `Serves up to ${reach.km} km` : reach.kind === 'nationwide' ? 'Serves nationwide' : null;
  if (reach.kind === 'ring') return `Serves up to ${reach.km} km around ${c}`;
  if (reach.kind === 'nationwide') return `${c} · serves nationwide`;
  if (reach.kind === 'until_verified') return `${c} · distance search opens once verified`;
  return c;
}

/**
 * "Also in Lipa · Batangas City" — the shop's OTHER branches, under the reach line (owner 2026-11-13, verbatim:
 * *"Show the branches as needed"*). The cities come from the shop's paid, live branches (`fetchPublicVendorBranches`,
 * `lib/vendor-branches.ts` — Pro and Ultra include them, `TIER_CAPS[t].branchesIncluded`). "As needed" = a shop with
 * no branch, or none with a city, gets NO line at all: never an empty "Also in", never a teaser for a lower plan.
 * A city equal to the shop's own (the reach line already names it) and a repeat are said once / not at all.
 */
export function shopAlsoInLine(
  branchCities: ReadonlyArray<string | null | undefined>,
  hqCity?: string | null,
): string | null {
  const own = hqCity?.trim().toLowerCase() ?? '';
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const raw of branchCities) {
    const c = raw?.replace(/\s+/g, ' ').trim();
    if (!c) continue;
    const k = c.toLowerCase();
    if (k === own || seen.has(k)) continue;
    seen.add(k);
    cities.push(c);
  }
  return cities.length > 0 ? `Also in ${cities.join(' · ')}` : null;
}

/**
 * The shop's own web address, shown "sampaguitatable.com → this page" (approved Q4 = A: the shop's own domain pointing
 * at the page). Supplier Plus and up (`customWebsiteName`, owner 2026-11-04), and only a domain the verification backend has stamped — an
 * unverified row is a domain that does not point here yet. Lower-cased and bare (no scheme, no slash).
 */
export function ownWebAddress(input: {
  planAllows: boolean;
  domain: string | null | undefined;
  verifiedAt: string | null | undefined;
}): string | null {
  if (!input.planAllows || !input.verifiedAt) return null;
  const d = (input.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

/** The first line of a review's words for the card column's pinned quote — whole words, at most `max` characters. */
export function pinnedQuote(body: string | null | undefined, max = 160): string | null {
  const t = (body ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > 40 ? cut.slice(0, at) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
}
