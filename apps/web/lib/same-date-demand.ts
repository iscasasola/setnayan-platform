/**
 * same-date-demand.ts — the HONEST "others are competing for your date" count.
 *
 * Explore_Replan_BUILD_SPEC_2026-07-27.md §15.3. The signal that already
 * shipped (`eyeingByVendorId`) is real data measuring the WRONG act: it counts
 * `event_vendors` rows in `status IN ('considering','contracted')`, and
 * `'considering'` is written by merely SAVING a vendor — `saveVendorToPicks`
 * (`app/explore/actions.ts`) and the onboarding importer both insert it with
 * zero contact ever made. The owner's ruling, 2026-06-02
 * (`Schedule_Matrix_and_Date_Finder_2026-06-02.md:141`, DECISION_LOG.md:470):
 *
 *   "Starts at the inquiry (Stage 2), NEVER at search (Stage 1) … counting it
 *    as competition = manufactured scarcity (a fineable dark pattern)."
 *
 * So this module discriminates on THREAD EXISTENCE. `chat_threads` is
 * `UNIQUE (event_id, vendor_profile_id)`, and a row is created only when a
 * couple actually reaches out — `_actions/unlock-category.ts` is the canonical
 * pattern (it inserts `'considering'` AND fires an auto-inquiry), as is the
 * manual inquiry path in `app/v/[slug]/inquiry-actions.ts`. A vendor a couple
 * merely bookmarked has no thread and therefore contributes ZERO here.
 *
 * Two further honesty rules are baked in rather than left to callers:
 *
 * • MIN-N FLOOR. Nothing below `MIN_DEMAND_COUPLE_COUNT` is returned at all —
 *   `Schedule_Matrix_and_Date_Finder_2026-06-02.md` §8.3 is explicit: "Don't
 *   show a '1'." A count of one, on a solo vendor, for an exact date in a small
 *   municipality, is functionally re-identifying. Because the floor is applied
 *   HERE (server side), a below-floor count is never serialised to a client.
 *
 * • EXACT-DATE ONLY, and we say so. The upstream query is
 *   `.eq('events.event_date', eventDate)` — a same-day match on a `date`
 *   column. A couple whose date is still "sometime in June" has no exact date
 *   to match, so no count exists for them and none is fabricated. There is no
 *   month/year fallback and this module does not invent one.
 *
 * What this module deliberately does NOT do: express capacity. "N slots left"
 * is not buildable — `vendor_schedule_pool_bookings` has no cross-couple SELECT
 * policy, and soft holds never consume capacity anyway — so no caller may
 * render "only N left" / "booking fast" / "almost gone" off this number. The
 * only supported phrasing is the measurement itself: "N couples inquired for
 * your date".
 *
 * Pure + framework-free so the two rules above are unit-testable without a
 * database.
 */

import { MIN_DEMAND_COUPLE_COUNT } from './compat-score';

/** One `event_vendors` row from another couple's plan, narrowed upstream to the
 *  same exact event date. */
export type SameDateHold = {
  /** `event_vendors.marketplace_vendor_id`. Null for off-platform / manual
   *  picks, which can never carry demand and are skipped. */
  marketplaceVendorId: string | null;
  /** The OTHER couple's `event_id`. Deduped — one couple who saved the same
   *  vendor under two categories is still one couple. */
  eventId: string;
};

/** Stable key for the "(this event, this vendor) opened a thread" set. */
export function inquiryPairKey(eventId: string, vendorProfileId: string): string {
  return `${eventId}|${vendorProfileId}`;
}

/**
 * Group same-date holds into `vendorProfileId → Set<eventId>`.
 *
 * This is the SAVE-INCLUSIVE grouping — it is the raw input, not a publishable
 * count. It exists so the honest count below and the legacy chip can share one
 * query, and so `allHoldingEventIds` can bound the follow-up thread read.
 */
export function groupHoldsByVendor(
  holds: readonly SameDateHold[],
): Map<string, Set<string>> {
  const byVendor = new Map<string, Set<string>>();
  for (const h of holds) {
    if (!h.marketplaceVendorId) continue;
    const set = byVendor.get(h.marketplaceVendorId) ?? new Set<string>();
    set.add(h.eventId);
    byVendor.set(h.marketplaceVendorId, set);
  }
  return byVendor;
}

/** Every distinct other-couple `event_id` across the holds — the exact `IN`
 *  list for the `chat_threads` read, so that read can never be a table scan. */
export function allHoldingEventIds(holds: readonly SameDateHold[]): string[] {
  const ids = new Set<string>();
  for (const h of holds) {
    if (!h.marketplaceVendorId) continue;
    ids.add(h.eventId);
  }
  return [...ids];
}

/**
 * The publishable count: `vendorProfileId → number of OTHER couples who both
 * hold this vendor on the same exact date AND have actually inquired`.
 *
 * A vendor is ABSENT from the returned map when its inquiry-backed count is
 * below `MIN_DEMAND_COUPLE_COUNT`. Absent means "no signal" — the scorer reads
 * it as NEUTRAL and no card renders anything. It never means zero-as-a-penalty.
 */
export function countInquiringCouples(
  holdsByVendor: ReadonlyMap<string, ReadonlySet<string>>,
  inquiredPairs: ReadonlySet<string>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [vendorProfileId, eventIds] of holdsByVendor) {
    let inquired = 0;
    for (const eventId of eventIds) {
      if (inquiredPairs.has(inquiryPairKey(eventId, vendorProfileId))) inquired += 1;
    }
    if (inquired >= MIN_DEMAND_COUPLE_COUNT) out.set(vendorProfileId, inquired);
  }
  return out;
}

export { MIN_DEMAND_COUPLE_COUNT };
