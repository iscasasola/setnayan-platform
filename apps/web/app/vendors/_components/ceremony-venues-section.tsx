import Image from 'next/image';
import { MapPin } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm } from '@/lib/geo';
import {
  findCeremonyVenuesByFaith,
  displayVenueType,
  type PairedVenueCandidate,
} from '@/lib/venue-recommendations';
import { AddVenueToPlanButton } from './add-venue-to-plan-button';

/**
 * Ceremony venues surface, rendered INSIDE the Ceremony folder of the
 * marketplace catalog. Closes the gap where Catholic Churches / INC Chapels
 * / Mosques / Christian Churches / Cultural Sites / Civil Registrars from
 * the `venue_directory` table only appeared in the PairedVenuePanel
 * (which requires a reception anchor) or `/admin/venues` (admin-only).
 *
 * Couples browsing the Ceremony folder now see actual venues — grouped by
 * type, faith-filtered when religion-default-on is active — alongside the
 * officiants and pre-marriage canonical_service tiles.
 *
 * 2026-05-21: ALWAYS renders the venue_type sub-headers, even when
 * venue_directory has no matching rows (e.g. migration not yet applied,
 * faith filter narrows to a type with 0 seeds). Each empty sub-header
 * shows a couple-friendly placeholder listing example venues — couples
 * see "Catholic Church" presence on Ceremony unconditionally, replaced by
 * real cards as the directory fills.
 */

type PlaceholderType = {
  venue_type: string;
  /** Sample venue names couples will recognize — empty-state placeholder. */
  examples: ReadonlyArray<string>;
  /** Ceremony types this venue_type is allowed under. Mirrors compatible_ceremony_types. */
  faiths: ReadonlyArray<string>;
};

const CEREMONY_VENUE_PLACEHOLDERS: ReadonlyArray<PlaceholderType> = [
  {
    venue_type: 'catholic_church',
    examples: ['Manila Cathedral', 'Sto. Domingo Church', 'Pink Sisters Tagaytay', 'Caleruega', 'San Agustin Church'],
    faiths: ['catholic'],
  },
  {
    venue_type: 'christian_church',
    examples: ["Christ's Commission Fellowship", 'Victory Christian Fellowship', 'JIL Manila'],
    faiths: ['christian'],
  },
  {
    venue_type: 'inc_chapel',
    examples: ['INC Central Office QC', 'INC Local Manila', 'INC Local Cubao'],
    faiths: ['inc'],
  },
  {
    venue_type: 'mosque',
    examples: ['Manila Golden Mosque', 'Marawi Grand Mosque', 'Cotabato Grand Mosque'],
    faiths: ['muslim'],
  },
  {
    venue_type: 'cultural_site',
    examples: ['Indigenous community grounds', 'Maranao cultural grounds', 'Tausug ancestral sites'],
    faiths: ['cultural'],
  },
  {
    venue_type: 'civil_registrar',
    examples: ['Manila City Hall', 'Quezon City Hall', 'Makati City Hall', 'Cebu City Hall'],
    faiths: ['civil', 'catholic', 'christian', 'inc', 'cultural'],
  },
];

function visiblePlaceholders(
  coupleCeremonyType: string | null,
): ReadonlyArray<PlaceholderType> {
  if (coupleCeremonyType === null) return CEREMONY_VENUE_PLACEHOLDERS;
  return CEREMONY_VENUE_PLACEHOLDERS.filter((p) =>
    p.faiths.includes(coupleCeremonyType),
  );
}

