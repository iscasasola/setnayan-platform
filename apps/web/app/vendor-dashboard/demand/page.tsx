import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { Radar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { asVendorTier, canSeeMarketIntel } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { regionLabel } from '@/lib/region-source';
import {
  getVendorDemandRadar,
  maybeRefreshDemandRadar,
} from '@/lib/demand-radar';
import { DemandRadarPanel } from '../_components/demand-radar-panel';
import { VendorTierGate } from '../_components/tier-gate';

export const metadata = { title: 'Demand Radar · Vendor' };

/**
 * /vendor-dashboard/demand — Demand Radar (Wave 6 vendor "Soon" benefit).
 *
 * A READ-ONLY, de-identified "where should I focus?" card for the vendor's OWN
 * home market (hq_region). It reads the demand_radar_for_vendor() RPC, which
 * enforces ownership + region scope + the admin-managed min-N floor + the
 * radar_enabled master toggle in SQL — so this surface only ever sees
 * (region, month, event_type, style) → COUNTS buckets that cleared the floor.
 * No couple identity reaches here.
 *
 * Owner/admin only (matches Payday/Earnings — it surfaces market intelligence):
 * 'demand' is absent from VENDOR_SCOPED_NAV_ITEM_KEYS, and the page re-checks
 * canManageVendor() server-side.
 *
 * Cron-free freshness: an after() hook opportunistically rebuilds the rollup
 * (throttled to ~once/hour/instance) so the radar stays current off real
 * vendor traffic — never a poller.
 */
export default async function VendorDemandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  // The vendor's home market label (the RPC scopes by hq_region server-side;
  // this is purely for the card header). Targeted single-column read.
  // hq_region for the card header + tier_state for the gate, in one read.
  const { data: regionRow } = await supabase
    .from('vendor_profiles')
    .select('hq_region, tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const typedRow = regionRow as { hq_region?: string | null; tier_state?: string | null } | null;
  const hqRegion = typedRow?.hq_region ?? null;
  const marketLabel = hqRegion ? regionLabel(hqRegion) ?? hqRegion : null;

  if (isVendorFeatureGateEnabled() && !canSeeMarketIntel(asVendorTier(typedRow?.tier_state))) {
    return (
      <VendorTierGate
        feature="Demand Radar"
        requiredTier="pro"
        blurb="A de-identified read of where demand is building in your market — by month and by the looks couples choose. Market intelligence is a Pro feature."
        icon={<Radar aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const radar = await getVendorDemandRadar(supabase, profile.vendor_profile_id);

  // Cron-free, throttled opportunistic rebuild after the response flushes.
  after(async () => {
    await maybeRefreshDemandRadar();
  });

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <DemandRadarPanel
        radar={radar}
        marketLabel={marketLabel}
        scope="vendor"
        variant="page"
      />
    </section>
  );
}
