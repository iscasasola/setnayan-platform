/**
 * shop-page-plan.ts — what the public shop page (`/v/[slug]`) shows by plan, for the pieces the supplier website by
 * plan (owner-approved 2026-10-30, `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`, its "What shows,
 * by plan" table) adds to the card column: the reach line + ring, the shop's own web address, the pinned review.
 *
 * 🔑 NO SECOND COPY OF A CAP. Every number and every "which plan" is read from the shipped sources:
 *   · reach  — `effectiveOuterRadiusKm` (lib/vendor-service-radius.ts): the plan's `serviceRadiusKm` (Free 0 ·
 *              Verified 20 · Solo 30 · Pro 50 · Ultra 100, lib/vendor-tier-caps.ts) clamping the shop's own declared
 *              outer ring — the SAME number couples' search and the supplier's own Where you work map draw;
 *   · own address — `tierCaps(tier).customWebsiteName` (Pro+), the cap the page already calls `premiumLayout`;
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
  /** Verified, and the plan/declaration still gives no ring — say the city only, never a claim. */
  | { kind: 'city_only' };

export function shopReach(input: {
  verified: boolean;
  tier: string | null | undefined;
  declaredOuterKm: number | null | undefined;
}): ShopReach {
  if (!input.verified) return { kind: 'until_verified' };
  const km = effectiveOuterRadiusKm(input.declaredOuterKm, input.tier);
  return Number.isFinite(km) && km > 0 ? { kind: 'ring', km } : { kind: 'city_only' };
}

/** The reach fact line's words. Null when there is no city to say it about. */
export function shopReachLine(reach: ShopReach, city: string | null | undefined): string | null {
  const c = city?.trim();
  if (!c) return reach.kind === 'ring' ? `Serves up to ${reach.km} km` : null;
  if (reach.kind === 'ring') return `Serves up to ${reach.km} km around ${c}`;
  if (reach.kind === 'until_verified') return `${c} · distance search opens once verified`;
  return c;
}

/**
 * The shop's own web address, shown "sampaguitatable.com → this page" (approved Q4 = A: the shop's own domain pointing
 * at the page). Pro+ only (`customWebsiteName`), and only a domain the verification backend has stamped — an
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
