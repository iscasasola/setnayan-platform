import { after } from 'next/server';
import { Gauge, TrendingUp, Radar } from 'lucide-react';
import { replyTimeVerdict } from '@/lib/vendor-reply-time';
import { logQueryError } from '@/lib/supabase/error-detect';
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
import { quietCard, slowMonth } from '@/lib/vendor-analytics-graphs';
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
import { VendorTierGate, VendorTierTeaser } from '../../_components/tier-gate';
import { verifiedMedianEnabled } from '@/lib/verified-median-flag';
import { fetchVendorVerifiedMedian } from '@/lib/verified-median-read';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { VerifiedMedianCard } from './verified-median-card';
import { AnalyticsCarousel } from './analytics-carousel';
import { fetchVendorPricePosition, type PricePositionResult } from '@/lib/price-position';
import {
  EMPTY_FUNNEL_BENCHMARK,
  getVendorFunnelBenchmark,
  FUNNEL_BENCHMARK_UNREADABLE,
} from '@/lib/funnel-benchmark';
import { regionLabel } from '@/lib/region-source';
import { readShopTrackerFacts } from '@/lib/shop-badges.server';
import { milestoneLadder, stepName, type TrackerFacts } from '@/lib/shop-badges';
import { createAdminClient } from '@/lib/supabase/admin';
import { ratingLine, unmeasuredStats, type MeasuredStatsRow } from '@/lib/business-doing';
import { buildGrowthView, type PricePositionUnreadable } from './growth-view';
import { canUse, papersProgress } from '@/lib/locks';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots, fetchLatestApplication, type DocUploadMap } from '@/lib/vendor-verification';


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
 * 📊🎠 ONE ANALYTICS = THE SHOP CAROUSEL (owner 11 Nov 2026: *"Analytics should be the carousel."* → *"we want one long
 * carousel"* → the window *"inside each card"* → *"Sliding switch"*; DECISION_LOG 2026-11-11 🎠 · 📊✅ · 🎚✅; prototype
 * `prototypes/analytics_option_b_2026-11-11/` option 3). This is what was `/vendor-dashboard/performance` ("How is my
 * business doing"), MOVED — its reads unchanged — into a section the Shop tab streams under its cover; that address now
 * lands here (`performance/page.tsx`). It reads every graph's data for BOTH windows at once, so each card's 30 days /
 * 12 months switch swaps in place with no refetch, and hands it to `AnalyticsCarousel`.
 *
 * Was: /vendor-dashboard/performance — the "My Performance" cockpit.
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
export async function OneAnalyticsSection({
  supabase,
  userId,
  profile,
}: {
  supabase: SupabaseClient;
  userId: string;
  profile: VendorProfileRow;
}) {
  // Owner/admin only — the ROI + momentum panels surface booking revenue. On the Shop tab a team member who is not an
  // owner/admin is TOLD so (the section's own line), never shown an empty carousel.
  const role = await resolveVendorRole(supabase, userId);
  if (!canManageVendor(role)) {
    return (
      <p className="px-4 pt-5 text-[13.5px] text-ink/60" data-shop-analytics-owner-only="">
        Analytics are for the shop&rsquo;s owner and admins.
      </p>
    );
  }

  // 📊 THE BOOKED STAGE IS READ ON THE ADMIN CLIENT (audit 2026-11-10, C2). `event_vendors` has NO vendor SELECT
  // policy, so every funnel/booked reader below answered Booked = 0 on this shop's session, drawn as a real number.
  // Scoped by `profile.vendor_profile_id`, resolved above from the shop's own session — the sanctioned shape in
  // `app/vendor-dashboard/a-shop-cannot-read-its-own-booking.test.ts`, which now checks these call sites too.
  const bookingsAdmin = createAdminClient();

  // ── Tier gating (flag-dark). Resolve tier up front so a free/verified vendor
  //    short-circuits to the upsell WITHOUT running the full data batch.
  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  const gateOn = isVendorFeatureGateEnabled();

  // 🏅 The badge facts feed the reputation card's ring ("N of M events · next badge"). The badges THEMSELVES are the Shop
  // tab's own row, directly under this carousel (owner 11 Nov) — so no tracker is drawn here (no fact twice).
  const badgeFactsRead: Promise<TrackerFacts | null> = safeRead(
    readShopTrackerFacts(profile.vendor_profile_id),
    null,
    'badges',
  );

  if (gateOn && !canSeePerformanceTrends(tier)) {
    return (
      <VendorTierGate
        feature="Analytics"
        requiredTier="solo"
        blurb="See how your shop is doing — every graph, each with what we recommend you do next. Analytics starts with Solo."
        icon={<Gauge aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  // 🔒 ANALYTICS BEYOND SIMPLE COUNTS OPENS ONCE VERIFIED (Build 6 Lane I on Build 5 Lane B's shared lock; DECISION_LOG
  // 2026-11-10 "FREE (UNVERIFIED): THE LAST SEVEN"; corpus free-unverified-limits §5 "views and inquiries stay as
  // numbers"). THE RULE IS HERE, on the server: an unverified shop reads ONLY its counts (the pinned opened · asked ·
  // booked row, 30 days and 12 months) and its badges — no graph read runs — and sees the graphs as the ONE shared lock.
  if (!canUse('analytics', { verified: profile.public_visibility === 'verified', tier }).ok) {
    const [countsNow, countsYear, papers] = await Promise.all([
      fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(30)).catch(() => ({ totals: null, error: null })),
      fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(365)).catch(() => ({ totals: null, error: null })),
      fetchLatestApplication(supabase, profile.vendor_profile_id)
        .then((a) => ({ done: countCompleteRequiredSlots((a?.doc_uploads ?? {}) as DocUploadMap), of: REQUIRED_DOC_COUNT }))
        .catch((err: unknown) => {
          logQueryError('OneAnalytics.lockedPapers', err, { vendorProfileId: profile.vendor_profile_id });
          return null;
        }),
    ]);
    // The counts stay numbers (Opened · Asked · Booked, each with its window switch); every graph is ONE locked card.
    return <AnalyticsCarousel locked={{ progress: papersProgress(papers), totals: { '30': countsNow.totals, '12': countsYear.totals } }} />;
  }

  // 📌 v13: the pinned row's three figures — the last 30 days and the 60, read with the HONEST reader (`totals: null`
  // on a refusal, never zeros), so "the 30 days before" is the difference and an unread window says "—". Started here,
  // awaited after Batch A — they run beside it. After the upsell's return, so a plan without the funnel reads none of it.
  // 🌱 Analytics, growing (owner-approved 6 Nov 2026): the 12-month figures are read the SAME honest way, so the pinned
  // row, the sentence and the funnel follow the ONE window — the old 365-day read folded a refusal into zeros.
  const pinNowRead = fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(30)).catch(() => ({ totals: null, error: null }));
  const pinYearRead = fetchVendorFunnelTotalsResult(bookingsAdmin, profile.vendor_profile_id, isoDaysAgo(365)).catch(() => ({ totals: null, error: null }));

  const canAdvanced = !gateOn || canSeePerformanceAdvanced(tier); // Pro+
  const canMarket = !gateOn || canSeeMarketIntel(tier); // Pro-and-up (2026-07-11)

  // 🪟 THE ONE WINDOW (owner-approved 6 Nov 2026): Last 30 days · Last 12 months. `?momentum=year` (the old picker's
  // links, the service scope's hrefs) still lands on 12 months.
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
  const [pinNow, pinYear] = await Promise.all([pinNowRead, pinYearRead]);

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
  // The five new rules read only what their graph shows (a null graph fires nothing). "Run an offer on <card>" reads
  // the card opens (`service_card_opens`, Build 6 Lane I) — unread opens fire nothing, never a guessed open.
  const newGraphs = await newGraphsRead;
  const recOptsFor = (w: GrowthWindow) => {
    const g = newGraphs[w];
    const slow = g.slow ? slowMonth(g.slow) : null;
    const quiet = quietCard(g.cardsell);
    return {
      lostDates: g.lost ? { closed: g.lost.closed, full: g.lost.full } : null,
      quietCard: quiet ? { serviceId: quiet.serviceId, name: quiet.name } : null,
      slowMonth: slow ? { name: slow.name, lastDay: slow.lastDay, serviceId: graphCards[0]?.serviceId ?? null } : null,
      expiredQuotes: g.quotes ? g.quotes.expired : null,
    };
  };
  const growthRecs = buildGrowthRecs(recStats, { askedInWindow: pinNow.totals ? pinNow.totals.inquiries : null, ...recOptsFor('30') });
  const growthRecsYear = buildGrowthRecs(recStats, { askedInWindow: pinYear.totals ? pinYear.totals.inquiries : null, ...recOptsFor('12') });
  // 🤝 The "Link up" card lands on the served-with list (owner 2026-11-06) — with nobody on it, it does not fire.
  // Read only when the card would show, in either window.
  const servedWith = [...growthRecs, ...growthRecsYear].some((r) => r.key === 'build_partnerships')
    ? await readPartnersYouServedWith(supabase, profile.vendor_profile_id)
    : null;
  const eligiblePartners = servedWith === null ? null : servedWith.measured ? proposableShops(servedWith).length : null;
  const shownGrowthRecs = withoutPartnershipRecWhenNobodyToLink(growthRecs, eligiblePartners);
  const shownGrowthRecsYear = withoutPartnershipRecWhenNobodyToLink(growthRecsYear, eligiblePartners);

  // Every card reads the WHOLE shop (the per-service ▾ of the old page has no place on a carousel card).
  const serviceId: string | null = null;

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
    totalsBefore30: null,
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
    <>
      <AnalyticsCarousel view={growthView} graphs={newGraphs} />
      {verifiedMedian ? (
        <div className="px-4 pt-4">
          <VerifiedMedianCard data={verifiedMedian} />
        </div>
      ) : null}
      {/* Tier teasers — only while the plan gate is ON and the shop is below the plan (flag-dark today). */}
      {!canAdvanced ? (
        <div className="px-4 pt-4">
          <VendorTierTeaser
            feature="ROI & booking funnel"
            requiredTier="pro"
            blurb="See how much business Setnayan sourced vs your own book, plus your views → inquiries → quotes → booked funnel. Full analytics come with Pro."
            icon={<TrendingUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          />
        </div>
      ) : null}
      {canMarket ? null : (
        <div className="px-4 pt-4">
          <VendorTierTeaser
            feature="Demand Radar & Price-Position"
            requiredTier="pro"
            blurb="Where demand is building in your market, and how your prices sit against the field — de-identified, nationwide totals only. Market intelligence is a Pro feature."
            icon={<Radar aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          />
        </div>
      )}
    </>
  );
}
