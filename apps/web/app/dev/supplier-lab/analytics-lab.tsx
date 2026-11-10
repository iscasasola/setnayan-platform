/**
 * 📈 Shop › Analytics on fixture data — "Analytics, growing" (owner-approved 6 Nov 2026). The REAL screen: the same
 * `buildGrowthView` the page calls, the same `AnalyticsGrowing` client tree, the same `ShopSegments` pinned row inside
 * the same `GrowthWindowScope` — only the reads are fixtures. The three shops are the approved prototype's own
 * (`analytics-proto/index.html` → `SETNAPROD` · `SAMPLE`) plus an empty new shop:
 *
 *   /dev/supplier-lab?s=analytics                 SetnaProd — 67 views, nothing asked, verified, no stats row
 *   /dev/supplier-lab?s=analytics&shop=sample     the sample shop — every section filled
 *   /dev/supplier-lab?s=analytics&shop=new        a brand-new shop — every empty state
 *   …&win=12                                      the 12-month window open first
 *   …&fail=1                                      every read refused — "Couldn’t load", never a zero
 *
 * Recommendations are NOT copied from the prototype: they are `buildGrowthRecs` on the fixture stats row, exactly as the
 * page computes them. No plan price is typed here — `annualPlanPhp` is null, so the "~N× your annual plan" line (12 months,
 * paid plans only) does not draw in the lab.
 */
import { GrowthWindowScope } from '@/app/vendor-dashboard/_components/growth-window';
import { ShopSegments } from '@/app/vendor-dashboard/shop/_components/shop-segments';
import { AnalyticsGrowing } from '@/app/vendor-dashboard/performance/_components/analytics-growing';
import { buildGrowthView, type GrowthInputs, type Totals } from '@/app/vendor-dashboard/performance/_components/growth-view';
import { YourBadges } from '@/app/vendor-dashboard/performance/_components/your-badges';
import { ServiceScopeSelectClient } from '@/app/vendor-dashboard/performance/_components/service-scope-select-client';
import { analyticsFigures } from '@/lib/shop-section-figures';
import { dayBuckets, monthBuckets, type GrowthWindow } from '@/lib/analytics-growing';
import { buildGrowthRecs, type GrowthRecStats } from '@/lib/vendor-growth-recs';
import { buildVendorHealthComposite, unmeasuredVendorHealthComposite, type VendorHealthComposite } from '@/lib/vendor-health-composite';
import { badgeShelf, badgeTracker, milestoneLadder, stepName, type TrackerFacts } from '@/lib/shop-badges';
import type { SourceSlice } from '@/lib/vendor-funnel';
import type { SourceAttribution } from '@/lib/vendor-source-attribution';
import type { GrowthSeries } from '@/lib/vendor-growth-series';

export type LabShop = 'setnaprod' | 'sample' | 'new';

/** The prototype's "today" — every date on the strip and every bucket label is fixed to it, so screenshots repeat. */
const NOW_MS = Date.parse('2026-11-06T04:00:00Z');
const Z = (n: number) => Array<number>(n).fill(0);

function series(day: number[], month: number[]): GrowthSeries {
  return {
    day: dayBuckets(NOW_MS, 30).map((b, i) => ({ ...b, count: day[i] ?? 0 })),
    month: monthBuckets(NOW_MS, 12).map((b, i) => ({ ...b, count: month[i] ?? 0 })),
  };
}
const slice = (key: string, label: string, count: number | null): SourceSlice => ({ key, label, count: count ?? 1, shown: count !== null });
const row = (attribution: 'setnayan' | 'off_platform' | 'unattributed', bookingCount: number, revenuePhp: number) => ({ attribution, bookingCount, pricedCount: bookingCount, revenuePhp });
function attribution(set: [number, number], own: [number, number]): SourceAttribution {
  const n = set[0] + own[0];
  const rev = set[1] + own[1];
  return {
    setnayan: row('setnayan', set[0], set[1]),
    offPlatform: row('off_platform', own[0], own[1]),
    unattributed: row('unattributed', 0, 0),
    totalBookings: n,
    totalPriced: n,
    totalRevenuePhp: rev,
    setnayanBookingSharePct: n ? Math.round((set[0] / n) * 100) : null,
    setnayanRevenueSharePct: rev ? Math.round((set[1] / rev) * 100) : null,
  };
}
const EMPTY_ATTR = attribution([0, 0], [0, 0]);

