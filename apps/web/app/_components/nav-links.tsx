import { appleMapsUrl, geoUri, googleMapsNavUrl, googleMapsSearchByQuery, googleMapsSearchUrl, wazeNavUrl } from '@/lib/geo';
import { venueSearchQuery, type EventVenue } from '@/lib/event-venues';
import type { DirectionLinks } from '@/lib/map-directions';
import { GetDirections, type DirectionsLook } from './get-directions';

/** A place to send someone: a pin when there is one, and the words to search for when there is not. */
type Place = {
  /** Latitude in decimal degrees. NULL = fall back to `query`. */
  latitude: number | null | undefined;
  /** Longitude in decimal degrees. NULL = fall back to `query`. */
  longitude: number | null | undefined;
  /** Free-text search (a name, an address, a city) for a place with no pin. NULL with no pin → nothing is drawn. */
  query: string | null | undefined;
  /** The sheet's title — the place's name. Absent → the address (`query`) titles it. Never a hidden supplier's name. */
  name?: string | null;
  /** The line under the title and what "Copy address" copies. Absent → `query`. */
  address?: string | null;
};

/**
 * 🧭 GET DIRECTIONS — THE ONE WAY ANY SURFACE OFFERS THE MAP APPS.
 *
 * History: three chips (`NavLinksRow`) → ONE "Directions ▾" dropdown (owner, standing: *"any set of choices is a
 * dropdown"*; #6751, 2026-10-21/22) → since 2026-11-14 ONE "Get directions" button whose SHEET, named after the place,
 * lists the map apps this device most likely has, then Copy address · Copy map link · Share… (map card + Get
 * directions, owner "Yes, approved", `prototypes/map_card_open_in_maps_2026-11-14_fable.html`). Choices still live in
 * one place, never side by side.
 *
 * Every surface mounts THIS component — the venue cards (`venue-widget.tsx`, `venue-styles.tsx`), The Day's directions
 * card (`day-directions.tsx`), the Live hub's Directions panel (`hub/page.tsx`) and a supplier's public page
 * (`v/[slug]/page.tsx`) — so they all changed together. Held by `app/[slug]/every-hub-press-is-44px.test.ts`.
 *
 * 🔑 THE LINKS ARE BUILT HERE, ON THE SERVER, AND NOWHERE ELSE: Android's chooser (`geo:`), Google Maps, Waze, Apple
 * Maps and the copyable Google Maps link. The client sheet (`get-directions.tsx`) only orders them per device
 * (`lib/map-directions.ts`). With no pin, the one honest link is a Google Maps search for the place; with neither,
 * nothing at all. ⚠ A withheld venue must not mount this (it would search for the venue by name — the withheld fact,
 * one tap later); its callers leave it out.
 */
export function DirectionsMenu(props: ({ venue: EventVenue } | Place) & { look?: DirectionsLook }) {
  const place: Place =
    'venue' in props
      ? {
          latitude: props.venue.latitude,
          longitude: props.venue.longitude,
          query: venueSearchQuery(props.venue),
          name: props.venue.name,
          address: props.venue.address,
        }
      : props;
  // The couple's pages pass a venue and keep the couple's look; a supplier page passes a place and wears the template.
  const look: DirectionsLook = props.look ?? ('venue' in props ? 'couple' : 'template');
  const { latitude: lat, longitude: lng } = place;
  const query = place.query?.trim() || null;
  const pinned = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const name = place.name?.trim() || null;
  // A venue's address is its own column; a supplier's place has only `query` (its address, or its city).
  const addressText = place.address?.trim() || ('venue' in props ? null : query);
  const title = name ?? addressText ?? query ?? 'This place';
  if (!pinned && !query) return null;

  const links: DirectionLinks = pinned
    ? {
        pinned: true,
        geo: geoUri(lat, lng, name),
        google: googleMapsNavUrl(lat, lng),
        waze: wazeNavUrl(lat, lng),
        apple: appleMapsUrl(lat, lng, name),
        mapLink: googleMapsSearchUrl(lat, lng),
      }
    : { pinned: false, search: googleMapsSearchByQuery(query!), mapLink: googleMapsSearchByQuery(query!) };

  return (
    <div data-venue-directions="">
      {/* 📍 THE PLACE UNDER THE MAP (map card approved 2026-11-14, supplier page): the address the sheet searches, said
          once above its button. A venue card prints its own name and address already, so only the template look draws
          it. The supplier's NAME is not handed in here (the page passes a place, never the name — the name-reveal rule). */}
      {look === 'template' && addressText ? (
        <p data-place-address="" className="pt-3 text-[14px] leading-snug text-ink/70">
          {addressText}
        </p>
      ) : null}
      <GetDirections
        title={title}
        address={addressText && addressText !== title ? addressText : null}
        copyText={addressText ?? (pinned ? null : query)}
        links={links}
        look={look}
      />
    </div>
  );
}
