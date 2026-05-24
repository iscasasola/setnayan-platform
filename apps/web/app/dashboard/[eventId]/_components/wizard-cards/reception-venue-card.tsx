/**
 * Card 02 Reception Venue · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 (owner directive): swapped from the legacy list VendorPickCard
 * to the new visual VendorPickGridCard. Card now shows venue photos,
 * Setnayan Verified badge + statement when certified, city, star rating,
 * review count. Adds a search bar (hits the full vendor DB on submit) and
 * 15-per-page pagination (3 columns × 5 rows) so the card doesn't extend
 * to 200+ entries.
 *
 * Server component · fetches top-100 reception-venue recommendations from
 * vendor_market_stats (filtered by event's ceremony_type + venue_setting +
 * region) plus per-vendor service photos + verification state. Passes the
 * result + the search-context filters to the grid client component.
 *
 * Excludes vendors the host has already locked into OTHER categories (so
 * the same Setnayan-Pay-enabled multi-category vendor doesn't surface
 * twice). The hard-single venue lock itself is enforced server-side by
 * event_vendors triggers when the host clicks [Lock this pick].
 *
 * Card kind: vendor_pick (per WIZARD_TASKS in lib/wizard.ts). The wizard
 * framework dispatches this card whenever resolveWizardFocus returns
 * task.id === 'reception_venue' (i.e., set_wedding_date is done and
 * reception_venue is not yet complete).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  /** events.venue_setting · one of banquet_hall / garden / beach / destination /
   *  heritage / outdoor_tent / civil_registrar (per 0043). Filters recs to
   *  vendors who serve that setting. NULL means no filter — show all. */
  venueSetting: string | null;
  /** event_vendors.marketplace_vendor_id values already locked on this
   *  event · excluded from recommendations so the host doesn't see the
   *  same vendor twice. */
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** events.event_date · drives the availability filter (2026-05-24
   *  owner directive). Vendors with a confirmed booking on this date
   *  render at 30% opacity with no action buttons. NULL = no
   *  availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['venue'] as const;

export async function ReceptionVenueCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();
  // Limit bumped from 15 → 100 so the grid's 15-per-page pagination has
  // multiple pages to walk through when marketplace inventory grows.
  // Search results also cap at 100 (matched in searchVendorRecommendations).
  // Booked IDs run in parallel · independent query.
  const [recs, bookedIds] = await Promise.all([
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: CANONICAL_SERVICES,
      ceremonyType,
      venueSetting,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 100,
    }),
    fetchBookedMarketplaceVendorIdsForDate(admin, eventId, eventDate),
  ]);

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="reception_venue"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'venues',
        customAddLabel: 'Booked elsewhere? Add your venue',
        emptyStateCopy:
          "We haven't curated reception venues for your area + ceremony yet — search by name or add yours below and we'll lock it into your plan.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
