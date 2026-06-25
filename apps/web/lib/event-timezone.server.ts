import 'server-only';

import tzLookup from 'tz-lookup';

import { DEFAULT_EVENT_TZ } from './schedule';

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
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return DEFAULT_EVENT_TZ;
  try {
    return tzLookup(lat, lng);
  } catch {
    return DEFAULT_EVENT_TZ;
  }
}