/** The prototype heat grid (rows Mon → Sun, eight 3-hour blocks) back into the reader's {dow, hr} cells. */
function heatCells(grid: number[][]) {
  return grid.flatMap((cols, r) => cols.map((count, c) => ({ dow: (r + 1) % 7, hr: c * 3, count })));
}

function labRecs(stats: GrowthRecStats | null, asked: Record<GrowthWindow, number>) {
  return { '30': buildGrowthRecs(stats, { askedInWindow: asked['30'] }), '12': buildGrowthRecs(stats, { askedInWindow: asked['12'] }) };
}

const SAMPLE_STATS = { avg_response_minutes: 100, response_rate_pct: 92, review_count: 12, profile_completeness_pct: 100, finalized_booking_count: 9, partnership_count: 1 };

/** The sample's health ring is the prototype's own five scores, on the shipped pillar labels and hints. */
function sampleHealth(): VendorHealthComposite {
  const base = buildVendorHealthComposite(null);
  const scores = [88, 80, 61, 58, 75];
  return { ...base, pillars: base.pillars.map((p, i) => ({ ...p, score: scores[i] ?? null })), composite: 72, band: 'steady', bandLabel: 'STEADY', coaching: 'Turn more inquiries into booked events.' };
}

type Lab = { inputs: GrowthInputs; now: Totals | null; before: Totals | null; year: Totals | null; badges: TrackerFacts | null };

function totals(views: number, inquiries: number, quotes: number, booked: number): Totals {
  return { views, inquiries, quotes, booked };
}

function base(): Omit<GrowthInputs, 'totals30' | 'totalsBefore30' | 'totals12'> {
  return {
    nowMs: NOW_MS,
    views: series(Z(30), Z(12)),
    inquiries: series(Z(30), Z(12)),
    bookedDay: Z(30).map((bookings) => ({ bookings })),
    bookedMonth: Z(12).map((bookings) => ({ bookings })),
    viewsBySource: { '30': [], '12': [] },
    inquiriesBySource: { '30': [], '12': [] },
    bookedBySource: { '30': [], '12': [] },
    attribution: { '30': EMPTY_ATTR, '12': EMPTY_ATTR },
    annualPlanPhp: null,
    recs: labRecs(null, { '30': 0, '12': 0 }),
    verdict: { shown: false, reason: 'not_enough_replies', sample: 0 },
    inquiry: { reply: { answeredCount: 0, p50Minutes: null, p90Minutes: null, avgMinutes: null }, missed: { declined: 0, unansweredOverSla: 0, selfReportedNoResponse: 0, waitlisted: 0 }, heatmap: [], tokens: { tokensBurned: 0, unlockedEvents: 0, wonEvents: 0, tokensPerWon: null } },
    conversion: {
      quote: { sentCount: 0, acceptedCount: 0, acceptancePct: null, quotedWithInquiryCount: 0, avgHoursToQuote: null },
      deal: { acceptedProposalCount: 0, avgQuotedPhp: null, bookedPricedCount: 0, avgContractPhp: null, totalContractPhp: 0 },
      lead: { bookedWithDateCount: 0, avgLeadDays: null, medianLeadDays: null },
      winLoss: { bookingsWon: 0, inquiriesDeclined: 0, quotesLost: 0, winRateOfDecided: null },
    },
    capacity: { waitlist: [], waitlistTotal: 0, load: { upcomingBookedDays: 0, upcomingBookings: 0, next30DaysBooked: 0, next90DaysBooked: 0 } },
    upcoming: [],
    radar: { hasData: false, totalSignal: 0, bucketCount: 0, months: [], regions: [], looks: [], eventTypes: [] },
    // Flag-dark plan gate → every shop sees market intel today (`canMarket = !gateOn || …`).
    showMarket: true,
    rating: 'No reviews yet',
    ratingAvg: null,
    ratingCount: 0,
    reputation: { coverage: { totalReviews: 0, repliedCount: 0, coveragePct: null, avgReplyHours: null, avgRating: null, distribution: { five: 0, four: 0, three: 0, two: 0, one: 0 } }, monthly: [] },
    badges: null,
    health: buildVendorHealthComposite(null),
    healthUnread: false,
    bench: { hasBand: false, category: null, sampleN: 0, metrics: [] },
    benchUnread: false,
    price: { status: 'no_data', key: { category: 'your category', regionSlug: null, regionLabel: null, paxBucket: 'all', ownPricePhp: null } },
    category: null,
    regionLabel: null,
    pro: false,
  };
}

