/**
 * apps/web/lib/venue-disclosure.ts
 *
 * WHERE THE WEDDING IS, IS FOR PEOPLE WHO HAVE ANSWERED.
 *
 * Owner ruling 2026-09-20: the street address, the map and the directions open
 * once a guest has replied — not before. Asked for as part of the Event Hub
 * arrival work, where the research showed this turns the one control on the
 * page into a key rather than a chore, and keeps a venue off a link that gets
 * forwarded around.
 *
 * WHAT IS WITHHELD, AND WHAT IS NOT. The venue NAME stays visible: an
 * invitation that cannot say where it is reads as broken, and the name is what
 * a guest recognises. What closes is the precise location — `venue_address`
 * and the coordinates, which between them drive the map embed and every
 * directions link. `VenueWidget` already hides its map and its deep links when
 * both are absent, so withholding here closes every one of those surfaces
 * without a second rule written anywhere else.
 *
 * 🔒 FAILS CLOSED, BY CONSTRUCTION. `app/[slug]/page.tsx` builds ONE props
 * object shared by every render branch, and that object now carries the
 * WITHHELD event. A branch that says nothing about the venue therefore shows
 * nothing; only the guest branch, which knows the reply, opens it. A future
 * branch added without reading this file inherits the closed state, which is
 * the safe direction.
 *
 * ⚠ AND IT OPENS ON THE DAY REGARDLESS. A guest who never replied and is in a
 * car on 18 December must not meet a locked address. `venueIsOpen` therefore
 * also opens from the event day onward, so this can never strand somebody en
 * route. That is deliberate and not a hole: by then the wedding is happening,
 * and the cost of being wrong is somebody missing it.
 *
 * Pure: no I/O, the clock is passed in, so every rule below is executed by a
 * test rather than described by a comment.
 */

import type { RsvpStatus } from '@/lib/guests';

/** A reply is any answer the guest actually gave. 'pending' is not an answer. */
export function hasReplied(status: RsvpStatus | null | undefined): boolean {
  return status === 'attending' || status === 'declined' || status === 'maybe';
}

/**
 * Is the event day here, IN THE VENUE'S OWN TIMEZONE?
 *
 * 🔴 THE WALL-CLOCK-VS-INSTANT CLASS, CAUGHT BY CI ON 2026-09-20. The first
 * version read the SERVER's calendar (`now.getFullYear()` and friends). Vercel
 * runs in UTC, so 7am in Manila on the wedding day is still 17 December there —
 * and the rule that exists so nobody is locked out while travelling would have
 * opened the address EIGHT HOURS LATE, during the ceremony. The same class as
 * the supplier Today page that read a day behind (DECISION_LOG 2026-09-10).
 *
 * The zone is the caller's to supply, from the venue's coordinates
 * (`eventTimezoneFromCoords`), because only the caller has them. It defaults to
 * Manila rather than to the server: this product's weddings are in the
 * Philippines, and a wrong-but-local default beats a wrong-and-invisible one.
 */
export const DEFAULT_VENUE_TZ = 'Asia/Manila';

export function eventDayHasArrived(
  eventDate: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TZ,
): boolean {
  if (!eventDate) return false;
  const day = String(eventDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  let today: string;
  try {
    // `en-CA` renders YYYY-MM-DD, which compares as a string.
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_VENUE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
  return today >= day;
}

export type VenueViewer = {
  /** A signed-in host, coordinator or moderator of this event. */
  isHost?: boolean;
  /** The viewer's own RSVP, when the viewer is a guest of this event. */
  rsvpStatus?: RsvpStatus | null;
  /** The event's calendar date, `YYYY-MM-DD`. */
  eventDate?: string | null;
  /** The VENUE's timezone — see `eventDayHasArrived`. Defaults to Manila. */
  timeZone?: string;
  now?: Date;
};

/** The whole rule, in one place. */
export function venueIsOpen(viewer: VenueViewer): boolean {
  if (viewer.isHost) return true;
  if (hasReplied(viewer.rsvpStatus)) return true;
  return eventDayHasArrived(viewer.eventDate, viewer.now ?? new Date(), viewer.timeZone);
}

/** The fields that carry the precise location. */
export type VenueFields = {
  venue_address?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  venue_withheld?: boolean;
};

/**
 * Return the event with its precise location closed, and a flag saying so —
 * the flag is what lets a surface say "it opens when you reply" instead of
 * rendering an unexplained gap, which is this repo's whole objection to
 * absence that renders like emptiness.
 *
 * Never mutates: the caller may still hold the open row for a host surface.
 */
export function withheldVenue<T extends VenueFields>(event: T): T {
  return {
    ...event,
    venue_address: null,
    venue_latitude: null,
    venue_longitude: null,
    venue_withheld: true,
  };
}

/** What a viewer who has not replied is told where the map would be. */
export const VENUE_WITHHELD_LINE = 'The address and directions open as soon as you reply.';
