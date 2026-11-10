import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { Gauge, TrendingUp, Radar } from 'lucide-react';
import { replyTimeVerdict } from '@/lib/vendor-reply-time';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  buildVendorHealthComposite,
  unmeasuredVendorHealthComposite,
  type VendorHealthInputs,
} from '@/lib/vendor-health-composite';
import {
  buildGrowthRecs,
  withoutPartnershipRecWhenNobodyToLink,
  type GrowthRecStats,
} from '@/lib/vendor-growth-recs';
import { proposableShops, readPartnersYouServedWith } from '@/lib/partners-you-served-with.server';
import { fetchVendorSourceAttribution } from '@/lib/vendor-source-attribution';
import {
  fetchVendorBookingSeries,
  fetchVendorBookingDailySeries,
} from '@/lib/vendor-booking-series';
import {
  fetchVendorFunnelTotalsResult,
  fetchBookedBySource,
  fetchViewsBySource,
  fetchInquiriesBySource,
  type SourceSlice,
} from '@/lib/vendor-funnel';
import {
  fetchInquiriesSeries,
  fetchUpcomingBookedDays,
  fetchViewsSeries,
  type SeriesClient,
} from '@/lib/vendor-growth-series';
import type { GrowthWindow } from '@/lib/analytics-growing';
import {
  getVendorDemandRadar,
  maybeRefreshDemandRadar,
  EMPTY_RADAR,
  DEMAND_RADAR_UNREADABLE,
} from '@/lib/demand-radar';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchVendorServices } from '@/lib/vendor-services';
import { readNewGraphs } from '@/lib/vendor-analytics-graphs.server';
import { slowMonth } from '@/lib/vendor-analytics-graphs';
import { displayServiceLabel } from '@/lib/vendors';
import { fetchVendorInquiryAnalytics } from '@/lib/vendor-inquiry-analytics';
import { fetchVendorConversionAnalytics } from '@/lib/vendor-conversion-analytics';
import { fetchVendorReputationAnalytics } from '@/lib/vendor-reputation-analytics';
import { fetchVendorCapacityAnalytics } from '@/lib/vendor-capacity-analytics';
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
import { ShopSegments } from '../shop/_components/shop-segments';
import { analyticsFigures } from '@/lib/shop-section-figures';
import { verifiedMedianEnabled } from '@/lib/verified-median-flag';
import { fetchVendorVerifiedMedian } from '@/lib/verified-median-read';
import { VerifiedMedianCard } from './_components/verified-median-card';
import { fetchVendorPricePosition, type PricePositionResult } from '@/lib/price-position';
import {
  EMPTY_FUNNEL_BENCHMARK,
  getVendorFunnelBenchmark,
  FUNNEL_BENCHMARK_UNREADABLE,
} from '@/lib/funnel-benchmark';
import { regionLabel } from '@/lib/region-source';
import { ServiceScopeSelector } from './_components/service-scope-selector';
import { YourBadges } from './_components/your-badges';
import { readShopTrackerFacts } from '@/lib/shop-badges.server';
import { badgeShelf, badgeTracker, milestoneLadder, stepName, type TrackerFacts, type TrackerRow } from '@/lib/shop-badges';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBadgeRewardTracker } from '@/lib/badge-rewards.server';
import { BadgeRewardSweep } from '../_components/badge-reward-sweep';
import { badgeRowsWithRewards, type TrackerRewardInput } from '@/lib/badge-rewards';
import { ratingLine, unmeasuredStats, type MeasuredStatsRow } from '@/lib/business-doing';
import { GrowthWindowScope } from '../_components/growth-window';
import { AnalyticsGrowing } from './_components/analytics-growing';
import { buildGrowthView, type PricePositionUnreadable } from './_components/growth-view';
import { shopGearBody } from '../shop/_components/shop-settings-body';

