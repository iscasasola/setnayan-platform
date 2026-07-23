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
  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Venue</p>
      <div className="overflow-hidden rounded-lg border border-ink/10">
        <div className="h-32 bg-gradient-to-br from-terracotta/30 via-warn-100 to-success-100" />
        <div className="space-y-3 bg-cream p-4">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
            Ceremony &amp; Reception
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            {event.venue_name ?? 'Venue to be confirmed'}
          </h3>
          {event.venue_address ? (
            <p className="text-sm text-ink/65">{event.venue_address}</p>
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
