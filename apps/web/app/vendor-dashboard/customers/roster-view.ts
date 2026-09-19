/**
 * roster-view.ts — what the Customers roster SHOWS, decided in one pure step.
 *
 * Owner 2026-09-19: "if they have 50 customers/100 customers, can we do it in
 * pages? so if they have 1000 inquiries, they can still manage all and still be
 * able to see the lower parts of the page?"
 *
 * 🔑 SPLIT OUT OF `page.tsx` SO IT CAN BE EXECUTED. The page is a server
 * component behind a Supabase session; nothing in a unit test can run it. The
 * two promises that matter here — the chips count EVERYONE, and only ONE page
 * of rows reaches the render — are made in this function, and
 * `the-roster-pages.test.ts` runs it against a thousand customers.
 *
 * The order of operations is the whole design:
 *   1. COUNT every lane from the full `lanes` — before any narrowing. A shop on
 *      page 3, inside a search, under the Booked chip, is still told how many
 *      people are waiting on it in total.
 *   2. NARROW by the lane chip, keeping the lane order — waiting first, so
 *      page 1 still "opens on who is waiting".
 *   3. SEARCH by name, before paging — a match on page 40 of the full list is
 *      on page 1 of its search.
 *   4. PAGE with the shared `paginate()` — an out-of-range page clamps to the
 *      last page.
 *   5. DECORATE only the rows on the page (the money note), so a thousand
 *      customers cost twenty notes.
 */
import {
  CUSTOMER_LANES,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { filterBySearch, paginate, parseSearchParam, type Paged } from '@/lib/paginate';

export type RosterView<R> = {
  laneCounts: Record<CustomerLane, number>;
  activeLane: CustomerLane | null;
  /** The one page that renders. `paged.total` is the narrowed, searched list. */
  paged: Paged<R>;
};

export function rosterView<R>(
  lanes: Record<CustomerLane, PipelineCustomer[]>,
  opts: {
    lane: string | undefined;
    q: string | undefined;
    page: string | string[] | undefined;
    decorate: (r: PipelineCustomer) => R;
  },
): RosterView<R> {
  const laneCounts = Object.fromEntries(
    CUSTOMER_LANES.map((l) => [l, lanes[l].length]),
  ) as Record<CustomerLane, number>;

  const activeLane = (CUSTOMER_LANES as readonly string[]).includes(opts.lane ?? '')
    ? (opts.lane as CustomerLane)
    : null;

  // Waiting first, always. The chip narrows the same list; it never reorders it.
  const ordered = activeLane ? lanes[activeLane] : CUSTOMER_LANES.flatMap((l) => lanes[l]);

  const matched = filterBySearch(ordered, parseSearchParam(opts.q), (r) => r.title);
  const page = paginate(matched, opts.page);

  return {
    laneCounts,
    activeLane,
    paged: { ...page, items: page.items.map(opts.decorate) },
  };
}
