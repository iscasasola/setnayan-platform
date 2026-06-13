import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Users, Building2 } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm } from '@/lib/geo';
import {
  displayVenueType,
  findReceptionVenuesByVenueSetting,
  formatVenueCapacity,
  formatVenueDayRate,
  isCombinedVenue,
  venueSettingToDirectoryType,
  venueTypeToSetting,
  type PairedVenueCandidate,
} from '@/lib/venue-recommendations';
import { AddVenueToPlanButton } from './add-venue-to-plan-button';

/**
 * Reception venues surface — rendered inside the Reception folder of the
 * marketplace catalog.
 *
 * 2026-05-22 evening upgrade (CLAUDE.md "Pull V1.2 venue directory forward
 * to V1") — pulls forward the V1.2 venue iteration so the Reception folder
 * goes from "filter-only with placeholder chips" to a real card grid backed
 * by `venue_directory` rows. Adds:
 *
 *   • <FacetFilterBar> — chip strip above the cards that drives
 *     `?venue=<facet>` URL state. Active chip narrows the grid; "All
 *     venue settings" chip clears the filter. The host's `events.venue_
 *     setting` chip carries a "Yours" sub-badge so they recognize their
 *     own pick even when drilling into a different facet.
 *   • Card pricing + capacity surfaces — `formatVenueDayRate()` +
 *     `formatVenueCapacity()` from venue-recommendations.ts populate the
 *     chip row when Agent A's schema columns are present. Pre-migration
 *     rows hide the chips cleanly.
 *   • "⇄ also hosts ceremony" badge — combined-venue indicator overlaying
 *     the hero photo. Reads from `venue_category = 'combined'` post-Agent-A,
 *     falls back to a venue_type-based map for pre-migration rows.
 *   • DEMO chip — admin demo-mode signal (overlays the hero photo) so
 *     admins exercising the marketplace know which venues are seed-only.
 *   • "View venue details →" CTA — links to Agent C's `/venue/[slug]`
 *     detail page (PR #322).
 *
 * Mirrors `CeremonyVenuesSection` pattern with Reception-specific surfaces.
 * Replaces the 7-chip stub UI that previously sat ABOVE this section in
 * `page.tsx` (the chip strip is now this section's <FacetFilterBar> so
 * the host has one canonical filter primitive).
 *
 * Entry points (per [[orphan_prevention]]):
 *   • Dashboard event-home Reception planning-group [Search] button →
 *     `/vendors?folder=reception#reception` → host's venue_setting auto-
 *     applies → cards render
 *   • Direct `/vendors?folder=reception&venue=garden` → cards narrow to
 *     garden venues
 *   • FolderTabs click from another folder onto Reception → preserves
 *     URL params including the venue facet
 *   • Anonymous browse + `?venue=banquet_hall` → cards render without
 *     host-specific banner
 */

/**
 * Active facet definition — mirrors the 7 venue_setting facets across the
 * marketplace. Kept here so the section can drive both the chip rendering
 * AND the SQL filter without two sources of truth drifting.
 *
 * `civil_registrar` is omitted: it's a ceremony-only venue_type and
 * doesn't have reception-side rows in venue_directory. Surfacing it as
 * a chip in Reception would always produce the empty state.
 */
type ReceptionFacet = {
  /** events.venue_setting enum value, used as the ?venue=… URL param. */
  key: string;
  /** Display label for the chip. Matches VENUE_SETTING_LABEL in page.tsx. */
  label: string;
  /** Whether this venue setting can also host the ceremony back-to-back. */
  combined: boolean;
};

const RECEPTION_FACETS: ReadonlyArray<ReceptionFacet> = [
  { key: 'banquet_hall', label: 'Hotel Ballroom / Banquet Hall', combined: false },
  { key: 'garden',       label: 'Garden Estate',                 combined: true  },
  { key: 'beach',        label: 'Beach',                         combined: true  },
  { key: 'destination',  label: 'Destination Resort',            combined: true  },
  { key: 'heritage',     label: 'Heritage / Hacienda',           combined: true  },
  { key: 'outdoor_tent', label: 'Outdoor Tent',                  combined: true  },
];

