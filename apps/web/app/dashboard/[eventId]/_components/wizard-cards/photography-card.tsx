/**
 * Card 05 Photography + Video · Phase 2 of iteration 0016 Concierge
 * Active Wizard.
 *
 * Single card that covers BOTH photographers + videographers since they
 * book together at most Filipino weddings (same studio often does both,
 * or two studios coordinate as a package). The
 * vendor_profiles.services[] coarse-category values are 'photographer'
 * and 'videographer' per the demo-vendor seed's coarseCategoryFor()
 * function — we surface both via a single `services && ['photographer',
 * 'videographer']` overlap query.
 *
 * Same-vendor-locked-twice case: when a host locks a Setnayan-Pay vendor
 * who offers BOTH photo + video, this card stays complete after the
 * first lock (wizard_state.photography.completed_at gets stamped). The
 * host can use [Add custom vendor] later to add a SECOND vendor (e.g.,
 * a separate videographer) — that creates another event_vendors row
 * with category='videographer' alongside the first 'photographer' row.
 * The wizard treats one lock as task-complete; the host can iterate.
 *
 * Card kind: vendor_pick.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickCard } from './vendor-pick-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

export async function PhotographyCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['photographer', 'videographer'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="photography"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Already booked your photographer or videographer?"
      emptyStateCopy="We haven't curated photo + video teams for your area yet — add yours below and we'll lock them into your plan."
    />
  );
}
