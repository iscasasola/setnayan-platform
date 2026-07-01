import { redirect } from 'next/navigation';
import { Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canSeePerformanceTrends } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VendorTierGate } from '../_components/tier-gate';
import { FunnelPanel } from '../_components/funnel-panel';
import {
  computeVendorFunnelView,
  coerceFunnelRange,
} from '@/lib/vendor-funnel';

export const metadata = { title: 'Funnel · Vendor' };

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ range?: string }> };

export default async function VendorFunnelPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  if (isVendorFeatureGateEnabled() && !canSeePerformanceTrends(tier)) {
    return (
      <VendorTierGate
        feature="Quote-to-Booking Funnel"
        requiredTier="solo"
        blurb="Your views → inquiries → quotes → booked trend over time, sliced by where couples found you. Your performance analytics start with Solo."
        icon={<Filter aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const range = coerceFunnelRange(search.range);

  // Whole funnel view — the SHARED live read (same helper the Overview uses).
  // Reads run on the RLS-scoped session client; vendor_profile_views is gated
  // to current_vendor_profile_ids() and the other tables RLS-scope to the
  // vendor's own rows.
  const view = await computeVendorFunnelView(
    supabase,
    profile.vendor_profile_id,
    range,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <FunnelPanel
        steps={view.steps}
        sourceSlices={view.sourceSlices}
        viewSourceSlices={view.viewSourceSlices}
        range={view.range}
        sinceIso={view.sinceIso}
        variant="page"
      />
    </div>
  );
}