export async function ReceptionVenuesSection({
  hostVenueSetting,
  venueFilterActive,
  /** Explicit `?venue=<facet>` pick from the URL. Overrides the host's
   *  default-on filter when set. Null = no explicit pick. */
  activeFacet,
  venueAnchor,
  currentEventId,
  /** Admin demo mode (cookie + admin profile). When true, includes
   *  `is_demo=TRUE` rows in the card grid and surfaces a DEMO chip on
   *  the hero photo. */
  isDemoMode: demoMode,
}: {
  hostVenueSetting: string | null;
  venueFilterActive: boolean;
  activeFacet: string | null;
  venueAnchor: { lat: number; lng: number } | null;
  currentEventId: string | null;
  isDemoMode: boolean;
}) {
  const admin = createAdminClient();

  // Resolve the effectively-narrowed filter: explicit chip pick wins over
  // the host's default-on setting; null = show all 6 facets.
  const explicitDirectoryType =
    activeFacet !== null ? venueSettingToDirectoryType(activeFacet) : null;
  const hostDirectoryType =
    venueFilterActive && hostVenueSetting !== null
      ? venueSettingToDirectoryType(hostVenueSetting)
      : null;
  const effectiveDirectoryType: string | null =
    explicitDirectoryType ?? hostDirectoryType;

  // The active chip in the FacetFilterBar — the venue_setting key (not
  // the venue_directory.venue_type) so it round-trips to the URL cleanly.
  const effectiveFilter: string | null =
    activeFacet ?? (venueFilterActive ? hostVenueSetting : null);

  const candidates = await findReceptionVenuesByVenueSetting(admin, {
    hostDirectoryType: effectiveDirectoryType,
    anchorLat: venueAnchor?.lat ?? null,
    anchorLng: venueAnchor?.lng ?? null,
    eventId: currentEventId,
    perTypeLimit: 12,
    includeDemo: demoMode,
  });

  // Unfiltered total for the count strip — gives the host a sense of the
  // broader catalog size when they narrow.
  const totalAll =
    effectiveDirectoryType !== null
      ? await findReceptionVenuesByVenueSetting(admin, {
          hostDirectoryType: null,
          anchorLat: null,
          anchorLng: null,
          eventId: null,
          perTypeLimit: 12,
          includeDemo: demoMode,
        })
      : candidates;

  return (
    <section
      aria-labelledby="reception-venues-heading"
      className="mb-6 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <header className="mb-3 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            Reception Venues
          </p>
          <span className="font-mono text-xs text-ink/55">
            {candidates.length} of {totalAll.length} venues
          </span>
        </div>
        <h2
          id="reception-venues-heading"
          className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          {effectiveDirectoryType !== null
            ? `Top ${displayVenueType(effectiveDirectoryType)} venues for your wedding`
            : 'Where you celebrate after the ceremony'}
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Settings marked{' '}
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-800">
            ⇄ also hosts ceremony
          </span>{' '}
          can do both back-to-back at the same location. Add any venue to
          your plan to lock it in for your wedding date.
        </p>
      </header>

      {/* Filter chip bar — horizontal scroll on mobile, wraps on desktop. */}
      <FacetFilterBar
        effectiveFilter={effectiveFilter}
        hostVenueSetting={hostVenueSetting}
      />

      {/* Card grid — 1-col mobile, 2-col tablet, 3-col desktop. Polite
          empty-state copy when the filter narrows to 0 venues. */}
      {candidates.length > 0 ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((venue) => (
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
        <EmptyState activeFilter={effectiveFilter} />
      )}
    </section>
  );
}

/**
 * Filter chip bar — horizontal-scrolling on mobile, wraps on desktop.
 * Each chip toggles the `?venue=…` URL param. The "All venue settings"
 * chip clears the filter entirely (`?venue=0` so the default-on host
 * filter also drops). Active chip gets the brighter terracotta fill
 * so it reads as "currently filtered". The host's own pick stays
 * highlighted with a "Yours" sub-badge even when they've drilled into
 * a different facet.
 */
function FacetFilterBar({
  effectiveFilter,
  hostVenueSetting,
}: {
  effectiveFilter: string | null;
  hostVenueSetting: string | null;
}) {
  // Build URL for each chip — preserves folder=reception (catalog scope).
  // Active chip's href clears the filter (toggles off); inactive chip
  // sets the filter to its key. Other URL state (q, city, sort, match)
  // is intentionally not propagated here because chip clicks happen in
  // catalog mode where those params don't apply — the next.js Link will
  // simply navigate to the new URL.
  const buildHref = (facetKey: string | null): string => {
    const params = new URLSearchParams();
    params.set('folder', 'reception');
    if (facetKey === null) {
      // "All" chip — explicit opt-out of the host's default-on filter so
      // ?venue=0 broadens the card grid even when host has a setting.
      params.set('venue', '0');
    } else {
      params.set('venue', facetKey);
    }
    return `/vendors?${params.toString()}#reception`;
  };

  const allActive = effectiveFilter === null;

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
      {/* "All" chip — clears the venue filter */}
      <Link
        key={allActive ? 'all-active' : 'all-idle'}
        href={buildHref(null)}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          allActive
            ? 'border-terracotta bg-terracotta text-cream sn-bounce'
            : 'border-ink/15 bg-cream text-ink/75 hover:border-terracotta/40 hover:bg-terracotta/5 hover:text-terracotta'
        }`}
        aria-pressed={allActive}
        aria-label="Show all venue settings"
      >
        All venue settings
      </Link>
      {RECEPTION_FACETS.map((facet) => {
        const isActive = effectiveFilter === facet.key;
        const isHostPick = hostVenueSetting === facet.key;
        return (
          <Link
            key={isActive ? `${facet.key}-active` : facet.key}
            href={buildHref(facet.key)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-terracotta bg-terracotta text-cream sn-bounce'
                : isHostPick
                  ? 'border-terracotta/50 bg-terracotta/10 text-terracotta hover:border-terracotta hover:bg-terracotta/15'
                  : 'border-ink/15 bg-cream text-ink/75 hover:border-terracotta/40 hover:bg-terracotta/5 hover:text-terracotta'
            }`}
            aria-pressed={isActive}
            aria-label={
              isActive
                ? `${facet.label} — filter active. Click to clear.`
                : `Filter to ${facet.label} venues only.`
            }
            title={isHostPick ? "Your wedding's picked setting" : undefined}
          >
            <span>{facet.label}</span>
            {facet.combined ? (
              <span
                className={`shrink-0 rounded-full px-1 font-mono text-[9px] uppercase tracking-[0.1em] ${
                  isActive
                    ? 'bg-cream/20 text-cream'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
                aria-label="Also hosts ceremony"
              >
                ⇄
              </span>
            ) : null}
            {isHostPick && !isActive ? (
              <span className="shrink-0 rounded-full bg-terracotta px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-cream">
                Yours
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Individual venue card — matches the CeremonyVenueCard pattern but with
 * Reception-specific fields (capacity range, day rate, combined badge,
 * DEMO chip, compatible-settings chip row, View venue details link).
 */
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
  const capacityLabel = formatVenueCapacity(venue.capacity_min, venue.capacity_max);
  const dayRateLabel = formatVenueDayRate(venue.day_rate_php_min, venue.day_rate_php_max);
  const combined = isCombinedVenue(venue.venue_type, venue.venue_category);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-cream transition-shadow hover:shadow-sm">
      {venue.hero_image_url ? (
        <div className="relative aspect-[16/10] w-full bg-ink/5">
          <Image
            src={venue.hero_image_url}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
          {venue.is_demo ? (
            <span className="absolute left-2 top-2 rounded-full bg-ink/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream">
              DEMO
            </span>
          ) : null}
          {combined ? (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-100/95 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-800 shadow-sm">
              ⇄ Also hosts ceremony
            </span>
          ) : null}
        </div>
      ) : (
        <div
          aria-hidden
          className="relative flex aspect-[16/10] w-full items-center justify-center bg-terracotta/10"
        >
          <Building2 aria-hidden className="absolute h-12 w-12 text-terracotta/30" strokeWidth={1.5} />
          <span className="relative text-3xl font-semibold text-terracotta-700">
            {initials}
          </span>
          {venue.is_demo ? (
            <span className="absolute left-2 top-2 rounded-full bg-ink/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream">
              DEMO
            </span>
          ) : null}
          {combined ? (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-100/95 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-800 shadow-sm">
              ⇄ Also hosts ceremony
            </span>
          ) : null}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <header className="space-y-1">
          <h3 className="text-base font-semibold text-ink">{venue.name}</h3>
          <p className="flex items-center gap-1.5 text-xs text-ink/65">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>{venue.location_city}</span>
            <span className="text-ink/35">·</span>
            <span className="font-mono uppercase tracking-[0.05em] text-ink/50">
              {displayVenueType(venue.venue_type)}
            </span>
          </p>
        </header>

        {/* Capacity + day rate row — adaptive: shows whichever fields are
            populated. Pre-Agent-A migration these all hide cleanly because
            the helper returns null for both. */}
        <div className="flex flex-wrap gap-2 text-xs">
          {capacityLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-ink/75">
              <Users aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              {capacityLabel}
            </span>
          ) : null}
          {dayRateLabel ? (
            <span className="inline-flex items-center rounded-full bg-terracotta/10 px-2 py-0.5 font-medium text-terracotta-700">
              {dayRateLabel}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 italic text-ink/50">
              Inquire for pricing
            </span>
          )}
          {hasAnchor && venue.distance_km > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-ink/65">
              <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              {formatDistanceKm(venue.distance_km)} from your venue
            </span>
          ) : null}
        </div>

        {/* Compatible-settings chip row — shows which marketplace filter
            chips would surface this venue. Pure-informational; clicking
            doesn't filter (filter chips are at section top). Hidden when
            only the obvious single-setting tag is present. */}
        {(() => {
          const matchingSetting = venueTypeToSetting(venue.venue_type);
          if (matchingSetting === null) return null;
          return (
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full bg-cream px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/55 ring-1 ring-inset ring-ink/10">
                {settingShortLabel(matchingSetting)}
              </span>
            </div>
          );
        })()}

        {/* CTA row — pushed to bottom of the card. View venue details
            opens Agent C's `/venue/[slug]` page (PR #322); Add to plan
            reuses the existing AddVenueToPlanButton from the Ceremony
            card pattern. */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Link
            href={`/venue/${venue.slug}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 hover:text-terracotta"
            aria-label={`View ${venue.name} details`}
          >
            View venue details →
          </Link>
          <AddVenueToPlanButton
            venueDirectoryId={venue.venue_directory_id}
            initiallyAdded={venue.is_in_plan}
            canAdd={currentEventId !== null}
          />
        </div>

        {/* Attribution footer for hero photos (Wikimedia Commons compliance
            per migration 20260526020000_venue_directory_hero_images.sql). */}
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

/**
 * Empty-state copy when the filter narrows to 0 venues. Polite brand-voice
 * (per [[no_dev_text_post_launch]]) — no engineering jargon. The fallback
 * "browse all" link drops the venue filter via `?venue=0`.
 */
function EmptyState({ activeFilter }: { activeFilter: string | null }) {
  const facetLabel = activeFilter
    ? RECEPTION_FACETS.find((f) => f.key === activeFilter)?.label ?? activeFilter
    : null;
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-6 text-center">
      <p className="text-sm text-ink/75">
        {facetLabel ? (
          <>
            No <span className="font-medium text-ink">{facetLabel}</span> venues
            in our directory yet.
          </>
        ) : (
          <>No reception venues match these filters yet.</>
        )}
      </p>
      <p className="mt-1 text-xs text-ink/55">
        Try a different venue setting, or{' '}
        <Link
          href="/vendors?folder=reception&venue=0#reception"
          className="text-terracotta underline-offset-2 hover:underline"
        >
          browse all reception venues
        </Link>
        . Setnayan is curating more venues weekly.
      </p>
    </div>
  );
}

function settingShortLabel(setting: string): string {
  switch (setting) {
    case 'banquet_hall':
      return 'Banquet hall';
    case 'garden':
      return 'Garden';
    case 'beach':
      return 'Beach';
    case 'destination':
      return 'Destination';
    case 'heritage':
      return 'Heritage';
    case 'outdoor_tent':
      return 'Outdoor tent';
    default:
      return setting.replace(/_/g, ' ');
  }
}
