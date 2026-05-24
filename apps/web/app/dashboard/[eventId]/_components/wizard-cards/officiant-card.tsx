/**
 * Card 04 Officiant · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * Server component · fetches top-15 officiant recommendations from
 * vendor_market_stats. Filters by event's ceremony_type so Catholic
 * couples see priests, Muslim see imams, INC see ministers, Christian
 * see pastors, civil see judges, etc. — the
 * vendor_profiles.compatible_ceremony_types[] gating per iteration 0043
 * handles this naturally.
 *
 * Cross-iteration linkage with venue_directory (per PR #24 + #309): many
 * Catholic couples discover their officiant THROUGH their church (parish
 * priest, parish secretary's assigned celebrant). When the host has
 * already locked a religious_venue with a linked priest list, the
 * wizard SHOULD surface those linked officiants first. V1 scope of this
 * card defers that linkage to V1.x — the recommendations are pulled from
 * vendor_market_stats only, plus the [Add custom vendor] form for hosts
 * who already know their officiant's name (e.g., "Fr. Tito Casasola" /
 * "Judge Maria Cruz") without going through Setnayan booking.
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

export async function OfficiantCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['officiant'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  // Faith-specific empty-state framing so the brand voice matches who's
  // reading. Brand voice per [[feedback_setnayan_no_dev_text_post_launch]].
  let emptyCopy: string;
  switch (ceremonyType) {
    case 'catholic':
      emptyCopy =
        'Most Catholic couples book their parish priest directly — add their name below and we’ll lock them into your plan.';
      break;
    case 'civil':
      emptyCopy =
        'For civil ceremonies, your officiant is typically a judge or registrar — add their name below.';
      break;
    case 'muslim':
      emptyCopy =
        "Add your imam below — we'll lock them into your plan with the rest of your team.";
      break;
    case 'inc':
      emptyCopy =
        "Add your INC minister below — we'll lock them into your plan.";
      break;
    case 'christian':
      emptyCopy =
        "Add your pastor below — we'll lock them into your plan.";
      break;
    default:
      emptyCopy =
        "We haven't curated officiants for your area yet — add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="officiant"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Already have someone in mind?"
      emptyStateCopy={emptyCopy}
    />
  );
}
