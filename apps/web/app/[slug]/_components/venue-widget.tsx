import { NavLinksRow } from '@/app/_components/nav-links';
import { VendorLocationMap } from '@/app/_components/vendor-location-map';
import type { EventRow } from '../_lib/types';

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
  // Eyebrow is intentionally unnumbered: `PublicEventDetails` owns № 03 and both
  // can appear on one page.
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
  const hasCoords = event.venue_latitude != null && event.venue_longitude != null;

  return (
    <section className="space-y-4">
      <p className="pahina-eyebrow">
        <span>The venue</span>
      </p>
      <div>
        {hasCoords ? (
          <VendorLocationMap
            latitude={event.venue_latitude ?? null}
            longitude={event.venue_longitude ?? null}
            // A non-identifying label. On a PRIVATE event the venue name is not
            // secret from someone already reading the invitation — this widget
            // renders the name in the heading two lines below — so passing it is
            // no wider a disclosure than the block it sits in. With no name we
            // say "the venue" rather than the component's vendor-shaped default.
            label={event.venue_name ?? 'the venue'}
            flush
          />
        ) : (
          <div className="h-32 border border-b-0 border-ink/10 bg-gradient-to-br from-veil via-paper-deep to-gild/25" />
        )}
        <div className="pahina-plate space-y-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
            Ceremony &amp; Reception
          </p>
          {/* "Venue to be confirmed" is only honest when nothing locates the
              venue. With a pin on the map it contradicts the map directly above
              it, so the heading steps aside and the map answers the question. */}
          {event.venue_name ? (
            <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
              {event.venue_name}
            </h3>
          ) : hasCoords ? null : (
            <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
              Venue to be confirmed
            </h3>
          )}
          {event.venue_address ? (
            <p className="text-sm leading-relaxed text-ink/65">{event.venue_address}</p>
          ) : null}
          <NavLinksRow
            latitude={event.venue_latitude ?? null}
            longitude={event.venue_longitude ?? null}
            addressFallback={event.venue_address ?? event.venue_name ?? null}
            label="Get directions"
            compact
          />
        </div>
      </div>
    </section>
  );
}
