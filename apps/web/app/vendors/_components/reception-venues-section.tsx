import Image from 'next/image';
import { MapPin } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm } from '@/lib/geo';
import {
  displayVenueType,
  findReceptionVenuesByVenueSetting,
  venueSettingToDirectoryType,
  type PairedVenueCandidate,
} from '@/lib/venue-recommendations';
import { AddVenueToPlanButton } from './add-venue-to-plan-button';

/**
 * Reception venues surface, rendered INSIDE the Reception folder of the
 * marketplace catalog directly underneath the 7 venue_setting facet chips.
 *
 * Closes the gap reported 2026-05-22: clicking Reception on the dashboard
 * landed on the 7-card venue-setting picker, but the cards never drilled
 * into actual venues because Reception is filter-only by design (CLAUDE.md
 * 2026-05-20 row 470 — no canonical_services back Reception until V1.2 ships
 * dedicated /venues records with per-location calendars + day-rates). The
 * fix: surface real `venue_directory` rows directly in the section, default-
 * filtered to the host's `events.venue_setting` so couples instantly see
 * "their" venues (e.g. a banquet_hall host sees Hotel Ballrooms; the 6
 * facet chips above stay as a "switch setting" escape hatch).
 *
 * Mirrors `CeremonyVenuesSection` exactly:
 *   • Pulls `venue_directory` rows for the 6 reception types
 *     (hotel_ballroom / garden / beach / destination_resort / heritage /
 *     outdoor_tent) via `findReceptionVenuesByVenueSetting`.
 *   • ALWAYS renders the venue_type sub-headers (even when zero rows in a
 *     type) so couples see "Hotel Ballroom" presence unconditionally. Empty
 *     types render an EmptyPlaceholderCard listing recognisable PH names so
 *     the catalog reads curated, not broken.
 *   • Reuses `AddVenueToPlanButton` so the picked venue lands in the host's
 *     Reception planning group with one click.
 *
 * Visibility filter:
 *   • host has venue_setting + ?venue not 0 → show ONLY the matching type's
 *     section (banquet_hall → only "Hotel Ballroom" cards). One venue_type
 *     surface, deep coverage.
 *   • anonymous OR ?venue=0 → show all 6 reception venue_types, each capped
 *     at perTypeLimit. Broad catalog view.
 */

type PlaceholderType = {
  venue_type: string;
  /** Sample venue names couples will recognize — empty-state placeholder. */
  examples: ReadonlyArray<string>;
};

const RECEPTION_VENUE_PLACEHOLDERS: ReadonlyArray<PlaceholderType> = [
  {
    venue_type: 'hotel_ballroom',
    examples: [
      'Manila Marriott',
      'Conrad Manila',
      'Shangri-La at the Fort',
      'Peninsula Manila',
      'Solaire Resort',
      'Diamond Hotel',
    ],
  },
  {
    venue_type: 'garden',
    examples: [
      "Antonio's Garden — Tagaytay",
      "Sonya's Garden — Tagaytay",
      'Hillcreek Gardens — Tagaytay',
      'Glass Garden — Pasig',
    ],
  },
  {
    venue_type: 'beach',
    examples: [
      'Shangri-La Boracay',
      'Henann Resort Boracay',
      'Crimson Boracay',
    ],
  },
  {
    venue_type: 'destination_resort',
    examples: [
      'Shangri-La Mactan',
      'Crimson Resort Mactan',
      'Discovery Shores Boracay',
    ],
  },
  {
    venue_type: 'heritage',
    examples: [
      'Las Casas Filipinas de Acuzar',
      'Casa Real de Cavite',
      'Sulyap Gallery Café — San Pablo',
    ],
  },
  {
    venue_type: 'outdoor_tent',
    examples: [
      'Mountain Lake Resort — Cavinti',
      'Hacienda Isabella — Cavite',
      'Pavilion-style garden venues',
    ],
  },
];

/**
 * Narrow the placeholder rows to the host's chosen setting (when set).
 * Anonymous browsers + ?venue=0 opt-outs see all 6 placeholder types.
 */
function visiblePlaceholders(
  hostDirectoryType: string | null,
): ReadonlyArray<PlaceholderType> {
  if (hostDirectoryType === null) return RECEPTION_VENUE_PLACEHOLDERS;
  return RECEPTION_VENUE_PLACEHOLDERS.filter(
    (p) => p.venue_type === hostDirectoryType,
  );
}

export async function ReceptionVenuesSection({
  hostVenueSetting,
  venueFilterActive,
  venueAnchor,
  currentEventId,
}: {
  /**
   * Host's events.venue_setting (snake_case enum — banquet_hall / garden /
   * beach / destination / heritage / outdoor_tent / civil_registrar). Null
   * when anonymous OR the host hasn't picked one yet.
   */
  hostVenueSetting: string | null;
  /**
   * True when the venue default-on filter is currently firing (host has a
   * setting picked + ?venue not 0). When true AND host has a setting, narrow
   * to that one venue_type. When false (opt-out OR no setting), show all 6.
   */
  venueFilterActive: boolean;
  /**
   * Host's reception anchor (from `events.venue_latitude/longitude`). Drives
   * the distance-from-your-venue chip on each card.
   */
  venueAnchor: { lat: number; lng: number } | null;
  /**
   * Drives the `is_in_plan` pre-resolution on each card so the
   * AddVenueToPlanButton renders in its terminal "Added" state on first
   * paint. Null on anonymous browse — the button hides per its `canAdd`
   * prop.
   */
  currentEventId: string | null;
}) {
  const admin = createAdminClient();

  // Translate the events.venue_setting → venue_directory.venue_type, but
  // only when the filter is actually firing. When `?venue=0` opts out OR
  // the host has no setting picked, surface all 6 reception types.
  const hostDirectoryType =
    venueFilterActive && hostVenueSetting !== null
      ? venueSettingToDirectoryType(hostVenueSetting)
      : null;

  const candidates = await findReceptionVenuesByVenueSetting(admin, {
    hostDirectoryType,
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

  const placeholders = visiblePlaceholders(hostDirectoryType);

  // If the host has a venue_setting that didn't map (civil_registrar — that
  // lives in the Ceremony folder, not Reception), skip the section
  // entirely. The 7-card facet picker above still renders.
  if (placeholders.length === 0) return null;

  // Brand-voice copy varies by mode:
  //   • Host with setting → "Your hotel ballrooms" (anchored personal)
  //   • Anonymous / opt-out → "Top PH reception venues" (anchored catalog)
  const eyebrowCopy = 'Reception Venues';
  const headingCopy =
    hostDirectoryType !== null
      ? `Top ${displayVenueType(hostDirectoryType)} venues for your wedding`
      : 'Where you celebrate after the ceremony';
  const subheadCopy =
    hostDirectoryType !== null
      ? 'Real PH venues in our directory for your picked setting. Add any to your plan to lock it in.'
      : 'A curated PH directory across the six reception settings. Pick a setting above OR browse all the venues below.';

  return (
    <section
      aria-labelledby="reception-venues-heading"
      className="mb-6 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <header className="mb-4 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          {eyebrowCopy}
        </p>
        <h2
          id="reception-venues-heading"
          className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          {headingCopy}
        </h2>
        <p className="max-w-prose text-sm text-ink/65">{subheadCopy}</p>
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
                    <ReceptionVenueCard
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
        <span className="font-medium text-ink">
          Setnayan is curating PH {displayVenueType(placeholder.venue_type)}{' '}
          venues.
        </span>{' '}
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

function ReceptionVenueCard({
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