function badgeFacts(f: TrackerFacts): GrowthInputs['badges'] {
  const ladder = f.completedEvents === null ? null : milestoneLadder(f.completedEvents);
  return {
    verified: f.verified,
    completedEvents: f.completedEvents,
    earned: ladder?.earned ?? null,
    earnedName: ladder?.earned ? stepName(ladder.earned) : null,
    next: ladder?.next ?? null,
    nextName: ladder?.next ? stepName(ladder.next) : null,
  };
}

function setnaprod(): Lab {
  const now = totals(67, 0, 0, 0);
  const facts: TrackerFacts = { verified: true, completedEvents: 0, trusted: null, inBusinessSinceYear: 2026, awards: [], nowYear: 2026, unreviewed: null };
  // The prototype's day lane (its 12-month figures were not in the screenshots — "shown the same as 30 days").
  const day = [3, 2, 4, 1, 0, 2, 5, 3, 2, 1, 4, 2, 0, 3, 2, 1, 6, 2, 3, 1, 2, 4, 1, 2, 3, 0, 2, 1, 3, 2];
  const sources = [slice('profile_direct', 'Profile (direct)', 66), slice('explore_card', 'Explore card', null)];
  return {
    now,
    before: totals(83, 0, 0, 0),
    year: now,
    badges: facts,
    inputs: {
      ...base(),
      totals30: now,
      totalsBefore30: totals(83, 0, 0, 0),
      totals12: now,
      views: series(day, [...Z(11), 67]),
      viewsBySource: { '30': sources, '12': sources },
      inquiriesBySource: { '30': [], '12': [] },
      // No vendor_activity_stats row yet → the universal starter set, with reply advice held until someone asks.
      recs: labRecs(null, { '30': 0, '12': 0 }),
      badges: badgeFacts(facts),
      // The plan gate is flag-dark, so every shop sees market intel today (`canMarket = !gateOn || …`): the rail draws,
      // empty, because no band has cleared the min-N floor for this bucket.
      showMarket: true,
      category: 'Pabati',
      price: { status: 'no_data', key: { category: 'Pabati', regionSlug: null, regionLabel: null, paxBucket: 'all', ownPricePhp: null } },
    },
  };
}