export const metadata = { title: 'How is my business doing · Supplier' };

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/**
 * FAULT ISOLATION (2026-07-02 · fixes the whole-cockpit crash behind the
 * /vendor-dashboard error boundary).
 *
 * My Performance fans ~15 analytics reads across two Promise.all batches. Each
 * card is INDEPENDENTLY designed to degrade to an empty state, and the readers
 * already handle a PostgREST `.error` gracefully (return null / [] / empty). But
 * a reader that *rejects* — a transient network blip, a cold-start hiccup, a
 * statement-timeout surfacing as a thrown fetch — rejects the entire
 * `Promise.all`, blanking the WHOLE surface into the segment error boundary
 * ("Your shop console is temporarily unavailable") even though every other card
 * had data. Two readers (services + catalog) already guarded themselves with
 * `.catch(fallback)`; this makes ALL of them do so, uniformly.
 *
 * `Promise.resolve()` first so this also adopts the raw PostgREST query builders
 * (which are thenable but have no `.catch` of their own). A failed reader logs
 * (Sentry still captures via the global handler) and yields the SAME fallback it
 * would return on a `.error`, so one reader failing now costs one empty card,
 * never the whole cockpit.
 */
/** The `vendor_activity_stats` columns this page selects. */
type ActivityStatsRow = VendorHealthInputs & {
  avg_response_minutes: number | null;
  replied_thread_count: number | null;
  last_active_at: string | null;
};

