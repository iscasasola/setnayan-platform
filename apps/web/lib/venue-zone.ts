import tzLookup from 'tz-lookup';

import { VENUE_TZ_FALLBACK } from './day-of-mode';

/**
 * The venue's IANA zone from its coordinates — the body of `eventTimezoneFromCoords` (lib/event-timezone.server.ts),
 * which re-exports it behind `server-only` for every page and component.
 *
 * Its own module ONLY so the middleware's half of the cached Event Hub (`lib/hub-view-route.ts`) can put the event's
 * stage into the cache key on the SAME zone the page draws it in (owner ruling 5, 10 Nov 2026: one source of the
 * venue's zone). ⚠ Do not import this from a client component — `tz-lookup` ships a boundary dataset the browser
 * does not need; servers import `eventTimezoneFromCoords`.
 */
export function venueZoneFromCoords(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return VENUE_TZ_FALLBACK;
  try {
    return tzLookup(lat, lng);
  } catch {
    return VENUE_TZ_FALLBACK;
  }
}
