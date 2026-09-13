/**
 * setnayan-ai-free-assist.ts — the FREE first-venue-shortlist carve-out
 * (owner-locked 2026-07-09 · Pricing.md § 00).
 *
 * Sai's (Setnayan AI's) reception-VENUE finding is the free taste that
 * introduces the full planner: every couple — subscribed or not — gets Sai
 * to build their FIRST reception-venue shortlist, once, free. Precisely:
 *
 *   • The offer renders ONLY while the event's venue-category shortlist is
 *     EMPTY (zero `event_vendors` picks in the venue category). Once anything
 *     lands on the venue shortlist — Sai-built or manual — the offer is gone.
 *     The shortlist state itself records consumption; there is no column, no
 *     table, no flag (owner refinement 2026-07-09: "NO migration").
 *   • The build action (progress route `_actions/free-venue-shortlist.ts`)
 *     assembles up to {@link FIRST_VENUE_SHORTLIST_CAP} compatible reception
 *     venues from real marketplace data and is deliberately NOT AI-gated —
 *     it must work for free accounts. Everything else (other categories, the
 *     guard/secretary/briefing layer) keeps the normal subscription gate:
 *     ₱499 first 28-day cycle → ₱799/28d.
 *
 * Pure + I/O-free + unit-testable: predicates and copy only. The venue key is
 * DERIVED from the canon (`PLAN_GROUPS` / `VendorCategory`) rather than
 * restated, so a taxonomy rename can never silently strand this carve-out.
 */

import type { VendorCategory } from './vendors';
import { PLAN_GROUPS, type PlanGroupId } from './wedding-plan-groups';

/**
 * The categories whose Sai assistance is free. Canonical key: `'venue'` is
 * the reception-venue member of the `VendorCategory` enum (plan group
 * `reception_venue` — `ceremony_venue` deliberately uses `religious_venue` /
 * `church_fees` instead, so this set never leaks the free offer there).
 */
export const SAI_FREE_ASSIST_CATEGORIES: ReadonlyArray<VendorCategory> = ['venue'];

const FREE_CATEGORY_SET: ReadonlySet<string> = new Set<string>(
  SAI_FREE_ASSIST_CATEGORIES,
);

/** Is Sai's category-level assistance free for this vendor category? */
export function isSaiAssistFreeForCategory(
  category: string | null | undefined,
): boolean {
  return category != null && FREE_CATEGORY_SET.has(category);
}

/**
 * Plan groups covered by the carve-out — derived from PLAN_GROUPS membership
 * (a group is free-assisted when ANY of its categories is free-assisted).
 * Today this resolves to exactly `['reception_venue']`.
 */
export const SAI_FREE_ASSIST_PLAN_GROUP_IDS: ReadonlyArray<PlanGroupId> =
  PLAN_GROUPS.filter((g) =>
    g.categories.some((c) => FREE_CATEGORY_SET.has(c)),
  ).map((g) => g.id);

const FREE_GROUP_SET: ReadonlySet<string> = new Set<string>(
  SAI_FREE_ASSIST_PLAN_GROUP_IDS,
);

/** Is Sai's assistance free for this plan group? */
export function isSaiAssistFreeForPlanGroup(
  groupId: string | null | undefined,
): boolean {
  return groupId != null && FREE_GROUP_SET.has(groupId);
}

/**
 * Does a cockpit decision id (`pick:<groupId>` / `start:<groupId>` — see
 * lib/setnayan-ai-cockpit) point at a free-assisted plan group? Other kinds
 * (`role:*`, `pay:*`) are never free-assisted.
 */
export function isSaiAssistFreeDecisionId(
  decisionId: string | null | undefined,
): boolean {
  if (!decisionId) return false;
  const sep = decisionId.indexOf(':');
  if (sep <= 0) return false;
  const kind = decisionId.slice(0, sep);
  if (kind !== 'pick' && kind !== 'start') return false;
  return FREE_GROUP_SET.has(decisionId.slice(sep + 1));
}

/** Hard cap on how many venues the free first shortlist may attach. */
export const FIRST_VENUE_SHORTLIST_CAP = 5;

/**
 * Offer visibility — "first" semantics. The offer is available ONLY while the
 * event's venue-category shortlist is empty; ANY venue pick (Sai-built or
 * manual, any status) consumes it. Pass the event's live, non-archived
 * `event_vendors` rows (the same rows the progress page / bench already load).
 */
export function isFirstVenueShortlistOfferAvailable(
  vendorRows: ReadonlyArray<{ category: string }>,
): boolean {
  return !vendorRows.some((r) => isSaiAssistFreeForCategory(r.category));
}

/**
 * The bench deep-link for the reception-venue category — derived from the
 * reception plan group's `catalogTile` so it always matches the Shortlist
 * surface's `?open=<tile>` contract (vendors page → ShortlistCategories).
 */
const RECEPTION_TILE: string =
  PLAN_GROUPS.find((g) => FREE_GROUP_SET.has(g.id))?.catalogTile ?? 'reception';

export function freeVenueAssistBenchHref(eventId: string): string {
  return `/dashboard/${eventId}/vendors?open=${encodeURIComponent(RECEPTION_TILE)}`;
}

// ── Couple-facing copy (kept here so the strings are unit-locked) ──────────

/** Small badge text on free-assist surfaces. */
export const FREE_VENUE_ASSIST_BADGE = 'Setnayan AI · Free';

/** Chip on the vendors bench's venue category row (offer live only). */
export const FREE_VENUE_ASSIST_CHIP = 'First shortlist free ✦';

export const FIRST_VENUE_SHORTLIST_OFFER_TITLE =
  'Let Sai find your first venue shortlist — free';

export const FIRST_VENUE_SHORTLIST_OFFER_SUB = `Sai — the Setnayan AI planner — picks up to ${FIRST_VENUE_SHORTLIST_CAP} reception venues that fit your date, budget & area and puts them on your shortlist. Your first venue shortlist is its free introduction.`;

/** The ONE quiet upsell line under the offer (carve-out pricing, § 00). */
export const FIRST_VENUE_SHORTLIST_UPSELL =
  'Venue help starts free — the full Sai is ₱499 first 28 days → ₱799 per 28 days.';

/** Post-build confirmation — the upsell beat after Sai fills the shortlist. */
export function firstVenueShortlistConfirmation(added: number): string {
  const noun = added === 1 ? 'venue' : 'venues';
  return `Sai shortlisted ${added} ${noun} that fit your date, budget & area — this is what the full Sai does. ₱499 first 28 days → ₱799/28d.`;
}