export async function CeremonyVenuesSection({
  coupleCeremonyType,
  venueAnchor,
  currentEventId,
}: {
  coupleCeremonyType: string | null;
  venueAnchor: { lat: number; lng: number } | null;
  currentEventId: string | null;
}) {
  const admin = createAdminClient();
  const candidates = await findCeremonyVenuesByFaith(admin, {
    coupleCeremonyType,
    anchorLat: venueAnchor?.lat ?? null,
    anchorLng: venueAnchor?.lng ?? null,
    eventId: currentEventId,
    perTypeLimit: 6,
  });

  // Bucket actual candidates by venue_type.
  const candidatesByType = new Map<string, PairedVenueCandidate[]>();
  for (const c of candidates) {
    const arr = candidatesByType.get(c.venue_type) ?? [];
    arr.push(c);
    candidatesByType.set(c.venue_type, arr);
  }

  const placeholders = visiblePlaceholders(coupleCeremonyType);

  // Build the full list of types to render: every placeholder type that
  // matches the faith. Real candidates fill in when they exist; an empty
  // placeholder card renders when they don't. This guarantees couples see
  // "Catholic Church" etc. on the Ceremony folder unconditionally.
  if (placeholders.length === 0) {
    // Civil-only couple with only civil_registrar — still rendered above.
    // Fall-through here only if the coupleCeremonyType is unknown.
    return null;
  }

  return (
    <section
      aria-labelledby="ceremony-venues-heading"
      className="mb-6 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <header className="mb-4 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Ceremony Venues
        </p>
        <h2
          id="ceremony-venues-heading"
          className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          Where your ceremony will take place
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Top {coupleCeremonyType ? displayCeremonyType(coupleCeremonyType) : 'PH'}{' '}
          ceremony venues in the directory. Add any to your plan to lock it in
          for your wedding date.
        </p>
      </header>

      {placeholders.map((placeholder) => {
        const venues = candidatesByType.get(placeholder.venue_type) ?? [];
        return (
          <div key={placeholder.venue_type} className="mb-5 last:mb-0">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              {displayVenueType(placeholder.venue_type)}{' '}
              {venues.length > 0 ? `(${venues.length})` : ''}
            </h3>
            {venues.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {venues.map((venue) => (
                  <li key={venue.venue_directory_id}>
                    <CeremonyVenueCard
                      venue={venue}
                      hasAnchor={venueAnchor !== null}
                      currentEventId={currentEventId}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyPlaceholderCard placeholder={placeholder} />
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Empty-state card for a venue_type with no directory rows yet. Lists a
 * handful of example venue names so couples see the category is real and
 * Setnayan is curating — without claiming bookable availability.
 */
function EmptyPlaceholderCard({ placeholder }: { placeholder: PlaceholderType }) {
  return (
    <article className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-4">
      <p className="text-sm text-ink/75">
        <span className="font-medium text-ink">Setnayan is curating PH{' '}
        {displayVenueType(placeholder.venue_type)} venues.</span>{' '}
        Examples coming to the directory:
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {placeholder.examples.map((name) => (
          <li
            key={name}
            className="inline-flex items-center rounded-full bg-ink/[0.04] px-2 py-0.5 text-xs text-ink/70"
          >
            {name}
          </li>
        ))}
      </ul>
    </article>
  );
}

function CeremonyVenueCard({
  venue,
  hasAnchor,
  currentEventId,
}: {
  venue: PairedVenueCandidate;
  hasAnchor: boolean;
  currentEventId: string | null;
}) {
  const initials =
    venue.name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?';
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-ink/10 bg-cream">
      {venue.hero_image_url ? (
        <div className="relative aspect-[16/10] w-full bg-ink/5">
          <Image
            src={venue.hero_image_url}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex aspect-[16/10] w-full items-center justify-center bg-terracotta/10"
        >
          <span className="text-3xl font-semibold text-terracotta-700">
            {initials}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <header>
          <h4 className="truncate text-sm font-semibold text-ink">
            {venue.name}
          </h4>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {venue.location_city}
          </p>
        </header>
        {hasAnchor ? (
          <p className="inline-flex items-center gap-1 text-xs text-ink/70">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-mono">{formatDistanceKm(venue.distance_km)}</span>
            <span className="text-ink/45">from your venue</span>
          </p>
        ) : null}
        <div className="mt-auto">
          <AddVenueToPlanButton
            venueDirectoryId={venue.venue_directory_id}
            initiallyAdded={venue.is_in_plan}
            canAdd={currentEventId !== null}
          />
        </div>
        {venue.hero_image_url && venue.hero_image_attribution ? (
          <p className="font-mono text-[9px] leading-tight text-ink/40">
            {venue.hero_image_source_url ? (
              <a
                href={venue.hero_image_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-ink/60 hover:underline"
              >
                {venue.hero_image_attribution}
              </a>
            ) : (
              venue.hero_image_attribution
            )}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function displayCeremonyType(key: string): string {
  switch (key) {
    case 'catholic':
      return 'Catholic';
    case 'christian':
      return 'Christian';
    case 'inc':
      return 'INC';
    case 'muslim':
      return 'Muslim';
    case 'cultural':
      return 'Cultural';
    case 'civil':
      return 'civil';
    default:
      return key;
  }
}
