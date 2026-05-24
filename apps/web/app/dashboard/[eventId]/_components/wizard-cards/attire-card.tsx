/**
 * Card 18 Attire · Phase 4 · Programming tier.
 *
 * Combined gown + suit card. Filipino weddings often book the bride's
 * gown and groom's suit (and increasingly the barong tagalog) from the
 * same designer or sister boutiques, so surfacing both pools at once
 * gives the host the fullest picture.
 *
 * Muslim couples get modest-attire vendors via the
 * compatible_ceremony_types[] filter; Cultural weddings get traditional
 * Filipiniana / tribal attire designers if tagged.
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

export async function AttireCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['gown_designer', 'suit_designer'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  let emptyCopy: string;
  switch (ceremonyType) {
    case 'muslim':
      emptyCopy =
        "We haven't curated modest-attire designers for your area yet — add yours below. Many Muslim couples work with a designer who handles both the bride's modest gown and the groom's barong / formalwear.";
      break;
    case 'cultural':
      emptyCopy =
        "We haven't curated traditional Filipiniana or tribal-attire designers for your area yet — add yours below.";
      break;
    default:
      emptyCopy =
        "We haven't curated attire designers for your area yet — add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="attire"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Already booked your designer or rental?"
      emptyStateCopy={emptyCopy}
    />
  );
}
