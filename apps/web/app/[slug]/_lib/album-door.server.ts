import 'server-only';

import { isRecapPublished } from '@/lib/auto-recap';

import { albumRoomLink, type RoomLink } from './room-links';

/**
 * THE ALBUM DOOR'S FACT AND ITS RULE, IN ONE PLACE.
 *
 * Three surfaces offer a way into the couple's recap album — the rooms footer
 * (`room-links.server.ts`), the live hub's photos panel (`hub/page.tsx`) and
 * the public event-day bar on the invitation page (`loaders.ts`'
 * `publicAlbumHref`). Before 2026-08-27 only the first asked whether the album
 * exists; the other two asked `dayOfPhase === 'post'`, which is a question
 * about the calendar, not about the album. See `albumRoomLink`'s docblock for
 * what that cost in both directions.
 *
 * ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
 * The obvious home was `room-links.server.ts`, and it cannot be: that file
 * imports `./loaders`, and `loaders.ts` is one of the three callers. Putting
 * the decision there would make `loaders.ts → room-links.server.ts →
 * loaders.ts` a cycle. This module imports only the pure rule and the recap
 * read, so every caller can reach it and none of them reach each other.
 */

/**
 * Is the couple's recap album actually published?
 *
 * 🔒 FAILS CLOSED, and that direction is the point. A failed read must not
 * invent an album that is not there: a link to a dead end is worse than no
 * link, and a guest turned away once stops tapping. This is the same failure
 * direction `loadRoomLinks` has always applied, lifted out of it verbatim so
 * the other two surfaces inherit it rather than re-deciding it.
 *
 * The read underneath (`getRecapStatus`) is `React.cache`d, so all three
 * surfaces plus `/[slug]/recap`'s own two checks collapse to ONE query per
 * request.
 */
export async function albumDoorPublished(eventId: string): Promise<boolean> {
  return isRecapPublished(eventId).catch(() => false);
}

/**
 * THE ONE CALL a surface makes to ask whether to offer the album door.
 *
 * Returns the door (take `.href`, and name it in your own voice) or `null`
 * when it must not be offered. Never branch on the day-of phase to answer this
 * question — the phase is not a fact about the album.
 */
export async function resolveAlbumDoor(event: {
  event_id: string;
  slug: string | null;
}): Promise<RoomLink | null> {
  return albumRoomLink(event.slug, await albumDoorPublished(event.event_id));
}