function sample(): Lab {
  const now = totals(48, 6, 4, 2);
  const year = totals(410, 38, 22, 9);
  const facts: TrackerFacts = { verified: true, completedEvents: 12, trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 }, inBusinessSinceYear: 2024, awards: [], nowYear: 2026, unreviewed: 0 };
  const month = (iso: string, inquiries: number, unlocks: number, bookings: number) => ({ month: iso, label: iso.slice(0, 7), inquiries, unlocks, bookings, total: inquiries + unlocks + bookings });
  const reviewMonths = [0, 1, 0, 2, 1, 1, 0, 2, 1, 1, 2, 1];
  return {
    now,
    before: totals(36, 4, 0, 1),
    year,
    badges: facts,
    inputs: {
      ...base(),
      totals30: now,
      totalsBefore30: totals(36, 4, 0, 1),
      totals12: year,
      views: series(
        [1, 2, 0, 3, 1, 2, 1, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1, 2, 0, 1, 2, 3, 1, 2, 1, 0, 3, 2, 2, 4],
        [22, 26, 30, 28, 34, 38, 31, 36, 40, 37, 42, 46],
      ),
      inquiries: series(
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [2, 2, 3, 2, 3, 4, 3, 3, 4, 3, 4, 5],
      ),
      bookedDay: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((bookings) => ({ bookings })),
      bookedMonth: [0, 1, 0, 1, 0, 2, 0, 1, 1, 0, 1, 2].map((bookings) => ({ bookings })),
      viewsBySource: {
        '30': [slice('profile_direct', 'Profile (direct)', 31), slice('host_marketplace_search', 'Marketplace search', 12), slice('explore_card', 'Explore card', 5)],
        '12': [slice('profile_direct', 'Profile (direct)', 266), slice('host_marketplace_search', 'Marketplace search', 98), slice('explore_card', 'Explore card', 31), slice('host_manual', 'Added by couple', 15)],
      },
      inquiriesBySource: {
        '30': [slice('website', 'Website', 6), slice('first_pick', 'First Pick', null)],
        '12': [slice('website', 'Website', 29), slice('first_pick', 'First Pick', 6), slice('auto_build', 'Auto Build', null)],
      },
      bookedBySource: { '30': [], '12': [slice('profile_direct', 'Profile (direct)', 5), slice('host_marketplace_search', 'Marketplace search', null)] },
      attribution: { '30': attribution([1, 50000], [1, 36000]), '12': attribution([5, 231000], [4, 171000]) },
      recs: labRecs(SAMPLE_STATS, { '30': 6, '12': 38 }),
      verdict: { shown: true, label: 'Usually responds in 2h', medianMinutes: 100, sample: 5 },
      inquiry: {
        reply: { answeredCount: 31, p50Minutes: 100, p90Minutes: 360, avgMinutes: 140 },
        missed: { declined: 2, unansweredOverSla: 1, selfReportedNoResponse: 0, waitlisted: 1 },
        heatmap: heatCells([
          [0, 0, 0, 1, 2, 2, 3, 1],
          [0, 0, 0, 1, 1, 2, 2, 1],
          [0, 0, 0, 1, 2, 1, 3, 2],
          [0, 0, 0, 0, 1, 2, 2, 1],
          [0, 0, 0, 1, 2, 3, 4, 2],
          [0, 0, 1, 2, 3, 3, 2, 1],
          [0, 0, 1, 2, 2, 2, 1, 0],
        ]),
        tokens: { tokensBurned: 0, unlockedEvents: 0, wonEvents: 0, tokensPerWon: null },
      },
      conversion: {
        quote: { sentCount: 10, acceptedCount: 6, acceptancePct: 60, quotedWithInquiryCount: 10, avgHoursToQuote: 5 },
        deal: { acceptedProposalCount: 6, avgQuotedPhp: null, bookedPricedCount: 9, avgContractPhp: 43000, totalContractPhp: 387000 },
        lead: { bookedWithDateCount: 9, avgLeadDays: 81, medianLeadDays: 74 },
        winLoss: { bookingsWon: 9, inquiriesDeclined: 2, quotesLost: 3, winRateOfDecided: 82 },
      },
      capacity: {
        waitlist: [
          { date: '2026-12-13', waiting: 2 },
          { date: '2027-01-24', waiting: 1 },
        ],
        waitlistTotal: 3,
        load: { upcomingBookedDays: 4, upcomingBookings: 5, next30DaysBooked: 2, next90DaysBooked: 4 },
      },
      upcoming: [
        { date: '2026-11-15', bookings: 1 },
        { date: '2026-11-29', bookings: 2 },
        { date: '2026-12-23', bookings: 1 },
        { date: '2027-01-13', bookings: 1 },
      ],
      radar: {
        hasData: true,
        totalSignal: 56,
        bucketCount: 4,
        months: [month('2026-10-01', 20, 4, 2), month('2026-12-01', 10, 2, 2), month('2027-01-01', 6, 2, 1), month('2027-02-01', 5, 1, 1)],
        regions: [],
        looks: [],
        eventTypes: [],
      },
      showMarket: true,
      rating: '4.8 ★ · 12 reviews',
      ratingAvg: 4.8,
      ratingCount: 12,
      reputation: {
        coverage: { totalReviews: 12, repliedCount: 9, coveragePct: 75, avgReplyHours: 28.8, avgRating: 4.8, distribution: { five: 9, four: 2, three: 1, two: 0, one: 0 } },
        monthly: reviewMonths.map((count, i) => ({ month: `m${i}`, label: '', count, avgRating: null })),
      },
      badges: badgeFacts(facts),
      health: sampleHealth(),
      bench: {
        hasBand: true,
        category: 'your category',
        sampleN: 12,
        metrics: [
          { key: 'reply_rate', label: 'Response rate', direction: 'higher_better', own: 92, band: { p25: 60, p50: 78, p75: 88 }, percentile: 96, tier: 'top' },
          { key: 'reply_mins', label: 'Avg reply time', direction: 'lower_better', own: 100, band: { p25: 300, p50: 180, p75: 120 }, percentile: 84, tier: 'top' },
          { key: 'conversion', label: 'Inquiry → booking', direction: 'higher_better', own: 24, band: { p25: 12, p50: 19, p75: 26 }, percentile: 66, tier: 'above_median' },
        ],
      },
      price: {
        status: 'positioned',
        key: { category: 'your category', regionSlug: null, regionLabel: null, paxBucket: 'all', ownPricePhp: 38000 },
        band: { lowPhp: 25000, medianPhp: 40000, highPhp: 65000, sampleN: 12, computedAt: '2026-11-01T00:00:00Z' },
        position: 'in_band',
        percentile: 45,
      },
      category: 'your category',
    },
  };
}

