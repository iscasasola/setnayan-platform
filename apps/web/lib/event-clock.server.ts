import 'server-only';

import { eventTimezoneFromCoords } from './event-timezone.server';
import {
  clockRowOf,
  eventClock,
  theDayInstantsOf,
  type EventClock,
  type EventClockInput,
  type EventClockRow,
  type TheDayInstants,
} from './event-clock';

/**
 * THE VENUE'S ZONE — the ONE source (owner ruling 5, 10 Nov 2026): the venue's location (`eventTimezoneFromCoords`,
 * tz-lookup on its coordinates), Manila when there is no venue.
 *
 * ⚠ NOT `events.timezone`. That column defaults to 'Asia/Manila' for every row and was never derived from the venue,
 * so the dashboard (which read it) and the guest page (which read the coordinates) could disagree for a wedding
 * abroad. The coordinates are true for every row, old ones included; the column is no clock's source any more.
 */
export function venueTimezone(event: { venue_latitude?: number | null; venue_longitude?: number | null }): string {
  return eventTimezoneFromCoords(event.venue_latitude ?? null, event.venue_longitude ?? null);
}

/** `eventClock` with the venue's zone resolved here — the server's one call. */
export function eventClockNow(
  event: EventClockRow & { venue_latitude?: number | null; venue_longitude?: number | null },
  opts: Omit<EventClockInput, 'event' | 'tz'> = {},
): EventClock {
  return eventClock({ ...opts, event, tz: venueTimezone(event) });
}

/** `eventClockNow` for a loosely typed row (`clockRowOf`). */
export function eventClockOf(row: unknown, opts: Omit<EventClockInput, 'event' | 'tz'> = {}): EventClock {
  return eventClockNow(clockRowOf(row), opts);
}

/** The Day's two instants for a client component (`useEventPulse`, `useDayOfLiveTick`, the seat plan's banner). */
export function theDayFor(row: unknown): TheDayInstants | null {
  return theDayInstantsOf(eventClockOf(row));
}
