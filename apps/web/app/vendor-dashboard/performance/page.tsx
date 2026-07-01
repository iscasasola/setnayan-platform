import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Gauge, TrendingUp, Radar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  buildVendorHealthComposite,
  type VendorHealthInputs,
} from '@/lib/vendor-health-composite';
import { buildGrowthRecs, type GrowthRecStats } from '@/lib/vendor-growth-recs';
import { fetchVendorSourceAttribution } from '@/lib/vendor-source-attribution';
import {
  fetchVendorBookingSeries,
  fetchVendorBookingDailySeries,
} from '@/lib/vendor-booking-series';
import {
  fetchVendorFunnelTotals,
  buildFunnelSteps,
  fetchServiceBookedCount,
  fetchNullServiceBookedCount,
} from '@/lib/vendor-funnel';
import { getVendorDemandRadar } from '@/lib/demand-radar';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  asVendorTier,
  TIER_PRICE_PHP,
  canSeePerformanceTrends,
  canSeePerformanceAdvanced,
  canSeeMarketIntel,
} from '@/lib/vendor-tier-caps';
import {
  isVendorFeatureGateEnabled,
  resolveVendorTier,
} from '@/lib/vendor-feature-gate';
import { VendorTierGate, VendorTierTeaser } from '../_components/tier-gate';
import { HealthCompositeCard } from './_components/health-composite-card';
import { GrowthRecsCard } from './_components/growth-recs-card';
import { RoiAttributionCard } from './_components/roi-attribution-card';
import { MomentumCard, type MomentumWindow, type MomentumMode } from './_components/momentum-card';
import { FunnelPreviewCard } from './_components/funnel-preview-card';
import { DemandPreviewCard } from './_components/demand-preview-card';
import {
  ServiceScopeSelector,
  scopeLabelFor,
} from './_components/service-scope-selector';
import { ScopeNote } from './_components/scope-note';

export const metadata = { title: 'My Performance · Vendor · Setnayan' };

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** A small uppercase eyebrow that groups the cards below it into a section. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-mono text-[11px] uppercase tracking-[0.2em]"
      style={{ color: 'var(--m-slate-3)' }}
    >
      {children}
    </p>
  );
}

/**
 * /vendor-dashboard/performance — the "My Performance" cockpit.
 *
 * TIERED (owner 2026-07-01, "apply this to our live website"):
 *   • Solo   — own-shop glance: Health composite · Grow recs · basic Momentum
 *              (count, Monthly/Annual). variant='basic'.
 *   • Pro    — full own-business analytics: + revenue & Daily Momentum · ROI
 *              (Setnayan vs your book) · booking Funnel.
 *   • Enter. — + cross-business MARKET INTEL (Demand Radar · Price-Position),
 *              de-identified + min-N, nationwide totals only.
 *   • Free/Verified — no My Performance (full-page upsell).
 *
 * The gates read the caps in lib/vendor-tier-caps.ts (performanceTrends /
 * performanceAdvanced / marketIntel) and are FLAG-DARK behind
 * isVendorFeatureGateEnabled(): default OFF → every tier sees every card, so
 * today's founder + demo/test vendors (all tier_state='free') are unchanged.
 * The owner flips VENDOR_TIER_FEATURE_GATE=true once paid vendors exist.
 *
 * OWNER/ADMIN ONLY: money figures — 'performance' is absent from
 * VENDOR_SCOPED_NAV_ITEM_KEYS, and the page re-checks canManageVendor()
 * server-side. Agents/viewers are redirected to the dashboard root.
 *
 * DATA ISOLATION: every own-business reader is a SECURITY DEFINER RPC
 * ownership-gated to current_vendor_profile_ids(); the market-intel readers are
 * de-identified + min-N floored. No card ever exposes another business's rows.
 */
