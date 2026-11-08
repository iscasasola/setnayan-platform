/**
 * 🧪 THE SHOP + PORTFOLIO TABS, from fixtures (THE ONE BUILD, lane C4 — the side-by-side proof against v113/v114 at
 * 375 px). `/dev/supplier-lab?s=shop-tab` · `?s=portfolio-tab` (dispatched through `coord-lab.tsx`, C4's lab file).
 * No database: the SAME components the two pages mount, handed v113's own sample shop (SetnaProd · 120 events · ★ 4.8 ·
 * 38 reviews · 18 inspiration photos · 4 cards · 1 branch). `&fail=1` = every read refused (the honest words).
 * Dev only (the lab page 404s in production).
 */
import { ShopCover, type CoverData } from '@/app/vendor-dashboard/shop/_components/shop-cover';
import { ShopBadgeRow } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import { ShopMakers } from '@/app/vendor-dashboard/shop/_components/shop-makers';
import { ShopAnalyticsCarousel, type AnalyticsCardData } from '@/app/vendor-dashboard/shop/_components/shop-analytics-carousel';
import { ShopServiceRows } from '@/app/vendor-dashboard/shop/_components/shop-service-rows';
import { CapacityCard } from '@/app/vendor-dashboard/performance/_components/capacity-card';
import { ConversionDealsCard } from '@/app/vendor-dashboard/performance/_components/conversion-deals-card';
import { PricePositionCard } from '@/app/vendor-dashboard/performance/_components/price-position-card';
import { RoiAttributionCard } from '@/app/vendor-dashboard/performance/_components/roi-attribution-card';
import { FunnelBenchmarkCard } from '@/app/vendor-dashboard/performance/_components/funnel-benchmark-card';
import { PortfolioView } from '@/app/vendor-dashboard/collections/_components/portfolio-view';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { ActionButton } from '@/components/action-button';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { CoordLabBar } from './coord-lab-bar';
import { Plus } from 'lucide-react';
import { badgeTracker, type TrackerFacts } from '@/lib/shop-badges';
import { badgeRowsWithRewards, FALLBACK_REWARD_NAMES, type BadgeRewardFacts } from '@/lib/badge-rewards';
import { shopBadgeRow } from '@/lib/shop-badge-row';
import { stripMarks, stripMonths } from '@/lib/analytics-growing';
import { buildGrowthRecs } from '@/lib/vendor-growth-recs';
import type { CapacityAnalytics } from '@/lib/vendor-capacity-analytics';
import type { ConversionAnalytics } from '@/lib/vendor-conversion-analytics';
import type { SourceAttribution } from '@/lib/vendor-source-attribution';
import type { FunnelBenchmark } from '@/lib/funnel-benchmark';
import type { PricePositionResult } from '@/lib/price-position';
import type { CollectionsInput } from '@/lib/supplier-collections';
import type { PageSaved } from '@/lib/supplier-page-draft';

export const SHOP_TAB_STATES = ['shop-tab', 'portfolio-tab'] as const;
export type ShopTabState = (typeof SHOP_TAB_STATES)[number];

const TODAY = '2026-11-08';
const NOW = Date.parse('2026-11-08T02:00:00Z');
const PHOTOS = [
  '/realstories/jack-jill-g1.jpg',
  '/realstories/john-jane-g2.jpg',
  '/realstories/maria-juan-g1.jpg',
  '/realstories/sofia-reyes-c2.jpg',
  '/realstories/jack-rose-g1.jpg',
  '/realstories/jack-jill-g2.jpg',
  '/realstories/jack-rose-g2.jpg',
  '/realstories/john-jane-g1.jpg',
  '/realstories/jack-jill-g3.jpg',
  '/realstories/jack-rose-g3.jpg',
];

const bar = (
  <BottomDock boundary="tab">
    <CoordLabBar />
  </BottomDock>
);

