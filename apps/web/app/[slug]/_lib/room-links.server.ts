import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { isRecapPublished } from '@/lib/auto-recap';
import { getDayOfPhase } from '@/lib/day-of-mode';

import { loadDoorwayFacts } from './loaders';
import { resolveRoomLinks, type RoomKey, type RoomLink } from './room-links';

/**
 * GATHER THE FACTS EVERY ROOM NEEDS, ONCE.
 *
 * Six rooms each need the same handful of answers — is there seating, are there
 * gifts, is the album out, is the event happening. Asking each room to fetch
 * them itself would mean six copies of the same reads and six chances for one
 * of them to drift into asking a slightly different question. That drift is
 * exactly how the money-gift door and the money-gift PAGE ended up applying two
 * different visibility rules.
 *
 * `loadDoorwayFacts` already answers the seating and gift halves and is
 * `React.cache`d, so this adds only the album and the live-hub windows.
 *
 * ⚠ `pabuyaViewerAllowed` is NOT resolved here and must be passed in. It needs
 * the guest-session cookie, and cookie reads may never enter a cached loader —
 * the hard rule at the top of `loaders.ts`, and the reason `resolveGuestDoorways`
 * takes it as a parameter too.
 */
export async function loadRoomLinks(input: {
  event: {
    event_id: string;
    slug: string | null;
    event_type?: string | null;
    event_date?: string | null;
  };
  current: RoomKey | null;
  guestToken?: string | null;
  /** The money-gift page's OWN visibility answer, resolved by the caller. */
  pabuyaViewerAllowed: boolean;
}): Promise<RoomLink[]> {
  const admin = createAdminClient();
  const { event } = input;

  const [facts, recapPublished] = await Promise.all([
    loadDoorwayFacts(admin, event.event_id, event.event_type ?? null),
    // A failed read here must not invent an album that is not there: a link to
    // a 404 is worse than no link, and a guest turned away once stops tapping.
    isRecapPublished(event.event_id).catch(() => false),
  ]);

  // The live hub's entry exists only while the event is running or has just
  // finished — owner-settled vocabulary, restated rather than re-decided.
  //
  // ⚠ An event with NO DATE is not "happening now" — it is unscheduled. Passing
  // a null date to the phase helper would be asking it a question it cannot
  // answer, and its own contract returns 'inactive' for anything unparseable;
  // saying so here is cheaper than relying on that.
  const liveHubOpen = event.event_date
    ? ['live', 'post'].includes(getDayOfPhase(event.event_date))
    : false;

  return resolveRoomLinks({
    slug: event.slug,
    current: input.current,
    guestToken: input.guestToken ?? null,
    seatingSurfaceEnabled: facts.seatingSurfaceEnabled,
    seatingPublished: facts.seatingPublished,
    pabuyaRouteEnabled: facts.pabuyaRouteEnabled,
    enabledEgiftCount: facts.enabledEgiftCount,
    pabuyaViewerAllowed: input.pabuyaViewerAllowed,
    recapPublished,
    liveHubOpen,
  });
}
