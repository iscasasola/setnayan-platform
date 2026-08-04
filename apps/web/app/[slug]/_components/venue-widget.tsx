import { NavLinksRow } from '@/app/_components/nav-links';
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
  return (
    <section className="space-y-4">
      <p className="pahina-eyebrow">
        <span>The venue</span>
      </p>
      <div>
        <div className="h-32 border border-b-0 border-ink/10 bg-gradient-to-br from-veil via-paper-deep to-gild/25" />
        <div className="pahina-plate space-y-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
            Ceremony &amp; Reception
          </p>
          <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
            {event.venue_name ?? 'Venue to be confirmed'}
          </h3>
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