function shopLab(fail: boolean) {
  const facts: TrackerFacts | null = fail
    ? null
    : { verified: true, completedEvents: 120, trusted: { trusted_avg_rating: 4.8, trusted_review_count: 38 }, inBusinessSinceYear: 2020, awards: [], nowYear: 2026, unreviewed: 2 };
  const counts: BadgeRewardFacts | null = fail
    ? null
    : { verified: true, completedEvents: 120, trustedReviews: 38, firstSourcedBooking: true, branchIds: ['hq'], serviceCards: 4, inspirationPhotos: 18, awards: [], bookedLoops: 3 };
  const rows = facts && counts ? badgeRowsWithRewards(badgeTracker(facts), { facts: counts, granted: [], names: FALLBACK_REWARD_NAMES, awardTypeByTitle: {}, periodMonth: '2026-11-01' }) : null;
  const tiles = shopBadgeRow({
    rows,
    counts,
    completedEvents: facts?.completedEvents ?? null,
    trusted: facts?.trusted ?? null,
    inBusinessSinceYear: facts?.inBusinessSinceYear ?? null,
    founding: fail ? null : { isFounder: true, joinedYear: 2026 },
  });

  const capacity: CapacityAnalytics | null = fail
    ? null
    : { waitlist: [{ date: '2026-11-28', waiting: 1 }, { date: '2026-12-12', waiting: 1 }], waitlistTotal: 2, load: { upcomingBookedDays: 8, upcomingBookings: 9, next30DaysBooked: 3, next90DaysBooked: 8 } };
  const booked = fail
    ? null
    : ['2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12', '2026-12-19', '2027-01-09', '2027-01-23'].map((date, i) => ({ date, bookings: i === 3 ? 2 : 1 }));
  const deals = fail ? null : ({ quote: { sentCount: 21, acceptedCount: 9, acceptancePct: 42.9, quotedWithInquiryCount: 0, avgHoursToQuote: 0 } } as unknown as ConversionAnalytics);
  const price: PricePositionResult | { status: 'unreadable' } = fail
    ? { status: 'unreadable' }
    : ({
        status: 'positioned',
        key: { ownPricePhp: 45000 },
        band: { lowPhp: 25000, medianPhp: 40000, highPhp: 65000, sampleN: 14, computedAt: '2026-11-01T00:00:00Z' },
        position: 'in_band',
        percentile: 58,
      } as unknown as PricePositionResult);
  const worth: SourceAttribution | null = fail
    ? null
    : ({ setnayan: { attribution: 'setnayan', bookingCount: 14, pricedCount: 12, revenuePhp: 0 }, offPlatform: { attribution: 'off_platform', bookingCount: 9, pricedCount: 9, revenuePhp: 0 }, unattributed: { attribution: 'unattributed', bookingCount: 0, pricedCount: 0, revenuePhp: 0 }, totalBookings: 23 } as unknown as SourceAttribution);
  const benchmark = {
    hasBand: true,
    category: 'photography',
    sampleN: 12,
    metrics: [
      { key: 'reply_rate', label: 'Reply rate', direction: 'higher', own: 94, band: { p25: 60, p50: 75, p75: 88 }, percentile: 82, tier: 'top' },
      { key: 'reply_mins', label: 'Reply time', direction: 'lower', own: 45, band: { p25: 30, p50: 90, p75: 240 }, percentile: 64, tier: 'above_median' },
      { key: 'conversion', label: 'Inquiry → booking', direction: 'higher', own: 18, band: { p25: 10, p50: 20, p75: 30 }, percentile: 44, tier: 'below_median' },
    ],
  } as unknown as FunnelBenchmark;

  const cards: AnalyticsCardData[] = [
    {
      key: 'ahead',
      face: <CapacityCard compact data={capacity} strip={booked ? { months: stripMonths(TODAY), ...stripMarks(TODAY, booked, (capacity?.waitlist ?? []).map((w) => ({ date: w.date }))) } : null} />,
      locked: false,
      series: fail ? null : booked!.map((b) => b.date).concat(['2026-11-02', '2026-10-03', '2026-10-17', '2026-10-24']),
    },
    { key: 'deals', face: <ConversionDealsCard compact data={deals} />, locked: false, series: fail ? null : ['2026-11-03T03:00:00Z', '2026-11-06T03:00:00Z', '2026-10-04T03:00:00Z'] },
    { key: 'price', face: <PricePositionCard compact result={price} />, locked: false },
    { key: 'worth', face: <RoiAttributionCard compact attribution={worth} unread={fail} annualPlanPhp={null} windowLabel="in the last 12 months" />, locked: false, series: fail ? null : ['2026-11-05T03:00:00Z', '2026-10-09T03:00:00Z'] },
    { key: 'compare', face: <FunnelBenchmarkCard compact benchmark={benchmark} unreadable={fail} />, locked: false },
  ];

  const cover: CoverData = {
    name: 'SetnaProd',
    initials: 'SP',
    logoUrl: null,
    logoFrame: { x: 50, y: 50, zoom: 100 } as CoverData['logoFrame'],
    logoUnavailable: false,
    coverUrl: PHOTOS[0]!,
    city: 'Batangas',
    verified: { isVerified: true, inReview: false, stepsDone: 2 },
    rating: fail ? null : '4.8',
    events: fail ? null : '120 events',
    planLabel: 'Pro',
    publicPath: '/setnaprod',
    websiteLive: true,
    slug: 'setnaprod',
    shareUrl: 'https://www.setnayan.com/setnaprod',
  };

  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-shop-tab-lab="">
      <div className="mx-auto w-full max-w-3xl">
        <ShopCover d={cover} gearBody={null} promoteBody={null} qrBody={null} logoBody={null} coverBody={null} />
        <ul className="divide-y divide-ink/10 px-4 pt-2" data-shop-doors="">
          <li className="flex min-h-[60px] items-center py-2.5 text-[15px] font-medium">Your page</li>
          <li className="flex min-h-[60px] items-center py-2.5 text-[15px] font-medium">Your details</li>
        </ul>
        <ShopAnalyticsCarousel cards={cards} recs={buildGrowthRecs(null, { askedInWindow: 4 })} nowMs={NOW} />
        <ShopBadgeRow tiles={tiles} />
        <ShopMakers
          scanners={fail ? null : [{ coverageId: 1, label: 'Photography', choice: 'once' }, { coverageId: 2, label: 'Photo booth', choice: 'off' }]}
          formsHref={null}
        />
        <section className="px-4 pt-3" id="services">
          <ShopServiceRows
            rows={fail ? null : [
              { key: 'photo', label: 'Photo & Video', coverageId: 1, cards: 2, fromPhp: 45000, live: true, tools: ['Shot list'], scanner: null, firstCardId: null },
              { key: 'booth', label: 'Photo booth', coverageId: 2, cards: 1, fromPhp: null, live: false, tools: [], scanner: null, firstCardId: null },
            ] as never}
            scan={null}
          />
        </section>
      </div>
      <SupplierThumbRow name="services" label="Service actions">
        <ActionButton tone="brand" main icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add a service" href="#services" />
      </SupplierThumbRow>
      {bar}
    </div>
  );
}

