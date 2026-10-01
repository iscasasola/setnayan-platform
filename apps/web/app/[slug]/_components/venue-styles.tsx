import type { CSSProperties } from 'react';
import { NavLinksRow } from '@/app/_components/nav-links';
import { VENUE_WITHHELD_LINE } from '@/lib/venue-disclosure';
import { VENUE_ROLE_LABEL, venueSearchQuery, type EventVenue, type VenueRole } from '@/lib/event-venues';
import { appleMapsUrl, googleMapsNavUrl, googleMapsSearchByQuery, wazeNavUrl } from '@/lib/geo';
import { ceremonyBlock, firstBlockOf, type ScheduleBlockRow } from '@/lib/print-pieces';
import { formatBlockTimeRange } from '@/lib/schedule';
import { mapFrame } from '@/lib/scene-map-tiles';

/**
 * 🏛 THE VENUE SCENE'S OTHER TWO STYLES — Full photo · The journey (owner
 * 2026-09-30, DECISION_LOG "VENUE STYLES APPROVED", on
 * `prototypes/venue_styles_2026-09-30_fable.html`). Photo card — the default —
 * is `VenueWidget` itself; the one map all three share is `PinnedMap` below.
 *
 * Same venues, same withholding: `event.venues` arrives already passed through
 * `withheldVenue`, which clears the address and pin of a place kept until the
 * reply — so a withheld venue has no pin to draw and no address to print. And,
 * exactly as the card does, the directions go WITH the address: withheld, there
 * are none (a maps search by the venue's name would be the withheld fact, one
 * tap later), and the withheld line stays, once, under everything.
 *
 * 🔆 Words a guest reads sit on the plate (`pahina-plate` + the plate's chip
 * ground), the surface `lib/the-venue-cards-are-readable.test.ts` measures on
 * every theme — or, on Full photo, on a FIXED dark gradient (white on 90 % ink
 * at the baseline), which reads whatever the photo is.
 *
 * ⛔ No drive time. The prototype drew "about 20 min drive"; nothing we hold
 * measures a drive, and a guessed number a guest would plan around is worse
 * than none (owner rule, "don't guess"). The route line joins the stops in the
 * order of the day — it is not a road.
 */

const hasPin = (v: EventVenue) => v.latitude != null && v.longitude != null;

/** How many venues the one map would pin. */
export function locatedVenueCount(venues: readonly EventVenue[]): number {
  return venues.filter(hasPin).length;
}

/**
 * 🕒 EACH STOP'S TIME — from the run of show, never guessed: the ceremony is the
 * schedule's ceremony block (`ceremonyBlock`), the reception its first
 * reception block; one place for both takes the ceremony's. No block → no time.
 */
export function venueStopTimes(blocks: readonly ScheduleBlockRow[] | null | undefined): Partial<Record<VenueRole, string>> {
  if (!blocks?.length) return {};
  const at = (b: ScheduleBlockRow | null) => (b?.start_at ? formatBlockTimeRange(b.start_at, null) || null : null);
  const ceremony = at(ceremonyBlock(blocks));
  const reception = at(firstBlockOf(blocks, 'reception'));
  const out: Partial<Record<VenueRole, string>> = {};
  if (ceremony) out.ceremony = ceremony;
  if (reception) out.reception = reception;
  const both = ceremony ?? reception;
  if (both) out.both = both;
  return out;
}

/**
 * ONE MAP FOR EVERY PLACE — the standard OSM tiles with a numbered pin per
 * located venue (`lib/scene-map-tiles.ts`); `route` joins the pins in the order
 * of the day. Null when nothing is located.
 */
