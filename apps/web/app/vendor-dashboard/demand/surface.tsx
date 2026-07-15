import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { Radar, Info } from 'lucide-react';
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
import { fetchBookedBySource, FUNNEL_MIN_N } from '@/lib/vendor-funnel';
import { DemandRadarCard } from './_components/demand-radar-card';
import { SourceBreakdown } from '../_components/source-breakdown';
import { VendorTierGate } from '../_components/tier-gate';

const DAY_MS = 24 * 60 * 60 * 1000;
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

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
        requiredTier="enterprise"
        blurb="A de-identified read of where demand is building in your market — by month and by the looks couples choose. Cross-business market intelligence is an Enterprise feature."
        icon={<Radar aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  // Market intel (the radar) + a clearly-labeled OWN-DATA strip: where THIS
  // vendor's own bookings came from this year (folded in from the retired
  // /funnel page · owner 2026-07-02). The two are visually + textually separated
  // so own-attribution never reads as de-identified market data.
  const [radar, bookedBySource] = await Promise.all([
    getVendorDemandRadar(supabase, profile.vendor_profile_id),
    fetchBookedBySource(supabase, profile.vendor_profile_id, isoDaysAgo(365)),
  ]);

  // Cron-free, throttled opportunistic rebuild after the response flushes.
  after(async () => {
    await maybeRefreshDemandRadar();
  });

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <article className="flex items-start gap-3 sn-tile p-4 text-sm text-ink/75">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium text-ink">How Demand Radar protects privacy</p>
          <p className="text-sm text-ink/70">
            Every number here is a <span className="font-medium">count</span> —
            inquiries, paid unlocks, and bookings rolled up by month and look for
            your region. Small groups are hidden until there are enough of them
            that no single couple can be picked out. That&rsquo;s why the radar
            can look quiet early on — it fills in as your market grows.
          </p>
        </div>
      </article>

      <DemandRadarCard radar={radar} marketLabel={marketLabel} scope="vendor" />

      {/* ── Your own data — clearly separated from the market-intel radar above.
          The radar is de-identified + cross-business; this strip is YOUR own
          bookings, sliced by where each couple found you. */}
      <div className="space-y-3 border-t border-ink/10 pt-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            Your own data
          </span>
          <p className="text-xs text-ink/55">
            Not market data — this is where your own bookings came from.
          </p>
        </div>
        <SourceBreakdown
          title="Where your bookings come from"
          blurb={`Where your booked couples first found you this year. Sources with fewer than ${FUNNEL_MIN_N} bookings are hidden to keep the read reliable.`}
          slices={bookedBySource}
          emptyText="No bookings this year yet."
        />
      </div>
    </section>
  );
}
