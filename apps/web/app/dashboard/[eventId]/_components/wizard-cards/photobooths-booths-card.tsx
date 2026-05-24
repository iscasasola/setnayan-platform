/**
 * Card 14 Photobooths + Booths · WAVE 2 · multi-pick variant.
 *
 * Owner-locked behavior (CLAUDE.md 2026-05-23 Sixth row + this PR brief):
 * unlike every other vendor-pick card (Cards 02-13, 18-19, 22-24) which
 * auto-advance the wizard the moment the host locks a vendor, Card 14
 * stays put. PH cocktail-hour culture mixes 2-4 booth types in a single
 * reception — a wizard that closed after the first lock would force the
 * host to re-open Card 14 several times to add each additional booth,
 * breaking the inline-completion contract.
 *
 * Server component shell · fetches photobooth + mobile_bar recommendations
 * in parallel and renders the multi-pick client UI. The single-pick
 * VendorPickCard primitive doesn't apply here because:
 *   1. Locks need to STAY on Card 14 (no auto-advance) → calls lockBoothToEvent
 *      instead of completeVendorPickFromMarketplace.
 *   2. Two canonical categories (photobooth + mobile_bar) coexist on this
 *      card → vendor list groups by sub-type rather than the single-flat
 *      "top 5 of one category" pattern.
 *   3. A live "you've locked N booths" summary needs to render above the
 *      [I have all the booths I need] CTA — single-pick cards don't ship
 *      this footer.
 *
 * Entry point: the WizardHero dispatcher (wizard-hero.tsx) renders this
 * component when resolveWizardFocus returns task.id === 'photobooths_booths'.
 * No other surface mounts this component.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive "fix
 * the ones that should be by distance"): server-side PRE-FILTER recs to
 * within 10 km of the reception venue. Per CLAUDE.md 2026-05-24 sixth-
 * row "Vendor presentation pattern" spec lock, booths are Pattern B
 * "anchored to reception" — vans transport heavy equipment for setup
 * onsite. NULL-safe: vendors with no hq lat/lng are kept (treated as
 * "unknown, don't hide" per the established compat-array convention).
 * Stepper UI absent here because PhotoboothsBoothsCardClient is a custom
 * multi-pick primitive distinct from VendorPickGridCard's stepper —
 * widening beyond 10 km is V1.x polish once we have a multi-pick stepper.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import { fetchReceptionLatLng } from './_reception-lat-lng';
import { haversineKm } from '@/lib/geo';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { PhotoboothsBoothsCardClient } from './photobooths-booths-card-client';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

const PHOTOBOOTH_RADIUS_KM = 10;

/**
 * NULL-safe distance filter — vendors with no hq lat/lng are kept
 * (no data ≠ far away). When the host hasn't locked a reception venue
 * yet (no reception lat/lng), filter is a no-op (everyone passes).
 */
function filterWithinRadius(
  recs: ReadonlyArray<WizardVendorRec>,
  receptionLat: number | null,
  receptionLng: number | null,
  radiusKm: number,
): WizardVendorRec[] {
  if (receptionLat == null || receptionLng == null) return [...recs];
  return recs.filter((r) => {
    if (r.hq_latitude == null || r.hq_longitude == null) return true;
    const km = haversineKm(
      receptionLat,
      receptionLng,
      r.hq_latitude,
      r.hq_longitude,
    );
    return km <= radiusKm;
  });
}

export async function PhotoboothsBoothsCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const { receptionLat, receptionLng } = await fetchReceptionLatLng(
    admin,
    eventId,
  );

  // Two separate fetches — one per canonical_service grouping. Keeps the
  // recommendation buckets distinct so the host sees photobooth vendors
  // and mobile-bar vendors as TWO labeled sections rather than one
  // interleaved list. Bumped limit 10 → 25 so post-distance-filter we
  // still surface ~5-10 per bucket on average.
  const [photoboothRecsRaw, mobileBarRecsRaw] = await Promise.all([
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: ['photobooth'],
      ceremonyType,
      venueSetting,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 25,
    }),
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: ['mobile_bar'],
      ceremonyType,
      venueSetting,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 25,
    }),
  ]);

  const photoboothRecs = filterWithinRadius(
    photoboothRecsRaw,
    receptionLat,
    receptionLng,
    PHOTOBOOTH_RADIUS_KM,
  ).slice(0, 10);
  const mobileBarRecs = filterWithinRadius(
    mobileBarRecsRaw,
    receptionLat,
    receptionLng,
    PHOTOBOOTH_RADIUS_KM,
  ).slice(0, 10);

  // Already-locked booths for this event — surfaces in the picked-list
  // section above the CTA. RLS gates so a stranger can't fetch other
  // hosts' picks. We use the user-context client (createClient) for the
  // RLS path; createAdminClient is only used for the recs fetch (public
  // marketplace data).
  const supabase = await createClient();
  const { data: pickedRaw } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, marketplace_vendor_id, created_at')
    .eq('event_id', eventId)
    .in('category', ['photobooth', 'mobile_bar'])
    .order('created_at', { ascending: true });

  const picked = (pickedRaw ?? []).map((row) => ({
    vendor_id: (row as { vendor_id: string }).vendor_id,
    vendor_name: (row as { vendor_name: string }).vendor_name,
    category: (row as { category: 'photobooth' | 'mobile_bar' }).category,
    marketplace_vendor_id:
      (row as { marketplace_vendor_id?: string | null }).marketplace_vendor_id ?? null,
  }));

  return (
    <PhotoboothsBoothsCardClient
      eventId={eventId}
      photoboothRecs={photoboothRecs}
      mobileBarRecs={mobileBarRecs}
      pickedBooths={picked}
    />
  );
}
