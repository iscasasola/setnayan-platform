/**
 * Card 03 Ceremony Venue · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * Server component · fetches top-15 ceremony-venue recommendations from
 * vendor_market_stats (canonical: 'religious_venue' — churches, mosques,
 * INC chapels, civil registrar venues per the demo-vendor seed's
 * coarseCategoryFor() map). Filters by event's ceremony_type so Catholic
 * couples see churches, Muslim see mosques, INC see INC chapels, civil
 * see civil registrars / city hall halls.
 *
 * Same-venue-as-reception case: per the planning-groups spec (CLAUDE.md
 * 2026-05-09), couples whose ceremony + reception share the same banquet
 * hall add the venue to BOTH cards manually. This wizard surface does NOT
 * auto-link them; the host's [Add custom vendor] form lets them type the
 * same name into both cards if needed.
 *
 * Card kind: vendor_pick. Dispatched by WizardHero when wizard_state has
 * reception_venue done (or skipped via separate path) and ceremony_venue
 * not yet complete.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickCard } from './vendor-pick-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  /** Ceremony venues aren't typically filtered by venue_setting (a Catholic
   *  church doesn't have a "garden" attribute the way a reception venue
   *  does), but we pass it through for vendors who tagged compat anyway. */
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

export async function CeremonyVenueCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['religious_venue'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  // Ceremony-type-specific empty state copy — civil couples often find
  // their "ceremony venue" IS the city hall or a civil registrar, neither
  // of which surfaces from religious_venue. We say so plainly.
  const emptyCopy =
    ceremonyType === 'civil'
      ? "Civil ceremonies happen at city hall, a civil registrar, or your reception venue — add yours below and we'll lock it into your plan."
      : "We haven't curated ceremony venues for your area + faith yet — add yours below and we'll lock it into your plan.";

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="ceremony_venue"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Booked your church or chapel already?"
      emptyStateCopy={emptyCopy}
    />
  );
}
