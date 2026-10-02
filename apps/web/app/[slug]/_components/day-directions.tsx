import { NavLinksRow } from '@/app/_components/nav-links';
import { venueSearchQuery, VENUE_ROLE_LABEL, type EventVenue } from '@/lib/event-venues';

/**
 * 🗺 DIRECTIONS, ON TOP OF THE DAY'S LIVE TAB UNTIL IT BEGINS (owner 2026-09-30,
 * DECISION_LOG "THE DAY'S MENU HAS FIVE: LIVE · WELCOME · CAMERA · GALLERY ·
 * ME": *"Live: what's on now + up next, live stream/wall; before it starts,
 * Directions on top"*).
 *
 * The day-of hub's own Directions panel (`hub/page.tsx`), brought onto the
 * event page, with "Open in" Maps / Waze. A venue with neither a place to
 * search nor a pin has no way to be opened, so it is not drawn; nothing to
 * draw → nothing at all.
 *
 * 🗺 ONE PLACE (owner 2026-10-01, *"only 1 of 2"*): every caller hands it
 * `dayVenuesNow(...)` — the venue where things are happening now — so it is
 * labelled with that venue's role ("Getting there · Reception"), which tells a
 * guest which of the two places it is without drawing the other.
 *
 * WHEN is the caller's (`directionsLead`, `_lib/hub-tabs.ts`); WHICH venue too:
 * `venues` is the event row's, already withheld by page.tsx for a reader the
 * precise location is not yet open to. Server-only markup: no client code.
 */
export function DayDirections({ venues }: { venues: readonly EventVenue[] }) {
  const open = venues.filter((v) => venueSearchQuery(v) || (v.latitude != null && v.longitude != null));
  if (open.length === 0) return null;
  return (
    <section aria-label="Directions" data-day-directions="" className="space-y-3">
      {open.map((v) => (
        <article key={v.role} data-venue-role={v.role} className="sn-glass-bare space-y-3 rounded-2xl p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            {v.role === 'both' ? 'Getting there' : `Getting there · ${VENUE_ROLE_LABEL[v.role]}`}
          </p>
          <h3 className="font-serif text-2xl italic leading-tight tracking-tight text-ink">{v.name ?? 'Venue'}</h3>
          {v.address ? <p className="text-sm text-ink/65">{v.address}</p> : null}
          <NavLinksRow
            latitude={v.latitude ?? null}
            longitude={v.longitude ?? null}
            addressFallback={venueSearchQuery(v)}
            label="Open in"
          />
        </article>
      ))}
    </section>
  );
}