function safeRead<T>(p: PromiseLike<T>, fallback: T, label: string): Promise<T> {
  return Promise.resolve(p).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[my-performance] reader "${label}" failed; using fallback`, err);
    return fallback;
  });
}

/**
 * /vendor-dashboard/performance — the "My Performance" cockpit.
 *
 * TIERED (owner 2026-07-01, "apply this to our live website"; Market Intel moved
 * to Pro-and-up 2026-07-11):
 *   • Solo   — own-shop glance: Health composite · Grow recs · basic Momentum
 *              (count, Monthly/Annual). variant='basic'.
 *   • Pro    — full own-business analytics: + revenue & Daily Momentum · ROI
 *              (Setnayan vs your book) · booking Funnel · cross-business MARKET
 *              INTEL (Demand Radar · Price-Position), de-identified + min-N.
 *   • Enter. — same Market Intel surface, at nationwide scale.
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
export default async function PerformanceHome({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = {
    momentum: typeof sp.momentum === 'string' ? sp.momentum : undefined,
    service: typeof sp.service === 'string' ? sp.service : undefined,
  };
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

  // 📊 THE BOOKED STAGE IS READ ON THE ADMIN CLIENT (audit 2026-11-10, C2). `event_vendors` has NO vendor SELECT
  // policy, so every funnel/booked reader below answered Booked = 0 on this shop's session, drawn as a real number.
  // Scoped by `profile.vendor_profile_id`, resolved above from the shop's own session — the sanctioned shape in
  // `app/vendor-dashboard/a-shop-cannot-read-its-own-booking.test.ts`, which now checks these call sites too.
  const bookingsAdmin = createAdminClient();

  // ── Tier gating (flag-dark). Resolve tier up front so a free/verified vendor
  //    short-circuits to the upsell WITHOUT running the full data batch.
  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  const gateOn = isVendorFeatureGateEnabled();

  // 🏅 THE SHOP'S BADGES (owner 2026-10-29: "Their badges will be on the supplier shop performance page") — every
  // tier, the upsell included. Started HERE so it rides beside Batch A (below) rather than adding a round trip; a
  // refused read is `null` → "Couldn’t load your badges" · "—", never "none" (`badgeShelf`).
  // 📣🗺 The one badge TRACKER lives here too (owner 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL") — the tracker's facts
  // are the badge facts plus the couples not yet asked for a review, read in the same call.
  const badgeFactsRead: Promise<TrackerFacts | null> = safeRead(
    readShopTrackerFacts(profile.vendor_profile_id),
    null,
    'badges',
  );
  // 🎁 …and each badge's reward + 4-week upgrade (owner 2026-11-05 · table approved 2026-11-06): READ only — this render
  // never pays (8 Nov release gate); `<BadgeRewardSweep />` asks the paying door after the page draws and redraws once
  // if it paid. Chained on the facts (no extra wait beside Batch A). A failure leaves the rows without reward lines.
  const badgeRewardsRead: Promise<TrackerRewardInput | null> = badgeFactsRead.then((facts) =>
    facts
      ? readBadgeRewardTracker(createAdminClient(), profile.vendor_profile_id, facts).catch((err: unknown) => {
          logQueryError('PerformancePage.badgeRewards', err, { vendorProfileId: profile.vendor_profile_id });
          return null;
        })
      : null,
  );
  const trackerRows = (facts: TrackerFacts | null, rewards: TrackerRewardInput | null): TrackerRow[] | null =>
    facts ? (rewards ? badgeRowsWithRewards(badgeTracker(facts), rewards) : badgeTracker(facts)) : null;

  if (gateOn && !canSeePerformanceTrends(tier)) {
    const [gatedFacts, gatedRewards] = await Promise.all([badgeFactsRead, badgeRewardsRead]);
    const gatedShelf = badgeShelf(gatedFacts);
    return (
      <>
        {/* Shop › Analytics (was "How it is going") — the segment stays on the upsell too, so a
            supplier who tapped it from Shop can tap back (owner "Yes to all",
            2026-10-21, item 2). */}
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
          <ShopSegments on="insights" gearBody={shopGearBody(sp)} />
          {/* 🎁 Pays a newly earned badge's reward after the page draws — the render only reads (8 Nov). */}
          <BadgeRewardSweep />
          <div className="mt-6">
            <YourBadges shelf={gatedShelf} rows={trackerRows(gatedFacts, gatedRewards)} />
          </div>
        </div>
      <VendorTierGate
        feature="My Performance"
        requiredTier="solo"
        blurb="See how your shop is doing — a business-health snapshot, growth tips, and your booking momentum. My Performance starts with Solo."
        icon={<Gauge aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
      </>
    );
  }

  // 📌 v13: the pinned row's three figures — the last 30 days and the 60, read with the HONEST reader (`totals: null`
  // on a refusal, never zeros), so "the 30 days before" is the difference and an unread window says "—". Started here,
  // awaited after Batch A — they run beside it. After the upsell's return, so a plan without the funnel reads none of it.
  // 🌱 Analytics, growing (owner-approved 6 Nov 2026): the 12-month figures are read the SAME honest way, so the pinned
  // row, the sentence and the funnel follow the ONE window — the old 365-day read folded a refusal into zeros.
  const pinNowRead = fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(30)).catch(() => ({ totals: null, error: null }));
  const pinSince60Read = fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(60)).catch(() => ({ totals: null, error: null }));
  const pinYearRead = fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(365)).catch(() => ({ totals: null, error: null }));

  const canAdvanced = !gateOn || canSeePerformanceAdvanced(tier); // Pro+
  const canMarket = !gateOn || canSeeMarketIntel(tier); // Pro-and-up (2026-07-11)

  // 🪟 THE ONE WINDOW (owner-approved 6 Nov 2026): Last 30 days · Last 12 months. `?momentum=year` (the old picker's
  // links, the service scope's hrefs) still lands on 12 months.
  const initialWindow: GrowthWindow = search.momentum === 'year' ? '12' : '30';
  const nowMs = Date.now();

  // ── Batch A — everything that does NOT depend on the chosen service scope: the activity-stats row (health + growth),
  //    the vendor's own services (to build + validate the scope selector), the catalog (plan price), the radar and the
  //    benchmark, the 12-month inquiry + conversion analytics, the by-source slices for BOTH windows, the price meter,
  //    the lanes' two new series and the next 13 weeks' booked dates. ONE parallel batch (no per-fetch waterfall).
  //    The 28-day reads are retired with the "Monthly" picker (the window is 30 days or 12 months).
  const [
    statsRead,
    services,
    vendorCatalog,
    demandRadarRead,
    funnelBenchmarkRead,
    inquiryAnalytics,
    conversionAnalytics,
    bookedBySourceYear,
    viewsBySourceYear,
    bookedBySourceDay,
    viewsBySourceDay,
    inquiriesBySourceYear,
    inquiriesBySourceDay,
    marketRegionRow,
    pricePosition,
    viewsSeries,
    inquiriesSeries,
    upcomingBooked,
    badgeFacts,
  ] = await Promise.all([
    safeRead(
      supabase
        .from('vendor_activity_stats')
        .select(
          // ⚠ `replied_thread_count` and `last_active_at` are what turn a median into
        // a CLAIM — the sample floor and the recency test both live in
        // `lib/vendor-reply-time.ts`, and a select that omits either would make
        // this page explain a different rule from the one the public card obeys.
        // Both columns exist in production and carry table-wide SELECT grants
        // (checked before adding them: `vendor_activity_stats` has no per-column
        // allowlist, so naming them cannot make PostgREST refuse the whole read).
        'quality_score, response_rate_pct, booking_completion_rate_pct, profile_completeness_pct, review_avg_bayesian, review_count, inquiry_to_booking_pct, finalized_booking_count, avg_response_minutes, replied_thread_count, last_active_at',
        )
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle()
        // 🆕 A NEW SHOP HAS NO ROW — and that is not a failure. `.then((r) => r.data)` used to fold a REFUSED
        // read (`error` set) and a MISSING row into the same `null`, so a brand-new shop was told "Couldn’t
        // load" (SetnaProd, 6 Nov). Keep them apart: an error → `measured: false`; no row → `row: null`.
        .then(({ data, error }): MeasuredStatsRow<ActivityStatsRow> => {
          if (error) {
            logQueryError('vendor-dashboard/performance/page.tsx: vendor_activity_stats', error, {
              vendor_profile_id: profile.vendor_profile_id,
            });
            return unmeasuredStats<ActivityStatsRow>();
          }
          return { measured: true, row: (data ?? null) as ActivityStatsRow | null };
        }),
      unmeasuredStats<ActivityStatsRow>(),
      'activity_stats',
    ),
    safeRead(fetchVendorServices(supabase, profile.vendor_profile_id), [], 'services'),
    safeRead(fetchV2VendorCatalog(), [], 'catalog'),
    safeRead(
      getVendorDemandRadar(supabase, profile.vendor_profile_id),
      EMPTY_RADAR,
      'demand_radar',
    ),
    /* 🔴 THE FIRST READER THIS MODULE HAS EVER HAD. `lib/funnel-benchmark.ts`
       shipped with the SQL bands, the min-N privacy floor and the percentile
       math — and ZERO importers, so no vendor could reach any of it. Read on the
       SAME Pro-and-up section as the radar (its own docblock's stated gate), and
       through safeRead so a metering hiccup lands on the honest suppressed card
       rather than taking the page down. */
    canMarket
      ? safeRead(
          getVendorFunnelBenchmark(supabase, profile.vendor_profile_id),
          EMPTY_FUNNEL_BENCHMARK,
          'funnel_benchmark',
        )
      : Promise.resolve(EMPTY_FUNNEL_BENCHMARK),
    // Inquiry-handling + conversion analytics — shop-level, Pro+ (own-business), 12 months.
    // Skip the RPCs entirely for tiers that won't render the sections.
    canAdvanced
      ? safeRead(
          fetchVendorInquiryAnalytics(supabase, profile.vendor_profile_id, isoDaysAgo(365)),
          null,
          'inquiry_analytics',
        )
      : Promise.resolve(null),
    canAdvanced
      ? safeRead(
          fetchVendorConversionAnalytics(supabase, profile.vendor_profile_id, isoDaysAgo(365)),
          null,
          'conversion_analytics',
        )
      : Promise.resolve(null),
    // Booked / views / inquiries sliced by source, for BOTH windows (365 d · 30 d), so the window ▾ swaps them
    // INSTANTLY client-side (no refetch). Shop-level (views/inquiries/quotes carry no service_id). Pro+ only.
    // A REJECTED read is `null` ("Couldn’t load"), never `[]` ("none yet").
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchBookedBySource(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(365)), null, 'booked_by_source_year')
      : Promise.resolve([]),
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchViewsBySource(supabase, profile.vendor_profile_id, isoDaysAgo(365)), null, 'views_by_source_year')
      : Promise.resolve([]),
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchBookedBySource(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(30)), null, 'booked_by_source_day')
      : Promise.resolve([]),
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchViewsBySource(supabase, profile.vendor_profile_id, isoDaysAgo(30)), null, 'views_by_source_day')
      : Promise.resolve([]),
    // Inquiries by source (Creator Economy PR-C — the owner's inquiry-source
    // taxonomy on chat_threads). NULL folds into 'website'.
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchInquiriesBySource(supabase, profile.vendor_profile_id, isoDaysAgo(365)), null, 'inquiries_by_source_year')
      : Promise.resolve([]),
    canAdvanced
      ? safeRead<SourceSlice[] | null>(fetchInquiriesBySource(supabase, profile.vendor_profile_id, isoDaysAgo(30)), null, 'inquiries_by_source_day')
      : Promise.resolve([]),
    // HQ region → market label for the Demand Radar and the price rail.
    canMarket
      ? safeRead(
          supabase
            .from('vendor_profiles')
            .select('hq_region')
            .eq('vendor_profile_id', profile.vendor_profile_id)
            .maybeSingle()
            .then((r) => r.data),
          null,
          'market_region',
        )
      : Promise.resolve(null),
    /* The Price-Position meter this section's teaser has always promised (S34).
       The fetcher THROWS on a failed read, and safeRead turns that into
       'unreadable' — never into 'no_data', which would tell a vendor their
       market is empty when we simply could not read it. */
    canMarket
      ? safeRead<PricePositionResult | PricePositionUnreadable | null>(
          fetchVendorPricePosition(profile),
          { status: 'unreadable' },
          'price_position',
        )
      : Promise.resolve(null),
    // 📈 The lanes' two new series (lib/vendor-growth-series.ts) — views and inquiries per Manila day (30) and month
    // (12), one paged read each; a refusal is `null` and the lane says "Couldn’t load".
    safeRead(fetchViewsSeries(supabase as unknown as SeriesClient, profile.vendor_profile_id, nowMs), null, 'views_series'),
    safeRead(fetchInquiriesSeries(supabase as unknown as SeriesClient, profile.vendor_profile_id, nowMs), null, 'inquiries_series'),
    // 📅 §4's strip — the next 13 weeks' live booked dates (the rows `vendor_upcoming_load` counts).
    canAdvanced
      ? safeRead(fetchUpcomingBookedDays(supabase as unknown as SeriesClient, profile.vendor_profile_id, nowMs), null, 'upcoming_booked_days')
      : Promise.resolve(null),
    // 🏅 The badges, started above — awaited in this same batch (no extra round trip).
    badgeFactsRead,
  ]);
  // 📈 The five new graphs (Build 6 Lane I — lost dates · which card sells · reply speed vs bookings · slow months ·
  // quotes waiting), started the moment the shop's cards are known and awaited at the recommendations below, so they
  // ride beside the pins and the partnership count. Each refusal is its own `null` ("Couldn’t load"), never a zero.
  // `event_vendors` (cardsell + replyvs) on `bookingsAdmin` — it has no vendor SELECT policy (see above).
  const graphCards = services
    .filter((s) => s.is_active)
    .map((s) => ({ serviceId: s.vendor_service_id, name: s.title?.trim() || displayServiceLabel(s.category) }));
  const newGraphsRead = readNewGraphs({
    session: supabase,
    admin: bookingsAdmin,
    vendorProfileId: profile.vendor_profile_id,
    cards: graphCards,
    nowMs,
  });
  // Started before Batch A (beside the badges), so this wait costs no extra round trip.
  const [pinNow, pinSince60, pinYear] = await Promise.all([pinNowRead, pinSince60Read, pinYearRead]);
  const totalsBefore30 =
    pinNow.totals && pinSince60.totals
      ? {
          views: pinSince60.totals.views - pinNow.totals.views,
          inquiries: pinSince60.totals.inquiries - pinNow.totals.inquiries,
          quotes: pinSince60.totals.quotes - pinNow.totals.quotes,
          booked: pinSince60.totals.booked - pinNow.totals.booked,
        }
      : null;
  const pinFigures = analyticsFigures(pinNow.totals, totalsBefore30);
  // 12 months: the change word is blank — no 24-month read exists, so there is no "before" to compare against.
  const pinFiguresYear = analyticsFigures(pinYear.totals, null);
  const shelf = badgeShelf(badgeFacts);
  const badgeRows = trackerRows(badgeFacts, await badgeRewardsRead);

  const hqRegion =
    (marketRegionRow as { hq_region?: string | null } | null)?.hq_region ?? null;
  const marketLabel = hqRegion ? regionLabel(hqRegion) ?? hqRegion : null;

  // A REFUSED radar read must not read as "not enough demand data yet" — that
  // is what a genuinely below-floor market ALSO shows (lib/demand-radar.ts).
  const demandRadarUnreadable = demandRadarRead === DEMAND_RADAR_UNREADABLE;
  const demandRadar = demandRadarUnreadable ? EMPTY_RADAR : demandRadarRead;

  // Same shape for the benchmark card (lib/funnel-benchmark.ts).
  const funnelBenchmarkUnreadable = funnelBenchmarkRead === FUNNEL_BENCHMARK_UNREADABLE;
  const funnelBenchmark = funnelBenchmarkUnreadable ? EMPTY_FUNNEL_BENCHMARK : funnelBenchmarkRead;

  // Cron-free, throttled opportunistic rebuild after the response flushes —
  // preserved from the retired /demand fold so the radar keeps refreshing on
  // vendor traffic, not only admin visits.
  if (canMarket) {
    after(async () => {
      await maybeRefreshDemandRadar();
    });
  }

  // The row itself — `null` for BOTH a new shop and a refused read, so every consumer below that states
  // something about the shop's data branches on `statsRead.measured` first (refused → "Couldn’t load";
  // no row → its new-shop empty state). Growth recs need no branch: with no row they fall back to the
  // universal starter set, which states no figure about the shop, so it is honest either way.
  const statsRow = statsRead.row;
  const health = statsRead.measured
    ? buildVendorHealthComposite((statsRow as VendorHealthInputs | null) ?? null)
    : unmeasuredVendorHealthComposite();
  // Live partnerships, either direction — so the "link up" card stops being
  // shown to a vendor who has already built their circle. Fail-soft to 0: a
  // failed count would otherwise read as "none" and nag someone who has ten.
  // (0 with a read error is the same value as 0 with none — so on error we
  // suppress the card instead, by reporting a count above the threshold.)
  const { count: partnershipCount, error: partnershipErr } = await supabase
    .from('vendor_partnerships')
    .select('id', { count: 'exact', head: true })
    .or(
      `recommending_vendor_id.eq.${profile.vendor_profile_id},recommended_vendor_id.eq.${profile.vendor_profile_id}`,
    )
    .eq('status', 'accepted')
    .eq('is_active', true);
  if (partnershipErr) {
    logQueryError('vendor-dashboard/performance/page.tsx: vendor_partnerships count', partnershipErr, {
      vendor_profile_id: profile.vendor_profile_id,
    });
  }

  // ⏭ DO NEXT (owner-approved 6 Nov 2026): the shipped rules, per window — reply advice only once a couple has asked IN
  // THAT WINDOW (the pinned row's "asked"); an unread count gives no reply advice either (lib/vendor-growth-recs.ts).
  const recStats: GrowthRecStats | null = statsRow
    ? {
        ...(statsRow as Omit<GrowthRecStats, 'partnership_count'>),
        partnership_count: partnershipErr ? 99 : (partnershipCount ?? 0),
      }
    : null;
  // The five new rules read only what their graph shows (a null graph fires nothing). No table records which card a
  // couple OPENED, so `quietCard` is never passed and "Run an offer on <card>" stays silent — never a guessed open.
  const newGraphs = await newGraphsRead;
  const slow = newGraphs.slow ? slowMonth(newGraphs.slow) : null;
  const graphRecOpts = {
    lostDates: newGraphs.lost ? { closed: newGraphs.lost.closed, full: newGraphs.lost.full } : null,
    slowMonth: slow ? { name: slow.name, lastDay: slow.lastDay, serviceId: graphCards[0]?.serviceId ?? null } : null,
    expiredQuotes: newGraphs.quotes ? newGraphs.quotes.expired : null,
  };
  const growthRecs = buildGrowthRecs(recStats, { askedInWindow: pinNow.totals ? pinNow.totals.inquiries : null, ...graphRecOpts });
  const growthRecsYear = buildGrowthRecs(recStats, { askedInWindow: pinYear.totals ? pinYear.totals.inquiries : null, ...graphRecOpts });
  // 🤝 The "Link up" card lands on the served-with list (owner 2026-11-06) — with nobody on it, it does not fire.
  // Read only when the card would show, in either window.
  const servedWith = [...growthRecs, ...growthRecsYear].some((r) => r.key === 'build_partnerships')
    ? await readPartnersYouServedWith(supabase, profile.vendor_profile_id)
    : null;
  const eligiblePartners = servedWith === null ? null : servedWith.measured ? proposableShops(servedWith).length : null;
  const shownGrowthRecs = withoutPartnershipRecWhenNobodyToLink(growthRecs, eligiblePartners);
  const shownGrowthRecsYear = withoutPartnershipRecWhenNobodyToLink(growthRecsYear, eligiblePartners);

  // ── Service scope. Only ACTIVE services are selectable (a retired/inactive or
  //    deleted service must fall back to All silently). The selector shows only
  //    with 2+ active services — a single/zero-service vendor has nothing to
  //    segment by. Validate ?service against the vendor's OWN active services:
  //    a spoofed / non-owned / inactive / deleted id resolves to null (All), no
  //    redirect or 404. Segmentation itself is Pro+, so the selector is gated to
  //    canAdvanced. Only the BOOKED lane and the money segment; the funnel's other
  //    stages stay shop-wide.
  const activeServices = services.filter((s) => s.is_active);
  const showSelector = canAdvanced && activeServices.length >= 2;
  const serviceId =
    showSelector &&
    search.service &&
    activeServices.some((s) => s.vendor_service_id === search.service)
      ? search.service
      : null;

  // ── Batch B — the SEGMENTABLE readers, now that serviceId is validated: the attribution windows (money + the
  //    Setnayan / own split) and the booked lanes (daily + monthly series) filter to the selected service.
  const [
    attributionYear,
    attributionDay,
    bookingSeries,
    bookingDailySeries,
    reputationAnalytics,
    capacityAnalytics,
  ] = await Promise.all([
    safeRead(
      fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(365), serviceId),
      null,
      'attribution_year',
    ),
    safeRead(
      fetchVendorSourceAttribution(supabase, profile.vendor_profile_id, isoDaysAgo(30), serviceId),
      null,
      'attribution_day',
    ),
    safeRead(
      fetchVendorBookingSeries(supabase, profile.vendor_profile_id, 12, serviceId),
      [],
      'booking_monthly',
    ),
    safeRead(
      fetchVendorBookingDailySeries(supabase, profile.vendor_profile_id, 30, serviceId),
      [],
      'booking_daily',
    ),
    canAdvanced
      ? safeRead(
          fetchVendorReputationAnalytics(supabase, profile.vendor_profile_id),
          null,
          'reputation_analytics',
        )
      : Promise.resolve(null),
    canAdvanced
      ? safeRead(
          fetchVendorCapacityAnalytics(supabase, profile.vendor_profile_id),
          null,
          'capacity_analytics',
        )
      : Promise.resolve(null),
  ]);

  // The vendor's own annual plan cost — DB-catalog-authoritative, keyed off the
  // vendor's current tier. Falls back to the shipped tier-price constant only if
  // the catalog lacks the row (mirrors the subscription page's dual source).
  const annualSku = `${tier}_vendor_annual`;
  const catalogAnnual = vendorCatalog.find((r) => r.sku_code === annualSku)?.price_php ?? null;
  const annualPlanPhp = catalogAnnual ?? TIER_PRICE_PHP[tier].annual;

  // Verified-median pricing (dark behind NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED).
  // Off → skip the read entirely, render nothing. Computed on the full-render
  // path only (after every early return above).
  const verifiedMedian = verifiedMedianEnabled()
    ? await fetchVendorVerifiedMedian(profile.vendor_profile_id)
    : null;

  // The public reply-time claim, decided by the SAME function the marketplace
  // card calls — never a second copy of the floor, the sentinel, the four-hour
  // line or the recency test. NO ROW (a new shop) runs through the verdict's
  // own fail-closed path — "nothing shown yet", which is what a couple would in
  // fact be seeing. A REFUSED read has no verdict at all (`null`): the line and
  // the card say "Couldn’t load", never "No inquiry yet" / "0 of 3".
  const replyVerdict = statsRead.measured
    ? replyTimeVerdict({
        avgResponseMinutes: statsRow?.avg_response_minutes,
        repliedThreadCount: statsRow?.replied_thread_count,
        lastActiveAt: statsRow?.last_active_at,
        now: nowMs,
      })
    : null;

  // 🏅 The badges as §5's picture — the milestone ladder the tracker already climbs.
  const ladder = badgeFacts && badgeFacts.completedEvents !== null ? milestoneLadder(badgeFacts.completedEvents) : null;
  const priceKey = pricePosition && 'key' in pricePosition ? pricePosition.key : null;

  // 🌱 ANALYTICS, GROWING (owner-approved 6 Nov 2026) — every read above, worded ONCE (growth-view.ts) for the client
  // tree to draw. Nothing new is computed about the shop.
  const growthView = buildGrowthView({
    nowMs,
    totals30: pinNow.totals,
    totalsBefore30,
    totals12: pinYear.totals,
    views: viewsSeries,
    inquiries: inquiriesSeries,
    bookedDay: bookingDailySeries,
    bookedMonth: bookingSeries,
    viewsBySource: { '30': viewsBySourceDay, '12': viewsBySourceYear },
    inquiriesBySource: { '30': inquiriesBySourceDay, '12': inquiriesBySourceYear },
    bookedBySource: { '30': bookedBySourceDay, '12': bookedBySourceYear },
    attribution: { '30': attributionDay, '12': attributionYear },
    annualPlanPhp,
    recs: { '30': shownGrowthRecs, '12': shownGrowthRecsYear },
    verdict: replyVerdict,
    inquiry: inquiryAnalytics,
    conversion: conversionAnalytics,
    capacity: capacityAnalytics,
    upcoming: upcomingBooked,
    radar: demandRadarUnreadable ? null : demandRadar,
    showMarket: canMarket,
    rating: ratingLine(statsRead),
    ratingAvg: statsRow?.review_avg_bayesian ?? null,
    ratingCount: Number(statsRow?.review_count ?? 0),
    reputation: reputationAnalytics,
    badges: badgeFacts
      ? {
          verified: badgeFacts.verified,
          completedEvents: badgeFacts.completedEvents,
          earned: ladder?.earned ?? null,
          earnedName: ladder?.earned ? stepName(ladder.earned) : null,
          next: ladder?.next ?? null,
          nextName: ladder?.next ? stepName(ladder.next) : null,
        }
      : null,
    health,
    healthUnread: !statsRead.measured,
    bench: funnelBenchmark,
    benchUnread: funnelBenchmarkUnreadable,
    price: pricePosition,
    category: priceKey?.category ?? null,
    regionLabel: priceKey?.regionLabel ?? marketLabel,
    pro: gateOn && !canMarket,
  });

  return (
    <section className="mx-auto w-full max-w-6xl tab:max-w-3xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <GrowthWindowScope initial={initialWindow}>
        {/* SHOP › ANALYTICS — the third Shop segment draws the Shop switcher and its pinned row. Its three figures ARE the
            headline numbers (owner call, 6 Nov): they count, and they follow the ONE window below. */}
        <ShopSegments on="insights" figures={pinFigures} yearFigures={pinFiguresYear} gearBody={shopGearBody(sp)} />
        {/* 🎁 Pays a newly earned badge's reward after the page draws — the render only reads (8 Nov). */}
        <BadgeRewardSweep />
        <div className="mx-auto w-full max-w-xl tab:max-w-none">
          <h1 className="sn-h1">How is my business doing</h1>
          <div className="mt-2">
            <AnalyticsGrowing
              view={growthView}
              graphs={newGraphs}
              scope={
                showSelector ? (
                  <ServiceScopeSelector
                    key="scope"
                    activeServices={activeServices}
                    activeServiceId={serviceId}
                    momentum={initialWindow === '12' ? 'year' : 'day'}
                  />
                ) : null
              }
              badges={<YourBadges shelf={shelf} rows={badgeRows} />}
            />
          </div>
          {verifiedMedian ? (
            <div className="mt-8">
              <VerifiedMedianCard data={verifiedMedian} />
            </div>
          ) : null}
          {/* Tier teasers — only while the plan gate is ON and the shop is below the plan (flag-dark today, so no shop
              sees them). The sections carry ◆ on their titles then. */}
          {!canAdvanced && (
            <div className="mt-8">
              <VendorTierTeaser
                feature="ROI & booking funnel"
                requiredTier="pro"
                blurb="See how much business Setnayan sourced vs your own book, plus your views → inquiries → quotes → booked funnel. Full analytics come with Pro."
                icon={<TrendingUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              />
            </div>
          )}
          {canMarket ? null : (
            <div className="mt-8">
              <VendorTierTeaser
                feature="Demand Radar & Price-Position"
                requiredTier="pro"
                blurb="Where demand is building in your market, and how your prices sit against the field — de-identified, nationwide totals only. Market intelligence is a Pro feature."
                icon={<Radar aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              />
            </div>
          )}
        </div>
      </GrowthWindowScope>
    </section>
  );
}
