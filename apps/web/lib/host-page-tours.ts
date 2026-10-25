/**
 * host-page-tours.ts — the host's first-visit page tours and the order they run in.
 *
 * Owner "yes to all", 2026-10-22 (prototype `journey_fixes_later_2026-10-22.html` § Host 4): a spotlight on the
 * first visit to the Maker (3 stops), Budget (3), Papic (4), the Seat plan (3) and the Mood Board (3), each AFTER
 * the journey (`host_spotlight_v1`) so two never stack, and none lighting an anchor the journey already lit. The
 * words are in `lib/tours.ts`; each page mounts its own through the shipped `<Spotlight>`.
 *
 * INSIDE THE MAKER. The Maker is a full-screen editor and the journey waits under it (`spotlight-tour.tsx`). The
 * Maker's own tour, and a page tour drawn inside the Maker (the Mood Board in Look, the Seat plan in Details), are
 * mounted with `inMaker` — the engine does not pause for them — and the inner two wait for the Maker's own tour, so
 * inside the Maker, too, one tour runs at a time.
 *
 * Strings only, no import of the words — a client file (the Maker shell) may take a key from here.
 */
import type { TourKey } from './tours';

export const HOST_PAGE_TOURS = {
  maker: 'customer_event_hub_maker_v2',
  budget: 'customer_budget_v2',
  papic: 'customer_papic_v2',
  seatPlan: 'customer_seat_plan_v2',
  moodBoard: 'customer_mood_board_v1',
  memories: 'customer_memories_v1',
  home: 'customer_home_widgets_v1',
} as const satisfies Record<string, TourKey>;

/** The journey goes first; a page tour waits until it is seen. */
export const HOST_PAGE_TOURS_AFTER = 'host_spotlight_v1' as const satisfies TourKey;

/** Inside the Maker, a page's tour waits for the Maker's own. */
export const MAKER_INNER_TOURS_AFTER = HOST_PAGE_TOURS.maker;