export default async function VendorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ momentum?: string; service?: string }>;
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

  // ── Tier gating (flag-dark). Resolve tier up front so a free/verified vendor
  //    short-circuits to the upsell WITHOUT running the full data batch.
  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  const gateOn = isVendorFeatureGateEnabled();

  if (gateOn && !canSeePerformanceTrends(tier)) {
    return (
      <VendorTierGate
        feature="My Performance"
        requiredTier="solo"
        blurb="See how your shop is doing — a business-health snapshot, growth tips, and your booking momentum. My Performance starts with Solo."
        icon={<Gauge aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const canAdvanced = !gateOn || canSeePerformanceAdvanced(tier); // Pro+
  const canMarket = !gateOn || canSeeMarketIntel(tier); // Enterprise

  // Momentum window from the URL. Daily is Pro+ only — normalize a stray ?day.
  const raw = search.momentum;
  let momentumMode: MomentumMode =
    raw === 'year' ? 'year' : raw === 'day' ? 'day' : 'month';
  if (momentumMode === 'day' && !canAdvanced) momentumMode = 'month';

  // ── Batch A — everything that does NOT depend on the chosen service scope:
  //    the activity-stats row (health + growth), the vendor's own services (to
  //    build + validate the scope selector), the catalog (plan price), funnel
  //    totals, and demand radar. Runs in ONE parallel batch (no per-fetch
  //    waterfall). We must know the vendor's own services before we can validate
  //    a ?service param, so the SEGMENTABLE readers (attribution windows +
  //    monthly/daily chart series + null-service footnote counts) run in Batch B
  //    below — a second parallel batch, not a chain.
  const [
    statsRes,
    services,
    vendorCatalog,
    funnelTotals,
    demandRadar,
  ] = await Promise.all([
    supabase
      .from('vendor_activity_stats')
      .select(
        'quality_score, response_rate_pct, booking_completion_rate_pct, profile_completeness_pct, review_avg_bayesian, review_count, inquiry_to_booking_pct, finalized_booking_count, avg_response_minutes',
      )
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle(),
    fetchVendorServices(supabase, profile.vendor_profile_id).catch(() => []),
    fetchV2VendorCatalog().catch(() => []),
    fetchVendorFunnelTotals(supabase, profile.vendor_profile_id, isoDaysAgo(365)),
    getVendorDemandRadar(supabase, profile.vendor_profile_id),
  ]);

  const statsRow = statsRes.data;
  const health = buildVendorHealthComposite(
    (statsRow as VendorHealthInputs | null) ?? null,
  );
  const growthRecs = buildGrowthRecs((statsRow as GrowthRecStats | null) ?? null);

  // month-over-month composite delta — no historical snapshot table exists yet,
  // so there is no prior composite to diff against. Rather than invent a number,
  // the delta is left null (the card omits the "+N this month" chip).
  const monthDelta: number | null = null;

  // ── Service scope. Only ACTIVE services are selectable (a retired/inactive or
  //    deleted service must fall back to All silently). The selector shows only
  //    with 2+ active services — a single/zero-service vendor has nothing to
  //    segment by. Validate ?service against the vendor's OWN active services:
  //    a spoofed / non-owned / inactive / deleted id resolves to null (All), no
  //    redirect or 404. Segmentation itself is Pro+ (a Solo vendor sees the
  //    shop-level cards only), so the selector is gated to canAdvanced.
  const activeServices = services.filter((s) => s.is_active);
  const showSelector = canAdvanced && activeServices.length >= 2;
  const serviceId =
    showSelector &&
    search.service &&
    activeServices.some((s) => s.vendor_service_id === search.service)
      ? search.service
      : null;
  const scopeLabel = scopeLabelFor(activeServices, serviceId);

  // ── Batch B — the SEGMENTABLE readers, now that serviceId is validated. When
  //    a service is selected, the attribution windows + monthly chart series +
  //    daily chart series filter to that service (real data, via
  //    event_vendors.service_id). When serviceId is null they behave exactly as
  //    before (shop-level). The null-service booked COUNTS run ONLY when a
  //    service is selected — each is a direct count of bookings with
  //    service_id IS NULL in that window (NOT shopTotal − thisService, which
  //    would misattribute OTHER services' bookings), for the honest
  //    "Excludes N bookings not tied to a specific service" footnotes.
  const [
    attributionYear,
    attributionMonth,
    attributionDay,
    bookingSeries,
    bookingDailySeries,
    // True count of service_id IS NULL bookings per window — only fetched when a
    // service is selected, so the footnote counts ONLY genuinely service-less
    // bookings.
    nullExcludedYear,
    nullExcludedMonth,
    nullExcludedDay,
  ] = await Promise.all([
    fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(365), serviceId),
    fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(28), serviceId),
    fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(30), serviceId),
    fetchVendorBookingSeries(supabase, profile.vendor_profile_id, 12, serviceId),
    fetchVendorBookingDailySeries(supabase, profile.vendor_profile_id, 30, serviceId),
    serviceId
      ? fetchNullServiceBookedCount(supabase, profile.vendor_profile_id, isoDaysAgo(365))
      : Promise.resolve(null),
    serviceId
      ? fetchNullServiceBookedCount(supabase, profile.vendor_profile_id, isoDaysAgo(28))
      : Promise.resolve(null),
    serviceId
      ? fetchNullServiceBookedCount(supabase, profile.vendor_profile_id, isoDaysAgo(30))
      : Promise.resolve(null),
  ]);

  const funnelSteps = buildFunnelSteps(funnelTotals);

  // Per-service BOOKED count for the funnel callout — the ONLY funnel stage that
  // can segment (views/inquiries/quotes have no service_id). Shop-level funnel
  // bars are unchanged; this drives the "Bookings for {service}: N" note.
  const serviceBookedCount = serviceId
    ? await fetchServiceBookedCount(
        supabase,
        profile.vendor_profile_id,
        isoDaysAgo(365),
        serviceId,
      )
    : null;

  // The vendor's own annual plan cost — DB-catalog-authoritative, keyed off the
  // vendor's current tier. Falls back to the shipped tier-price constant only if
  // the catalog lacks the row (mirrors the subscription page's dual source).
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
  const dayWindow: MomentumWindow = {
    bookings: attributionDay?.totalBookings ?? 0,
    earningsPhp: attributionDay?.totalRevenuePhp ?? 0,
    pricedCount: attributionDay?.totalPriced ?? 0,
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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

        {/* Per-service scope — only with 2+ active services (Pro+). Segments the
            bookings-derived cards; shop-level cards wear an "across all services"
            note when a service is picked. Preserves the momentum window. */}
        {showSelector ? (
          <ServiceScopeSelector
            activeServices={activeServices}
            activeServiceId={serviceId}
            momentum={momentumMode}
          />
        ) : null}
      </header>

      {/* ── Overview (Solo+) · the signature health card + growth tips. These
          are SHOP-LEVEL by design (built from activity-stats + growth rules that
          have no per-service dimension), so they wear an "across all services"
          note when a service is selected — the honest contract. */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Overview</SectionHeading>
          {serviceId ? <ScopeNote /> : null}
        </div>
        <HealthCompositeCard health={health} monthDelta={monthDelta} />
        <GrowthRecsCard recs={growthRecs} />
      </div>

      {/* ── Your business · Momentum (basic Solo / full Pro+) + ROI + Funnel.
          Momentum + ROI SEGMENT on real booked data when a service is selected
          (via event_vendors.service_id); the daily, monthly, and annual charts
          all filter to that service too, so the whole card is per-service and
          honest. */}
      <div className="space-y-6">
        <SectionHeading>Your business</SectionHeading>

        <MomentumCard
          mode={momentumMode}
          variant={canAdvanced ? 'full' : 'basic'}
          day={dayWindow}
          month={monthWindow}
          year={yearWindow}
          monthlySeries={bookingSeries}
          dailySeries={bookingDailySeries}
          serviceId={serviceId}
          scopeLabel={scopeLabel}
          nullServiceExcluded={
            // Match the footnote to the ACTIVE window. Each window has its own
            // true null-service count (bookings with service_id IS NULL in that
            // window), so Daily now shows the footnote too.
            momentumMode === 'year'
              ? nullExcludedYear
              : momentumMode === 'month'
                ? nullExcludedMonth
                : nullExcludedDay
          }
        />

        {canAdvanced ? (
          <>
            {/* Setnayan vs your own book — app-vs-import ROI (year window). */}
            <RoiAttributionCard
              attribution={attributionYear}
              annualPlanPhp={annualPlanPhp}
              windowLabel="this year"
              scopeLabel={scopeLabel}
              nullServiceExcluded={nullExcludedYear}
            />
            {/* Where bookings come from — inline funnel bars (→ full /funnel).
                Only the BOOKED stage can segment; when a service is selected we
                show its booked count as a callout and note the other stages are
                shop-wide (the honest contract). */}
            {serviceId ? (
              <div
                className="rounded-lg border p-4 text-sm"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
              >
                <p style={{ color: 'var(--m-ink)' }}>
                  <span className="font-semibold">
                    Bookings for {scopeLabel}:
                  </span>{' '}
                  <span className="tabular-nums">{serviceBookedCount ?? 0}</span>{' '}
                  this year.
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                  Views, inquiries, and quotes below are shop-wide — they aren&rsquo;t
                  tracked per service.
                </p>
              </div>
            ) : null}
            <FunnelPreviewCard steps={funnelSteps} windowLabel="this year" />
          </>
        ) : (
          <VendorTierTeaser
            feature="ROI & booking funnel"
            requiredTier="pro"
            blurb="See how much business Setnayan sourced vs your own book, plus your views → inquiries → quotes → booked funnel. Full analytics come with Pro."
            icon={<TrendingUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          />
        )}
      </div>

      {/* ── Market intelligence (Enterprise) · cross-business, de-identified.
          Demand Radar is a cross-market signal with no per-service dimension —
          shop-level by design, so it wears the note when a service is picked. */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Market intelligence</SectionHeading>
          {serviceId && canMarket ? <ScopeNote /> : null}
        </div>
        {canMarket ? (
          <DemandPreviewCard radar={demandRadar} />
        ) : (
          <VendorTierTeaser
            feature="Demand Radar & Price-Position"
            requiredTier="enterprise"
            blurb="Where demand is building in your market, and how your prices sit against the field — de-identified, nationwide totals only. Market intelligence is an Enterprise feature."
            icon={<Radar aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          />
        )}
      </div>
    </section>
  );
}