export function PinnedMap({ venues, route = false }: { venues: readonly EventVenue[]; route?: boolean }) {
  const located = venues.map((v, i) => ({ v, n: i + 1 })).filter(({ v }) => hasPin(v));
  const box = { width: 360, height: 220 };
  const frame = mapFrame(
    located.map(({ v }) => ({ latitude: v.latitude as number, longitude: v.longitude as number })),
    box,
  );
  if (!frame) return null;
  const label = located.map(({ v }) => v.name ?? VENUE_ROLE_LABEL[v.role]).join(' and ');
  const line = route && located.length > 1 ? frame.spots.map((s) => `${s.leftPct},${s.topPct}`).join(' ') : null;
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
      {line ? (
        <svg aria-hidden data-venue-route="" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={line}
            fill="none"
            stroke="#1E2229"
            strokeWidth={3}
            strokeDasharray="6 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
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
        className="absolute bottom-0 right-0 bg-cream/85 px-1.5 py-0.5 font-sans text-xs text-ink/80"
      >
        © OpenStreetMap
      </a>
    </figure>
  );
}

/**
 * DIRECTIONS ▾ — three map apps are ONE dropdown, never three buttons (the
 * prototype's journey note; any set of 3+ choices is a dropdown). A native
 * `<details>`: no JavaScript on the guest page. With no pin, the one honest
 * link is a maps search for the place.
 */
function DirectionsMenu({ venue }: { venue: EventVenue }) {
  const query = venueSearchQuery(venue)?.trim();
  const apps = hasPin(venue)
    ? [
        { name: 'Google Maps', href: googleMapsNavUrl(venue.latitude!, venue.longitude!) },
        { name: 'Waze', href: wazeNavUrl(venue.latitude!, venue.longitude!) },
        { name: 'Apple Maps', href: appleMapsUrl(venue.latitude!, venue.longitude!) },
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

type StyleProps = {
  venues: readonly EventVenue[];
  withheld: boolean;
  /** The Map switch: one map for every place, or none. */
  showMap: boolean;
  /** The plate's own ground for its chips (`VENUE_CHIP_GROUND` in venue-widget.tsx). */
  plateStyle: CSSProperties;
};

function Eyebrow({ count }: { count: number }) {
  return (
    <p className="pahina-eyebrow">
      <span>{count > 1 ? 'The venues' : 'The venue'}</span>
    </p>
  );
}

/**
 * 2 · FULL PHOTO — the photo is the card; the role and name sit on a fixed dark
 * gradient over it. The address and directions stay on the plate below, so they
 * never fight the picture. A venue with no photo is a clean text card — never
 * an empty tinted band (owner 2026-09-30).
 */
export function VenueFullPhoto({ venues, withheld, showMap, plateStyle }: StyleProps) {
  return (
    <section className="space-y-5" data-scene-style="full-photo">
      <Eyebrow count={venues.length} />
      {showMap ? <PinnedMap venues={venues} /> : null}
      {venues.map((venue) => {
        const words = (
          <>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em]">{VENUE_ROLE_LABEL[venue.role]}</p>
            {venue.name ? <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight">{venue.name}</h3> : null}
          </>
        );
        // Under a photo the plate carries only the address and directions — with
        // neither (withheld), there is no plate at all.
        const plateUnderPhoto = Boolean(venue.address) || !withheld;
        return (
          <div key={venue.role} data-venue-role={venue.role}>
            {venue.photoUrl ? (
              <figure className="relative aspect-[4/3] overflow-hidden bg-ink" data-venue-photo="">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={venue.photoUrl}
                  alt={venue.name ? `${venue.name}` : 'The venue'}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* Fixed, not themed: white on 90 % ink at the baseline reads on any photo. */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[70%]"
                  style={{ background: 'linear-gradient(180deg, rgba(20,22,26,0) 0%, rgba(20,22,26,.72) 45%, rgba(20,22,26,.9) 100%)' }}
                />
                <figcaption className="absolute inset-x-4 bottom-4 space-y-1 text-white">{words}</figcaption>
              </figure>
            ) : null}
            {venue.photoUrl && !plateUnderPhoto ? null : (
              <div className="pahina-plate space-y-3" style={plateStyle}>
                {venue.photoUrl ? null : <div className="space-y-1 text-ink">{words}</div>}
                {venue.address ? <p className="text-sm leading-relaxed text-ink/80">{venue.address}</p> : null}
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
            )}
          </div>
        );
      })}
      {withheld ? <p className="text-sm leading-relaxed text-ink/80">{VENUE_WITHHELD_LINE}</p> : null}
    </section>
  );
}

/**
 * 3 · THE JOURNEY — the day as a route: one map with every pin and the line
 * between them, then time · stop · stop down a dashed rail, each stop with one
 * Directions ▾. No photos here — the map is the picture. A stop with no time in
 * the run of show shows its number instead.
 */
export function VenueJourney({
  venues,
  withheld,
  showMap,
  plateStyle,
  times,
}: StyleProps & { times: Partial<Record<VenueRole, string>> }) {
  return (
    <section className="space-y-4" data-scene-style="journey">
      <Eyebrow count={venues.length} />
      {showMap ? <PinnedMap venues={venues} route /> : null}
      <ol className="pahina-plate" style={plateStyle}>
        {venues.map((venue, i) => (
          <li key={venue.role} data-venue-role={venue.role} className="grid grid-cols-[4.25rem_1rem_minmax(0,1fr)] gap-x-2.5">
            <p className="pt-0.5 font-pahina text-lg leading-none text-ink">
              {times[venue.role] ?? <span className="font-mono text-xs text-ink/80">{i + 1}</span>}
            </p>
            <span aria-hidden className="relative flex justify-center">
              <span className="mt-1 h-3.5 w-3.5 rounded-full bg-ink" />
              {i < venues.length - 1 ? <span className="absolute bottom-0 top-5 border-l-2 border-dashed border-ink/40" /> : null}
            </span>
            <div className={`min-w-0 space-y-1 ${i < venues.length - 1 ? 'pb-6' : ''}`}>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/80">{VENUE_ROLE_LABEL[venue.role]}</p>
              {venue.name ? (
                <h3 className="font-pahina text-xl font-light leading-snug tracking-tight text-ink">{venue.name}</h3>
              ) : null}
              {venue.address ? <p className="text-sm leading-relaxed text-ink/80">{venue.address}</p> : null}
              {withheld ? null : <DirectionsMenu venue={venue} />}
            </div>
          </li>
        ))}
      </ol>
      {withheld ? <p className="text-sm leading-relaxed text-ink/80">{VENUE_WITHHELD_LINE}</p> : null}
    </section>
  );
}
