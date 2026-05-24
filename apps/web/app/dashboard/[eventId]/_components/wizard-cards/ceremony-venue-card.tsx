/**
 * Card 03 Ceremony Venue · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 owner directives:
 *   1. Swap from the legacy list VendorPickCard to the visual
 *      VendorPickGridCard (same shape as Card 02 reception venue).
 *   2. Replace the city filter with a "Distance from Reception Venue"
 *      stepper (default 15 km, ±5 km steps). When the host has locked
 *      their reception venue, the grid only shows ceremony venues
 *      within the distance radius. Without a locked reception (preview
 *      mode / not-yet-locked), the distance filter is skipped and the
 *      grid behaves like Card 02 with a regular city filter as
 *      fallback (so the preview surface stays usable).
 *
 * Server component · fetches top-100 ceremony-venue recommendations from
 * vendor_market_stats (canonical: 'religious_venue' — churches, mosques,
 * INC chapels, civil registrar venues per the demo-vendor seed's
 * coarseCategoryFor() map). Filters by event's ceremony_type so Catholic
 * couples see churches, Muslim see mosques, INC see INC chapels, civil
 * see civil registrars / city hall halls.
 *
 * Reception venue location is resolved by joining event_vendors (the
 * host's locked reception_venue row) → vendor_profiles to pull
 * hq_latitude / hq_longitude. If the locked reception is off-platform
 * (custom vendor, no lat/lng) or not yet locked, distance filter is
 * skipped gracefully — the host still sees all churches in the region.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import { fetchReceptionLatLng } from './_reception-lat-lng';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  /** Accepted for API symmetry with sibling vendor-pick cards but
   *  INTENTIONALLY UNUSED for ceremony venue recommendations · see the
   *  query below for the rationale. */
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** events.event_date · drives the availability filter (2026-05-24
   *  owner directive). Ceremony venues with a confirmed booking on
   *  this date render at 30% opacity with no action buttons. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['religious_venue'] as const;

export async function CeremonyVenueCard({
  eventId,
  ceremonyType,
  // venueSetting deliberately destructured-then-ignored · we explain
  // why in the query below. The Props type keeps the prop so the page
  // doesn't need a special case calling this card.
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();

  // Reception lat/lng resolution moved to shared helper 2026-05-24 —
  // fetchReceptionLatLng() replaces the 30-line copy-paste that lived
  // here AND in accommodation-card. Same fail-soft semantics · grid
  // renders without the distance filter when reception isn't locked
  // or the locked vendor lacks lat/lng. Now also consumed by lights-
  // sound, led-background, and photobooths-booths cards.
  const { receptionLat, receptionLng } = await fetchReceptionLatLng(
    admin,
    eventId,
  );

  // Limit bumped to 100 so the 15-per-page pagination has multi-page
  // depth even after distance filtering narrows the set. Booked IDs
  // run in parallel · independent query.
  //
  // venueSetting deliberately passed as NULL · 2026-05-24 fix.
  // `events.venue_setting` is the host's RECEPTION venue type (banquet
  // hall / garden / beach / heritage / etc.) — it has no business
  // filtering CEREMONY venues. Churches are tagged by ceremony_type +
  // faith, not by what kind of reception will follow. Passing it
  // through previously hid every Catholic church for couples whose
  // reception wasn't 'heritage' (the seed in
  // 20260529000000_venue_directory_seed.sql tagged all 19 Catholic
  // churches with compatible_venue_settings=['heritage'] — couples
  // booking banquet-hall / garden / beach receptions matched zero
  // churches). The data migration
  // 20260524100000_ceremony_venue_loose_setting_compat.sql separately
  // NULLs out the column on admin-seeded religious venues so any
  // other consumer is also clean; this code-side belt-and-suspenders
  // is here because architecture-by-data is fragile.
  const [recs, bookedIds] = await Promise.all([
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: CANONICAL_SERVICES,
      ceremonyType,
      venueSetting: null,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 100,
    }),
    fetchBookedMarketplaceVendorIdsForDate(admin, eventId, eventDate),
  ]);

  // Ceremony-type-specific empty state copy — civil couples often find
  // their "ceremony venue" IS the city hall or a civil registrar, neither
  // of which surfaces from religious_venue. We say so plainly.
  const emptyCopy =
    ceremonyType === 'civil'
      ? "Civil ceremonies happen at city hall, a civil registrar, or your reception venue — add yours below and we'll lock it into your plan."
      : "We haven't curated ceremony venues for your area + faith yet — add yours below and we'll lock it into your plan.";

  const distanceFilter =
    receptionLat != null && receptionLng != null
      ? {
          referenceLat: receptionLat,
          referenceLng: receptionLng,
          // 2026-05-24 owner update: initial distance dropped 15 → 10 km
          // · churches further than ~10 km from the reception start to
          // strain the day-of logistics (guest travel, between-venue
          // photo windows, traffic). 10 keeps the default tight; the
          // host can widen via the stepper any time.
          initialKm: 10,
          referenceLabel: 'Reception Venue',
        }
      : undefined;

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="ceremony_venue"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        // Same NULL as the fetch above — keeps client-side
        // "load more / search" requests aligned with the server
        // result set so the host doesn't see a different number on
        // refine. See the comment above the fetch call for the why.
        venueSetting: null,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun:
          ceremonyType === 'civil'
            ? 'civil ceremony venues'
            : 'churches and chapels',
        customAddLabel: 'Booked your church or chapel already?',
        emptyStateCopy: emptyCopy,
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