function fresh(): Lab {
  const z = totals(0, 0, 0, 0);
  const facts: TrackerFacts = { verified: false, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026, unreviewed: null };
  return { now: z, before: z, year: z, badges: facts, inputs: { ...base(), totals30: z, totalsBefore30: z, totals12: z, badges: badgeFacts(facts) } };
}

/** Every read refused: the page's own fallbacks (null everywhere a reader can say "not read"). */
function refused(): Lab {
  const nul = { '30': null, '12': null };
  return {
    now: null,
    before: null,
    year: null,
    badges: null,
    inputs: {
      ...base(),
      totals30: null,
      totalsBefore30: null,
      totals12: null,
      views: null,
      inquiries: null,
      bookedDay: null,
      bookedMonth: null,
      viewsBySource: nul,
      inquiriesBySource: nul,
      bookedBySource: nul,
      attribution: nul,
      verdict: null,
      inquiry: null,
      conversion: null,
      capacity: null,
      upcoming: null,
      rating: 'Couldn’t load',
      reputation: null,
      radar: null,
      price: { status: 'unreadable' },
      benchUnread: true,
      health: unmeasuredVendorHealthComposite(),
      healthUnread: true,
    },
  };
}

export function AnalyticsLab({ shop, win, fail }: { shop?: string; win?: string; fail: boolean }) {
  const which: LabShop = shop === 'sample' || shop === 'new' ? shop : 'setnaprod';
  const lab = fail ? refused() : which === 'sample' ? sample() : which === 'new' ? fresh() : setnaprod();
  const view = buildGrowthView(lab.inputs);
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-lab-shop-analytics={fail ? 'refused' : which}>
      <GrowthWindowScope initial={win === '12' ? '12' : '30'}>
        <ShopSegments on="insights" figures={analyticsFigures(lab.now, lab.before)} yearFigures={analyticsFigures(lab.year, null)} />
        {/* LAB ONLY — the prototype's own ribbon on its sample shop, so a screenshot is never mistaken for a real one. */}
        {which === 'sample' && !fail ? (
          <p className="-mx-4 px-4 py-1 text-[12px] font-bold uppercase tracking-[0.04em]" style={{ color: 'rgb(var(--color-warn))', background: 'color-mix(in srgb, rgb(var(--color-warn)) 14%, transparent)' }} data-lab-sample-ribbon="">
            Sample numbers · not a real shop
          </p>
        ) : null}
        <div className="mx-auto w-full max-w-xl">
          <h1 className="sn-h1">How is my business doing</h1>
          <div className="mt-2">
            <AnalyticsGrowing
              view={view}
              scope={
                // The sample shop has two services, so the page would draw the scope ▾ beside the window ▾ (2+ only).
                which === 'sample' && !fail ? (
                  <div key="scope" className="pt-1">
                    <ServiceScopeSelectClient
                      value=""
                      options={[
                        { key: '', label: 'All services', href: '/dev/supplier-lab?s=analytics&shop=sample' },
                        { key: 'a', label: 'Photo coverage', href: '/dev/supplier-lab?s=analytics&shop=sample' },
                        { key: 'b', label: 'Same-day edit', href: '/dev/supplier-lab?s=analytics&shop=sample' },
                      ]}
                    />
                  </div>
                ) : null
              }
              badges={<YourBadges shelf={badgeShelf(lab.badges)} rows={lab.badges ? badgeTracker(lab.badges) : null} />}
            />
          </div>
        </div>
      </GrowthWindowScope>
    </section>
  );
}
