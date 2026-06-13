import Image from 'next/image';
import { MapPin } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm } from '@/lib/geo';
import {
  findPairedCeremonyVenues,
  displayVenueType,
  PAIRED_VENUE_CONFIG,
} from '@/lib/venue-recommendations';
import { AddVenueToPlanButton } from './add-venue-to-plan-button';

/**
 * Paired-venue recommendation panel. Renders ceremony venues within a
 * configurable radius of the couple's reception anchor (saved via the
 * save-vendor flow). Closes the "I picked a reception venue, where's the
 * ceremony" planning loop.
 *
 * V1 data source: `venue_directory` table (read-only seed of ~50 known
 * PH wedding venues). Entries are informational — couples can't book or
 * contact through Setnayan yet. V1.2 venue iteration upgrades these into
 * bookable listings with per-location calendar + day-rates; the panel UI
 * stays the same and the cards gain CTAs at that point.
 *
 * Visibility rules:
 *   • Hidden entirely when the couple has no `events.venue_latitude` set.
 *   • Hidden when no directory entries match the faith + radius window
 *     (graceful — couples don't see a "0 results" empty panel pretending
 *     to be useful).
 *   • Faith-filtered to the couple's `ceremony_type` so Catholic couples
 *     don't see mosques in their recommendations.
 */
export async function PairedVenuePanel({
  anchor,
  coupleCeremonyType,
  currentEventId,
}: {
  anchor: { lat: number; lng: number; name: string | null };
  coupleCeremonyType: string | null;
  /**
   * Primary event id for the signed-in couple, or null when the viewer is
   * anonymous or doesn't have a primary event yet. Drives the
   * AddVenueToPlanButton's canAdd + initiallyAdded state.
   */
  currentEventId: string | null;
}) {
  const admin = createAdminClient();
  const candidates = await findPairedCeremonyVenues(admin, {
    anchorLat: anchor.lat,
    anchorLng: anchor.lng,
    coupleCeremonyType,
    eventId: currentEventId,
  });

  if (candidates.length === 0) {
    // Empty state — soft-fail so the panel doesn't render at all rather
    // than showing a "no venues found" message that reads as broken. When
    // the directory grows or V1.2 seeds land, this branch self-clears.
    return null;
  }

  const anchorLabel = anchor.name ?? 'your reception venue';

  return (
    <section
      aria-labelledby="paired-venues-heading"
      className="mt-8 rounded-2xl border border-terracotta/20 bg-terracotta/[0.03] p-4 sm:p-5"
    >
      <header className="mb-3 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Plan around your venue
        </p>
        <h2
          id="paired-venues-heading"
          className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          Ceremony venues near {anchorLabel}
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Within {PAIRED_VENUE_CONFIG.radiusKm} km of your reception anchor.
          {coupleCeremonyType
            ? ` Filtered to ${displayCeremonyType(coupleCeremonyType)} venues.`
            : null}{' '}
          Add any to your plan to lock it in for your wedding date.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((venue) => {
          const initials =
            venue.name
              .split(/\s+/)
              .map((p) => p.charAt(0).toUpperCase())
              .slice(0, 2)
              .join('') || '?';
          return (
            <li key={venue.venue_directory_id}>
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
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {venue.name}
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      {venue.location_city}
                    </p>
                  </header>
                  <p className="inline-flex items-center gap-1 text-xs text-ink/70">
                    <MapPin
                      aria-hidden
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                    <span className="font-mono">
                      {formatDistanceKm(venue.distance_km)}
                    </span>
                    <span className="text-ink/45">from your venue</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/65">
                      {displayVenueType(venue.venue_type)}
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
            </li>
          );
        })}
      </ul>
    </section>
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
    case 'aglipayan':
      return 'Aglipayan (IFI)';
    case 'lds':
      return 'LDS (Latter-day Saints)';
    case 'sda':
      return 'Seventh-day Adventist';
    case 'jw':
      return "Jehovah's Witnesses";
    case 'hindu':
      return 'Hindu';
    case 'sikh':
      return 'Sikh';
    case 'buddhist':
      return 'Buddhist';
    case 'orthodox':
      return 'Orthodox Christian';
    case 'civil':
      return 'civil';
    default:
      return key;
  }
}
