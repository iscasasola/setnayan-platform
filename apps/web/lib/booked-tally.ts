/**
 * 📌 THE ONE BOOKED READER (L5 · C2 / C7, walkthrough 27 Nov).
 *
 * One event showed four different "booked" numbers on four screens: Home
 * "11 of 25", Build "11 of 11", Book "3 booked · 9 waiting", Budget 12. Two
 * facts were being counted, each in more than one way:
 *
 *   · BOOKED SUPPLIERS: the people the couple has a booking with. One per
 *     supplier, never one per row: a supplier who "also covers" a second
 *     category is still one booking. Booked = `BOOKED_EVENT_VENDOR_STATUSES`,
 *     the set CLAUDE.md §4 names; no screen keeps its own copy.
 *   · BOOKED CATEGORIES: the categories on the event (the rows Find lists)
 *     and how many of them hold a booked supplier. "Listed" is Find's own rule
 *     (`resolveInPlanTiles` with `listedOnly`): a category holding one of the
 *     couple's suppliers, not removed, plus every category with a booking (a
 *     booking is never hidden). Photo and video booked separately are TWO
 *     suppliers in ONE category, which is why the two facts differ by design
 *     and must never be mixed in one "N of M".
 *
 * Home reads the category tally from here (it used to count the event type's
 * whole plan ladder, 25 rows, while Find listed 1). The vendors page's Build
 * N/M counts the same rows through `resolveBenchRing({ listedOnly: true })`;
 * `booked-tally.test.ts` holds the two to the same answer on fixture data.
 * Book's split ("3 booked · 9 waiting for your first payment", owner Q10) is
 * a split of `bookedSupplierCount`, held by the same test.
 *
 * Pure: no reads, no clock. The caller passes the rows it already read.
 */
import { homeTileForRow } from '@/lib/shortlist-taxonomy';
import { bookedSupplierCount, isBookedStatus } from '@/lib/booked-status';

export { bookedSupplierCount, isBookedStatus };

export type BookedTallyRow = {
  vendor_id: string;
  status: string | null;
  category: string;
  category_key?: string | null;
};

export type BookedCategoryTally = {
  /** Categories on the event: the rows Find lists. */
  listed: number;
  /** …of which hold at least one booked supplier. */
  booked: number;
};

/**
 * The categories on the event and how many are booked, at Find's grain.
 * `excludedTiles` = `event_category_decisions` rows with decision `excluded`
 * (a booking outranks an exclusion, exactly as on Find).
 */
export function bookedCategoryTally(
  rows: ReadonlyArray<BookedTallyRow>,
  excludedTiles: Iterable<string> = [],
): BookedCategoryTally {
  const excluded = new Set(excludedTiles);
  const withVendors = new Set<string>();
  const withLocks = new Set<string>();
  for (const r of rows) {
    const tile = homeTileForRow({ category: r.category, category_key: r.category_key ?? null });
    if (!tile) continue;
    if (isBookedStatus(r.status)) withLocks.add(tile);
    else if (!excluded.has(tile)) withVendors.add(tile);
  }
  const listed = new Set<string>([...withVendors, ...withLocks]);
  return { listed: listed.size, booked: withLocks.size };
}
