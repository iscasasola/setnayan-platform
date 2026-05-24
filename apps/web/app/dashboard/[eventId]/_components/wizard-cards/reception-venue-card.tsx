/**
 * Card 02 Reception Venue · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * Server component · fetches top-15 reception-venue recommendations from
 * vendor_market_stats (filtered by event's ceremony_type + venue_setting +
 * region) and renders them through the reusable VendorPickCard primitive.
 *
 * Excludes vendors the host has already locked into OTHER categories (so
 * the same Setnayan-Pay-enabled multi-category vendor doesn't surface
 * twice). The hard-single venue lock itself is enforced server-side by
 * event_vendors triggers when the host clicks [Lock this vendor].
 *
 * Card kind: vendor_pick (per WIZARD_TASKS in lib/wizard.ts). The wizard
 * framework dispatches this card whenever resolveWizardFocus returns
 * task.id === 'reception_venue' (i.e., set_wedding_date is done and
 * reception_venue is not yet complete).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickCard } from './vendor-pick-card';

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
};

export async function ReceptionVenueCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['venue'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="reception_venue"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Booked elsewhere? Add your venue"
      emptyStateCopy="We haven't curated reception venues for your area + ceremony yet — add yours below and we'll lock it into your plan."
    />
  );
}
