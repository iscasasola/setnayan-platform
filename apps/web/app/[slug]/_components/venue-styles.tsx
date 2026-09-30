import { NavLinksRow } from '@/app/_components/nav-links';
import { VENUE_WITHHELD_LINE } from '@/lib/venue-disclosure';
import { VENUE_ROLE_LABEL, venueSearchQuery, type EventVenue } from '@/lib/event-venues';
import { mapFrame } from '@/lib/scene-map-tiles';

/**
 * THE VENUE MAP'S OTHER TWO STYLES — B · One map, two pins and C · Full map
 * (prototype `every_scene_three_styles_2026-09-29.html` §6). A · Map and plate
 * is `VenueWidget` itself.
 *
 * Same venues, same withholding: `event.venues` arrives already passed through
 * `withheldVenue`, which clears the pins of a place kept until the reply — so a
 * withheld venue has no pin to draw here either. And, exactly as the plate
 * does, the directions row goes WITH the address: withheld, there is none
 * (a maps search by the venue's name would be the withheld fact, one tap
 * later), and the withheld line stays, once, under everything.
 *
 * ⛔ No drive time. The prototype drew "12 min between them by car"; nothing
 * we hold measures a drive, and a guessed number a guest would plan around is
 * worse than none (owner rule, "don't guess").
 */

type VenueStyleProps = { venues: readonly EventVenue[]; withheld: boolean };

const hasPin = (v: EventVenue) => v.latitude != null && v.longitude != null;

/** The standard OSM tiles with a numbered pin per located venue. Null when nothing is located. */
function PinnedMap({ venues, tall = false }: { venues: readonly EventVenue[]; tall?: boolean }) {
  const located = venues.map((v, i) => ({ v, n: i + 1 })).filter(({ v }) => hasPin(v));
  const box = tall ? { width: 360, height: 480 } : { width: 360, height: 220 };
  const frame = mapFrame(
    located.map(({ v }) => ({ latitude: v.latitude as number, longitude: v.longitude as number })),
    box,
  );
  if (!frame) return null;
  const label = located.map(({ v }) => v.name ?? VENUE_ROLE_LABEL[v.role]).join(' and ');
  return (
    <figure
      role="img"
      aria-label={`Map showing ${label}`}
      data-venue-map-pins={located.length}
      className="relative w-full overflow-hidden bg-veil"
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      {frame.tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={t.src}
          alt=""
          aria-hidden
          loading="lazy"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: `${t.leftPct}%`, top: `${t.topPct}%`, width: `${t.widthPct}%`, height: `${t.heightPct}%` }}
        />
      ))}
      {located.map(({ v, n }, i) => (
        <span
          key={v.role}
          aria-hidden
          className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-cream bg-ink font-mono text-xs text-cream shadow"
          style={{ left: `${frame.spots[i]!.leftPct}%`, top: `${frame.spots[i]!.topPct}%` }}
        >
          {n}
        </span>
      ))}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 right-0 bg-cream/85 px-1.5 py-0.5 font-sans text-xs text-ink/70"
      >
        © OpenStreetMap
      </a>
    </figure>
  );
}

function VenueRow({ venue, n, withheld }: { venue: EventVenue; n: number; withheld: boolean }) {
  return (
    <li className="flex items-start gap-3 py-3" data-venue-role={venue.role}>
      <span
        aria-hidden
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-cream"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{VENUE_ROLE_LABEL[venue.role]}</p>
        {venue.name ? <p className="font-pahina text-xl font-light leading-snug text-ink">{venue.name}</p> : null}
        {venue.address ? <p className="text-sm leading-relaxed text-ink/65">{venue.address}</p> : null}
        {withheld ? null : (
          <NavLinksRow
            latitude={venue.latitude ?? null}
            longitude={venue.longitude ?? null}
            addressFallback={venueSearchQuery(venue)}
            label="Get directions"
            compact
          />
        )}
      </div>
    </li>
  );
}

/** B · One map, two pins — every venue on one map, numbered; a row each with its own directions. */
export function VenueOneMap({ venues, withheld }: VenueStyleProps) {
  return (
    <section className="space-y-4" data-scene-style="one-map">
      <p className="pahina-eyebrow">
        <span>{venues.length > 1 ? 'The venues' : 'The venue'}</span>
      </p>
      <PinnedMap venues={venues} />
      <ol className="divide-y divide-ink/10 border-y border-ink/10">
        {venues.map((v, i) => (
          <VenueRow key={v.role} venue={v} n={i + 1} withheld={withheld} />
        ))}
      </ol>
      {withheld ? <p className="text-sm leading-relaxed text-ink/65">{VENUE_WITHHELD_LINE}</p> : null}
    </section>
  );
}

/**
 * C · Full map — the map is the scene; the first place's card floats over it,
 * and any other place follows as a row. With nothing located, the plate's own
 * wash stands in for the map, as the plate does.
 */
export function VenueFullMap({ venues, withheld }: VenueStyleProps) {
  const [lead, ...others] = venues;
  if (!lead) return null;
  const map = <PinnedMap venues={venues} tall />;
  return (
    <section className="space-y-4" data-scene-style="full-map">
      <p className="pahina-eyebrow">
        <span>{venues.length > 1 ? 'The venues' : 'The venue'}</span>
      </p>
      <div className="relative">
        {map ?? <div className="aspect-[3/4] w-full bg-gradient-to-br from-veil via-paper-deep to-gild/25" />}
        <div className="absolute inset-x-3 bottom-8 bg-cream/95 p-4 shadow-lg backdrop-blur-sm">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">
            {venues.length > 1 ? '1 · ' : ''}
            {VENUE_ROLE_LABEL[lead.role]}
          </p>
          {lead.name ? (
            <p className="mt-1 font-pahina text-2xl font-light leading-snug text-ink">{lead.name}</p>
          ) : null}
          {lead.address ? <p className="mt-1 text-sm leading-relaxed text-ink/65">{lead.address}</p> : null}
          {withheld ? null : (
            <div className="mt-2">
              <NavLinksRow
                latitude={lead.latitude ?? null}
                longitude={lead.longitude ?? null}
                addressFallback={venueSearchQuery(lead)}
                label="Get directions"
                compact
              />
            </div>
          )}
        </div>
      </div>
      {others.length > 0 ? (
        <ol className="divide-y divide-ink/10 border-y border-ink/10">
          {others.map((v, i) => (
            <VenueRow key={v.role} venue={v} n={i + 2} withheld={withheld} />
          ))}
        </ol>
      ) : null}
      {withheld ? <p className="text-sm leading-relaxed text-ink/65">{VENUE_WITHHELD_LINE}</p> : null}
    </section>
  );
}
