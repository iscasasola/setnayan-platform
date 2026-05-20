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
 * Pre-launch state (2026-05-21): venue_directory has 19 Catholic Churches,
 * 3 INC Chapels, 3 Mosques, 3 Christian Churches, 5 Civil Registrars. Faith
 * filter narrows to whichever the couple has selected (or all when
 * anonymous browse).
 */
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

  if (candidates.length === 0) {
    // Soft-fail — no venues match the faith. Section disappears rather
    // than rendering an empty header.
    return null;
  }

  // Group by venue_type for the section sub-headers.
  const groups = new Map<string, PairedVenueCandidate[]>();
  for (const c of candidates) {
    const arr = groups.get(c.venue_type) ?? [];
    arr.push(c);
    groups.set(c.venue_type, arr);
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
          ceremony venues in the directory.{' '}
          <span className="text-ink/45">
            Bookable listings ship in V1.2 — couples should still book the parish
            office / mosque / chapel / LGU directly today.
          </span>
        </p>
      </header>

      {[...groups.entries()].map(([venueType, venues]) => (
        <div key={venueType} className="mb-5 last:mb-0">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {displayVenueType(venueType)} ({venues.length})
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <li key={venue.venue_directory_id}>
                <CeremonyVenueCard venue={venue} hasAnchor={venueAnchor !== null} currentEventId={currentEventId} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
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
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
            V1.2 · Bookable soon
          </span>
        </div>
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
