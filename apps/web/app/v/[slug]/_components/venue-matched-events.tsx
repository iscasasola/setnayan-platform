import { MapPin } from 'lucide-react';
import type { VendorVenueEvent } from '@/lib/vendor-venue-events';
import { formatEventTypeLabel } from '@/lib/reviews';

/**
 * Vendor past-events gallery — SAFE LAYER (owner-locked 2026-07-18). The vendor's
 * professional track record as venue-aware cards: venue · month/year · event
 * type. Events at the VIEWING couple's venue sort first and get a "Your venue"
 * chip; otherwise the most recent show. NO couple names or photos here — that's
 * the consent-gated rich layer. Renders nothing when there's nothing to show.
 */

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short' });
}

export function VenueMatchedEvents({
  events,
  hasMatch,
}: {
  events: VendorVenueEvent[];
  hasMatch: boolean;
}) {
  if (events.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="sn-sec">{hasMatch ? 'Weddings at your venue' : 'Recent weddings'}</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
        {hasMatch
          ? 'This vendor has worked at your venue — see their track record there first.'
          : 'A look at the events this vendor has recently delivered.'}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {events.map((e) => {
          const my = monthYear(e.completedAt ?? e.eventDate);
          return (
            <li key={e.eventId} className="sn-tile flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <MapPin
                    aria-hidden
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--m-orange-2)' }}
                    strokeWidth={1.75}
                  />
                  <span className="truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                    {e.venueName ?? 'Venue not listed'}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  {formatEventTypeLabel(e.eventType)}
                  {my ? ` · ${my}` : ''}
                </span>
              </span>
              {e.atViewerVenue ? (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                >
                  Your venue
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
