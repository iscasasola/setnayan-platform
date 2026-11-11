import 'server-only';

import { venueZoneFromCoords } from './venue-zone';

/**
 * Event timezone derived from its venue coordinates (option B, owner 2026-06-25).
 * SERVER-ONLY — `tz-lookup` ships a timezone-boundary dataset we don't want in
 * the client bundle. Server components derive the IANA string here and pass it
 * down to client components, which do the (Intl-only, dep-free) viewer-local
 * conversion via `formatViewerTime` in lib/schedule.ts.
 *
 * Mirrors ~/Setnayan-Native/src/lib/timezone.ts. Falls back to Philippine time
 * when the event has no coordinates (most weddings are in PH).
 */
export function eventTimezoneFromCoords(lat: number | null, lng: number | null): string {
  // The body lives in `lib/venue-zone.ts` so the middleware can ask it too (the Event Hub's cache key); one zone rule.
  return venueZoneFromCoords(lat, lng);
}
