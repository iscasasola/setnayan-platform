import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Radar, Filter, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  buildVendorHealthComposite,
  type VendorHealthInputs,
} from '@/lib/vendor-health-composite';
import { buildGrowthRecs, type GrowthRecStats } from '@/lib/vendor-growth-recs';
import { fetchVendorSourceAttribution } from '@/lib/vendor-source-attribution';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { asVendorTier, TIER_PRICE_PHP } from '@/lib/vendor-tier-caps';
import { HealthCompositeCard } from './_components/health-composite-card';
import { GrowthRecsCard } from './_components/growth-recs-card';
import { RoiAttributionCard } from './_components/roi-attribution-card';
import { MomentumCard, type MomentumWindow } from './_components/momentum-card';

export const metadata = { title: 'My Performance · Vendor · Setnayan' };

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/**
 * /vendor-dashboard/performance — "My Performance" cockpit, reskinned to the
 * finalized vendor-dashboard prototype.
 *
 * Four sections, all wired to LIVE per-vendor data:
 *   1. Dark business-health card — the SIGNATURE surface. A champagne-gold
 *      composite ring + five vendor-SAFE pillar bars (Responsiveness /
 *      Reputation / Demand / Conversion / Delivery), built ONLY from the
 *      vendor's own vendor_activity_stats row. NEVER the HQ-internal
 *      platform_health_score.
 *   2. Grow your business — recommendation cards derived from the vendor's own
 *      gaps (response rate, profile completeness, review count) + a steady
 *      calendar-availability prompt.
 *   3. Setnayan vs your own book — app-vs-import ROI from
 *      vendor_source_attribution(). Headline peso + two channel bars.
 *   4. Momentum — Monthly/Annual toggle over booked count + confirmed revenue,
 *      also from vendor_source_attribution() across two windows.
 *
 * OWNER/ADMIN ONLY: this surfaces money figures, so it mirrors the
 * Earnings/Demand gate — 'performance' is absent from
 * VENDOR_SCOPED_NAV_ITEM_KEYS, and the page re-checks canManageVendor()
 * server-side. Agents/viewers are redirected to the dashboard root.
 */
export default async function VendorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ momentum?: string }>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Owner/admin only — the ROI + momentum panels surface booking revenue.
  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  const momentumMode: 'month' | 'year' = search.momentum === 'year' ? 'year' : 'month';

  // ── Health + growth: the vendor-facing activity-stats row (the same row the
  //    home VendorStatsPanel reads). maybeSingle() → graceful null for new
  //    vendors; the composite + recs both degrade to honest empty states.
  const { data: statsRow } = await supabase
    .from('vendor_activity_stats')
    .select(
      'quality_score, response_rate_pct, booking_completion_rate_pct, profile_completeness_pct, review_avg_bayesian, review_count, inquiry_to_booking_pct, finalized_booking_count, avg_response_minutes',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();

  const health = buildVendorHealthComposite(
    (statsRow as VendorHealthInputs | null) ?? null,
  );
  const growthRecs = buildGrowthRecs((statsRow as GrowthRecStats | null) ?? null);

  // month-over-month composite delta — no historical snapshot table exists yet,
  // so there is no prior composite to diff against. Rather than invent a number,
  // the delta is left null (the card omits the "+N this month" chip).
  const monthDelta: number | null = null;

  // ── ROI + momentum: three attribution windows off the same SECURITY DEFINER
  //    RPC (ownership-gated in SQL). Year window drives the ROI headline;
  //    month + year windows drive the Momentum toggle.
  const [attributionYear, attributionMonth, vendorCatalog, tierRow] = await Promise.all([
    fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(365)),
    fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(28)),
    fetchV2VendorCatalog().catch(() => []),
    supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle(),
  ]);

  // The vendor's own annual plan cost — DB-catalog-authoritative, keyed off the
  // vendor's current tier. Falls back to the shipped tier-price constant only if
  // the catalog lacks the row (mirrors the subscription page's dual source).
  const tier = asVendorTier((tierRow.data as { tier_state?: string | null } | null)?.tier_state);
  const annualSku = `${tier}_vendor_annual`;
  const catalogAnnual = vendorCatalog.find((r) => r.sku_code === annualSku)?.price_php ?? null;
  const annualPlanPhp = catalogAnnual ?? TIER_PRICE_PHP[tier].annual;

  const monthWindow: MomentumWindow = {
    bookings: attributionMonth?.totalBookings ?? 0,
    earningsPhp: attributionMonth?.totalRevenuePhp ?? 0,
    pricedCount: attributionMonth?.totalPriced ?? 0,
  };
  const yearWindow: MomentumWindow = {
    bookings: attributionYear?.totalBookings ?? 0,
    earningsPhp: attributionYear?.totalRevenuePhp ?? 0,
    pricedCount: attributionYear?.totalPriced ?? 0,
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-2">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Vendor · My Performance
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          My Performance
        </h1>
        <p className="text-base" style={{ color: 'var(--m-slate)' }}>
          How your shop is doing.
        </p>
      </header>

      {/* 1 · Dark business-health card (signature). */}
      <HealthCompositeCard health={health} monthDelta={monthDelta} />

      {/* 2 · Grow your business — highest impact first. */}
      <GrowthRecsCard recs={growthRecs} />

      {/* 3 · Setnayan vs your own book — app-vs-import ROI. */}
      <RoiAttributionCard
        attribution={attributionYear}
        annualPlanPhp={annualPlanPhp}
        windowLabel="this year"
      />

      {/* 4 · Momentum — Monthly / Annual toggle. */}
      <MomentumCard mode={momentumMode} month={monthWindow} year={yearWindow} />

      {/* Drill-down links to the already-shipped analytics surfaces. */}
      <section className="space-y-3">
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Go deeper
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/vendor-dashboard/demand"
            className="group flex items-start gap-3 rounded-[14px] border bg-white p-4 transition-colors"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <Radar className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
                Demand Radar
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--m-slate-3)' }}
                />
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--m-slate)' }}>
                Where demand is building in your area — by month and by the looks
                couples are choosing.
              </span>
            </span>
          </Link>

          <Link
            href="/vendor-dashboard/funnel"
            className="group flex items-start gap-3 rounded-[14px] border bg-white p-4 transition-colors"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <Filter className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
                Quote-to-Booking Funnel
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--m-slate-3)' }}
                />
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--m-slate)' }}>
                How couples move from finding you to booking you — views to
                inquiries to quotes to bookings.
              </span>
            </span>
          </Link>
        </div>
      </section>
    </section>
  );
}
