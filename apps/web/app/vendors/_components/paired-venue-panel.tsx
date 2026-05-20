import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm } from '@/lib/geo';
import {
  findPairedCeremonyVenues,
  PAIRED_VENUE_CONFIG,
} from '@/lib/venue-recommendations';

/**
 * Paired-venue recommendation panel. Renders ceremony venues within a
 * configurable radius of the couple's reception anchor (saved via the
 * save-vendor flow in PR #229). Closes the "I picked a reception venue,
 * where's the ceremony" planning loop.
 *
 * Visibility rules:
 *   • Hidden entirely when the couple has no `events.venue_latitude` set.
 *   • Hidden when religious_venue vendor seed is empty (graceful — couples
 *     don't see a "0 results" empty panel pretending to be useful).
 *   • Faith-filtered to the couple's `ceremony_type` so Catholic couples
 *     don't see mosques in their recommendations.
 *
 * Pre-launch state (2026-05-21): zero religious_venue rows seeded. Panel
 * renders nothing. V1.2 venue iteration seeds ~80 PH churches/mosques/INC
 * chapels and this panel lights up automatically.
 */
export async function PairedVenuePanel({
  anchor,
  coupleCeremonyType,
}: {
  anchor: { lat: number; lng: number; name: string | null };
  coupleCeremonyType: string | null;
}) {
  const admin = createAdminClient();
  const candidates = await findPairedCeremonyVenues(admin, {
    anchorLat: anchor.lat,
    anchorLng: anchor.lng,
    coupleCeremonyType,
  });

  if (candidates.length === 0) {
    // Empty state — soft-fail so the panel doesn't render at all rather
    // than showing a "no venues found" message that reads as broken. When
    // V1.2 seeds land, this branch self-clears.
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
            : null}
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((venue) => {
          const href = venue.business_slug ? `/v/${venue.business_slug}` : '#';
          const initials =
            venue.business_name
              .split(/\s+/)
              .map((p) => p.charAt(0).toUpperCase())
              .slice(0, 2)
              .join('') || '?';
          return (
            <li key={venue.vendor_profile_id}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
              >
                <header className="flex items-center gap-2">
                  {venue.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={venue.logo_url}
                      alt={venue.business_name}
                      className="h-10 w-10 shrink-0 rounded-md border border-ink/10 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/15 text-sm font-semibold text-terracotta-700">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-ink group-hover:text-terracotta">
                      {venue.business_name}
                    </h3>
                    {venue.location_city ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {venue.location_city}
                      </p>
                    ) : null}
                  </div>
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
                <p className="mt-auto text-xs font-medium text-terracotta group-hover:underline">
                  View venue →
                </p>
              </Link>
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
    case 'civil':
      return 'civil';
    default:
      return key;
  }
}