function portfolioLab(fail: boolean) {
  const input: CollectionsInput = {
    page: { photos: 38, videos: 12, shown: true },
    cards: fail ? null : { cards: 4, photos: 12, videos: 1 },
    albums: fail ? null : { photos: 180, events: 1 },
    own: fail ? null : { items: 18 },
    delivered: fail ? null : { couples: 6, items: 6 },
    instagram: { configured: false, connected: false, posts: 0, shown: 0 },
    moodboard: fail ? null : { allowed: true, looks: 5, declined: 0 },
  };
  const saved = { sections: { portfolio: true } } as unknown as PageSaved;
  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-portfolio-tab-lab="">
      <div className="mx-auto w-full max-w-3xl">
        <PortfolioView
          vendorId="lab"
          input={input}
          saved={saved}
          previews={{ page: { urls: PHOTOS.slice(0, 9), total: 38 }, ...(fail ? {} : { cards: { urls: PHOTOS.slice(3, 9), total: 12 } }) }}
          showAlbums={{ page: { title: 'Photos on my page', urls: PHOTOS }, cards: { title: 'Service card photos', urls: PHOTOS.slice(3, 9) } }}
          photos={38}
          videoLinks={12}
          free={50}
          allowanceUnread={fail}
          walletBalance={fail ? null : 128}
          igFlash={null}
          gallery={<p className="py-3 text-[13px] text-ink/60">The shipped uploader (GalleryMedia) mounts here on the real page.</p>}
        />
      </div>
      {bar}
    </div>
  );
}

export function ShopTabLab({ state, fail = false }: { state: ShopTabState; fail?: boolean }) {
  return state === 'shop-tab' ? shopLab(fail) : portfolioLab(fail);
}
