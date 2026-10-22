import { appleMapsUrl, googleMapsNavUrl, googleMapsSearchByQuery, wazeNavUrl } from '@/lib/geo';
import { venueSearchQuery, type EventVenue } from '@/lib/event-venues';

/** A place to send a guest: a pin when there is one, and the words to search for when there is not. */
type Place = {
  /** Latitude in decimal degrees. NULL = fall back to `query`. */
  latitude: number | null | undefined;
  /** Longitude in decimal degrees. NULL = fall back to `query`. */
  longitude: number | null | undefined;
  /** Free-text search (a name, an address, a city) for a place with no pin. NULL with no pin → nothing is drawn. */
  query: string | null | undefined;
};

/**
 * DIRECTIONS ▾ — THE ONE WAY ANY SURFACE OFFERS THE MAP APPS (owner, standing: *"any set of choices is a
 * dropdown"*). Google Maps · Waze · Apple Maps are ONE dropdown, never three buttons side by side.
 *
 * It began as the venue journey card's own note (`venue-styles.tsx`); #6751 (2026-10-21) put it on every venue
 * card, and on 2026-10-22 it moved here, where the three-chip `NavLinksRow` used to live, so The Day's directions
 * card (`day-directions.tsx`), the Live hub's Directions panel (`hub/page.tsx`) and a supplier's public profile
 * (`v/[slug]/page.tsx`) mount the SAME component as the venue cards. `NavLinksRow` is gone — there is no second
 * way to draw the map apps. Held by `app/[slug]/every-hub-press-is-44px.test.ts`.
 *
 * A native `<details>`: no JavaScript on the guest page. The summary and every row are 44 px presses. With no pin,
 * the one honest link is a Google Maps search for the place; with neither, nothing at all.
 */
export function DirectionsMenu(props: { venue: EventVenue } | Place) {
  const place: Place =
    'venue' in props
      ? { latitude: props.venue.latitude, longitude: props.venue.longitude, query: venueSearchQuery(props.venue) }
      : props;
  const { latitude: lat, longitude: lng } = place;
  const query = place.query?.trim();
  const apps =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? [
          { name: 'Google Maps', href: googleMapsNavUrl(lat, lng) },
          { name: 'Waze', href: wazeNavUrl(lat, lng) },
          { name: 'Apple Maps', href: appleMapsUrl(lat, lng) },
        ]
      : query
        ? [{ name: 'Google Maps', href: googleMapsSearchByQuery(query) }]
        : [];
  if (apps.length === 0) return null;
  return (
    <details className="group mt-2" data-venue-directions="">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-ink/20 bg-cream px-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Directions
        <span aria-hidden className="text-xs text-ink/80 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-1 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/15 bg-cream">
        {apps.map((a) => (
          <li key={a.name}>
            <a href={a.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center px-3 text-sm font-medium text-ink">
              {a.name}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
