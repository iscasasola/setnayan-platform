import { NavLinksRow } from '@/app/_components/nav-links';
import { VendorLocationMap } from '@/app/_components/vendor-location-map';
import type { EventRow } from '../_lib/types';
import { VENUE_WITHHELD_LINE } from '@/lib/venue-disclosure';
import { VENUE_ROLE_LABEL, venueSearchQuery, type EventVenue } from '@/lib/event-venues';

// ---------------------------------------------------------------------------
// Additional widgets (closing 0002 deferrals)
// ---------------------------------------------------------------------------

export function VenueWidget({ event }: { event: EventRow }) {
  // 2026-05-21 — coords-based deep links (Google Maps · Waze · Apple Maps)
  // when the event has a geocoded venue. Falls back to a text-search
  // Google Maps link when only venue_address is set. Hidden entirely if
  // both are missing.
  // Pahina (design 2026-07-25 §7): the venue reads as a recessed paper-deep
  // PLATE with a printed inner hairline frame, not another cream card. The old
  // decorative band mixed warn-/success- app tones into a wedding page — it is
  // now a palette-derived veil→gild wash (functional-color exile, §4).
  // Eyebrow carries no chapter numeral (owner 2026-09-25 "drop the numbers" —
  // no section renders one anymore) and `PublicEventDetails` can also appear
  // on the same page, so this label stays distinct on its title alone.
  //
  // 🗺 2026-08-24 (H-4 / AP-10) — A SECTION CALLED `venue_map` HAD NEVER SHOWN A
  // MAP. Where the streets belong, guests got a decorative gradient band and a
  // line of text: the couple could pin their venue exactly, and a relative
  // working out how to get there still saw no map anywhere on the invitation.
  // The band is now the FALLBACK, kept verbatim for events with no coordinates,
  // and a real map takes its place the moment there are any.
  //
  // 🔑 RULE 0 — NOTHING IS DRAWN HERE. `VendorLocationMap` already ships and has
  // been on public shop pages since 2026-06-28: the OFFICIAL OpenStreetMap embed,
  // no API key, no paid dependency, free egress. It self-guards on missing
  // coordinates, so the `hasCoords` test below is about which BACKDROP to paint,
  // not about protecting the map from bad input.
  //
  // ⛔ AND THE CSP IS NOT TOUCHED BY THIS. `https://www.openstreetmap.org` has
  // been in the ENFORCED `frame-src` since 2026-08-08 (next.config.ts), where it
  // was added after this exact embed spent its whole life as an empty grey panel
  // on every shop page with coordinates — a blocked iframe fails EXACTLY like a
  // missing one. `lib/csp-embeds-are-allowed.test.ts` pins the host, and now
  // names this surface too.
  //
  // 🏛💒 TWO VENUES (2026-09-27 · lib/event-venues.ts). A wedding has a ceremony
  // and a reception (DECISION_LOG 2026-09-03), and this scene read ONE venue off
  // the `events` row — so `cale-ice`, with a church and a hotel both booked,
  // drew "Add your venue." Each venue now gets its own plate, labelled
  // "Ceremony" / "Reception" (or "Ceremony & Reception" when they are one
  // place), each with its own map and directions. `event.venues` is attached by
  // page.tsx and withheld by `withheldVenue` like the event's own columns; a
  // caller that never loaded it falls back to the one venue on the event row.
  const venues: EventVenue[] = event.venues?.length ? event.venues : legacyVenues(event);

  return (
    <section className="space-y-4">
      <p className="pahina-eyebrow">
        <span>{venues.length > 1 ? 'The venues' : 'The venue'}</span>
      </p>
      {venues.map((venue) => (
        <VenuePlate key={venue.role} venue={venue} event={event} />
      ))}
      {/* 🔒 CLOSED UNTIL THEY REPLY (owner 2026-09-20 · lib/venue-disclosure.ts).
          The line is not decoration: an address that simply vanishes reads as a
          couple who has not booked a venue. It says which it is — once, under
          every venue, since one reply opens them all. */}
      {event.venue_withheld ? (
        <p className="text-sm leading-relaxed text-ink/65">{VENUE_WITHHELD_LINE}</p>
      ) : null}
    </section>
  );
}

/** The one venue a caller that never loaded `event.venues` still knows about. */
function legacyVenues(event: EventRow): EventVenue[] {
  return [
    {
      role: 'both',
      name: event.venue_name ?? null,
      address: event.venue_address ?? null,
      latitude: event.venue_latitude ?? null,
      longitude: event.venue_longitude ?? null,
    },
  ];
}

function VenuePlate({ venue, event }: { venue: EventVenue; event: EventRow }) {
  const hasCoords = venue.latitude != null && venue.longitude != null;
  return (
    <div data-venue-role={venue.role}>
      {hasCoords ? (
        <VendorLocationMap
          latitude={venue.latitude ?? null}
          longitude={venue.longitude ?? null}
          // A non-identifying label. On a PRIVATE event the venue name is not
          // secret from someone already reading the invitation — this plate
          // renders the name in the heading two lines below — so passing it is
          // no wider a disclosure than the block it sits in. With no name we
          // say "the venue" rather than the component's vendor-shaped default.
          label={venue.name ?? 'the venue'}
          flush
        />
      ) : (
        <div className="h-32 border border-b-0 border-ink/10 bg-gradient-to-br from-veil via-paper-deep to-gild/25" />
      )}
      <div className="pahina-plate space-y-3">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
          {VENUE_ROLE_LABEL[venue.role]}
        </p>
        {/* "Venue to be confirmed" is only honest when nothing locates the
            venue. With a pin on the map it contradicts the map directly above
            it, so the heading steps aside and the map answers the question.
            🔒 And a WITHHELD venue is not an unconfirmed one (owner 2026-09-26,
            cale-ice: pin set, guest not yet replied → the page said "Venue to be
            confirmed"). `withheldVenue` clears the pin, so without this the
            heading would claim the couple has no venue; the withheld line under
            the plates says the true thing — it opens when they reply. */}
        {venue.name ? (
          <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
            {venue.name}
          </h3>
        ) : hasCoords || event.venue_withheld ? null : (
          <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
            Venue to be confirmed
          </h3>
        )}
        {venue.address ? (
          <p className="text-sm leading-relaxed text-ink/65">{venue.address}</p>
        ) : null}
        {/* ⚠ THE DIRECTIONS ROW GOES WITH THE ADDRESS. `NavLinksRow` falls back
            to a maps search when there is no pin, so leaving it mounted for a
            withheld venue would hand out a search for the venue by name — the
            withheld fact, one tap later. */}
        {event.venue_withheld ? null : (
          <NavLinksRow
            latitude={venue.latitude ?? null}
            longitude={venue.longitude ?? null}
            addressFallback={venueSearchQuery(venue)}
            label="Get directions"
            compact
          />
        )}
      </div>
    </div>
  );
}
