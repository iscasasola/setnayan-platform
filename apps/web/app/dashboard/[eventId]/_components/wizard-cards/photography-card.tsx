/**
 * Card 05 Photography + Video · Phase 2 of iteration 0016 Concierge
 * Active Wizard.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Photo + video
 * teams travel — Filipino couples regularly hire NCR-based studios for
 * Tagaytay / Cebu / Boracay weddings, or fly out a destination
 * specialist. Sort by ad_rank → review_count → avg_rating_overall: trust
 * and portfolio depth matter more than km-from-venue for this category.
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
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** events.event_date · drives the availability filter. Photo + video
   *  teams with a confirmed booking on this date render at 30% opacity
   *  with no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['photographer', 'videographer'] as const;

export async function PhotographyCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();
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
      taskId="photography"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'photo + video teams',
        customAddLabel: 'Already booked your photographer or videographer?',
        emptyStateCopy:
          "We haven't curated photo + video teams for your area yet — search by name or add yours below and we'll lock them into your plan.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
