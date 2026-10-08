import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { readOurEvents } from './our-events-read';
import type { OtherEvent } from './pick-from-our-events';

/**
 * WHAT "PICK FROM OUR EVENTS" OFFERS — the events both partners were at (`readOurEvents`: the ONE scope, shared with
 * the pick action's allow-list), each hosted one with a display address per photo (up to twelve) — or NULL when the
 * read was refused, so the screen says it could not look rather than "no other events".
 *
 * One function for the two places that offer: the page that draws the block (outside the new Maker's Studio), and
 * the moment action's `intent=offer`, which answers the Studio's photo slots only when "Pick from our events" is
 * opened. Lifted out of the page unchanged. Signing an address is arithmetic here — no request.
 *
 * Its own file (not `our-events-read.ts`): the signer is server-only, and the read must stay loadable on its own.
 */
export async function readOurEventsOffer(userId: string, eventId: string): Promise<OtherEvent[] | null> {
  const events = await readOurEvents({ userId, eventId });
  if (events === null) return null;
  return Promise.all(
    events.map(async (e) => {
      const photos = (
        await Promise.all(
          e.refs.slice(0, 12).map(async (ref) => {
            const url = await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null);
            return url ? { ref, url } : null;
          }),
        )
      ).filter((x): x is { ref: string; url: string } => x !== null);
      return { eventId: e.eventId, name: e.name, date: e.date, hosted: e.hosted, photos };
    }),
  );
}
