import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isPaidSize } from '@/lib/vendor-tier-caps';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { settledValue } from '@/lib/settled-read';
import { fetchEligibleCreators, fetchVendorSentOffers } from '@/lib/creator-offers';
import { fetchVendorCreatorRoi } from '@/lib/creator-analytics';
import { CreatorsView } from './_components/creators-view';

export const metadata = { title: 'Creators · Supplier' };
export const dynamic = 'force-dynamic';

type SearchParams = {
  sent?: string;
  minReach?: string;
  error?: string;
};

export default async function VendorCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // PRO-AND-UP to SEND (owner ratification decision #4, 2026-07-16). Until
  // 2026-09-30 this page returned a full-page upsell for every sub-Pro shop —
  // a paywall that ignored VENDOR_TIER_FEATURE_GATE, so Creators was the one
  // supplier surface paywalled in production while the switch was off.
  //
  // TRY-FIRST now: every shop may browse creators, set a reach bar and draft an
  // offer. The ask lives at the final action only. ⚠ It is NOT routed through
  // vendorPaywallApplies() on purpose: the Pro floor is enforced by the
  // database itself (offer_creator_reach_hold raises TIER_BELOW_PRO_NO_REACH,
  // unconditionally), so the switch cannot lift it — a ◆ note that vanished
  // with the switch off would promise a Send that the database refuses. Lifting
  // the floor is an owner call + a migration, not a flag.
  //
  // ⏱ ONE ROUND TRIP: the tier and the three lists below ask nothing of each other. Settled, not Promise.all — each
  // failure still surfaces where it always did (`settledValue`): the tier's first, the lists' after the ◆ check.
  const minReach = Math.max(0, Number.parseInt(search.minReach ?? '0', 10) || 0);
  const [tierRead, listsRead] = await Promise.allSettled([
    resolveVendorTier(supabase, profile.vendor_profile_id),
    Promise.all([
      fetchEligibleCreators({ minReach, limit: 60 }),
      fetchVendorSentOffers(supabase, profile.vendor_profile_id),
      // P3 per-creator ROI — ledger facts only (inquiries driven
      // spent · collab status). NO "discount given" (settles off-platform).
      fetchVendorCreatorRoi(supabase, profile.vendor_profile_id),
    ]),
  ]);
  const tier = settledValue(tierRead);
  // 🔒 The ◆ note is a purchase hint → absent in the App Store / Play Store shell.
  const sendNeedsPro = !isPaidSize(tier) && !(await isStoreShellRequest()); // every paid size since 2026-11-22

  const [creators, sentOffers, roi] = settledValue(listsRead);

  // Creators this vendor already has an OUTSTANDING (pending) offer to — hide
  // the send form for them (the DB also enforces one-pending-per-pair).
  const pendingCreatorIds = new Set(
    sentOffers.filter((o) => o.status === 'pending').map((o) => o.creatorUserId),
  );

  return (
    <CreatorsView
      creators={creators}
      sentOffers={sentOffers}
      roi={roi}
      minReach={minReach}
      pendingCreatorIds={pendingCreatorIds}
      sendNeedsPro={sendNeedsPro}
      flash={{ error: search.error, sent: Boolean(search.sent) }}
    />
  );
}
