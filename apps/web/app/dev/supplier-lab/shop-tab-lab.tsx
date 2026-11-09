/**
 * 🧪 THE SHOP + PORTFOLIO TABS, from fixtures (THE ONE BUILD, lane C4 — the side-by-side proof against v113/v114 at
 * 375 px). `/dev/supplier-lab?s=shop-tab` · `?s=portfolio-tab` (dispatched through `coord-lab.tsx`, C4's lab file).
 * No database: the SAME components the two pages mount, handed v113's own sample shop (SetnaProd · 120 events · ★ 4.8 ·
 * 38 reviews · 18 inspiration photos · 4 cards · 1 branch). `&unread=1` = every read refused (the honest words).
 * `&none=1` = a NEW shop with nothing in it (Build 3 Lane E: "even the empty modes … should always look good") — no
 * photo (the hero wears the placeholder), no badge earned, no bundle, no card, no booked event, an empty Portfolio.
 * Dev only (the lab page 404s in production).
 */
import { ShopCover, type CoverData } from '@/app/vendor-dashboard/shop/_components/shop-cover';
import { CoverPhotoMenu, LogoPhotoMenu } from '@/app/vendor-dashboard/shop/_components/photo-menus';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import type { ProfileFieldData } from '@/app/vendor-dashboard/shop/_components/editable-row';
import { ShopBadgeRow } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import { ShopMakers } from '@/app/vendor-dashboard/shop/_components/shop-makers';
import { ShopSettingsRows } from '@/app/vendor-dashboard/shop/_components/shop-settings-rows';
import { ShopAnalyticsCarousel, type AnalyticsCardData } from '@/app/vendor-dashboard/shop/_components/shop-analytics-carousel';
import { ShopServicesHead } from '@/app/vendor-dashboard/shop/_components/shop-services-head';
import { ShopBundles } from '@/app/vendor-dashboard/shop/_components/shop-bundles';
import { ServicesEmptyCard } from '@/app/vendor-dashboard/shop/_components/services-empty-card';
import { ShopServicesThumb } from '@/app/vendor-dashboard/shop/_components/shop-services-thumb';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { php } from '@/lib/service-card-snapshot';
import { CapacityCard } from '@/app/vendor-dashboard/performance/_components/capacity-card';
import { ConversionDealsCard } from '@/app/vendor-dashboard/performance/_components/conversion-deals-card';
import { PricePositionCard } from '@/app/vendor-dashboard/performance/_components/price-position-card';
import { RoiAttributionCard } from '@/app/vendor-dashboard/performance/_components/roi-attribution-card';
import { FunnelBenchmarkCard } from '@/app/vendor-dashboard/performance/_components/funnel-benchmark-card';
import { PortfolioView } from '@/app/vendor-dashboard/collections/_components/portfolio-view';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { CoordLabBar } from './coord-lab-bar';
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
import { eventAlbums, inspirationAlbums, serviceAlbums, type PortfolioGroups } from '@/lib/portfolio-groups';

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

function shopLab(fail: boolean, none: boolean) {
  const facts: TrackerFacts | null = fail
    ? null
    : none
      ? { verified: true, completedEvents: 0, trusted: { trusted_avg_rating: null, trusted_review_count: 0 }, inBusinessSinceYear: null, awards: [], nowYear: 2026, unreviewed: 0 }
      : { verified: true, completedEvents: 120, trusted: { trusted_avg_rating: 4.8, trusted_review_count: 38 }, inBusinessSinceYear: 2020, awards: [], nowYear: 2026, unreviewed: 2 };
  const counts: BadgeRewardFacts | null = fail
    ? null
    : none
      ? { verified: true, completedEvents: 0, trustedReviews: 0, firstSourcedBooking: false, branchIds: ['hq'], serviceCards: 1, inspirationPhotos: 0, awards: [], bookedLoops: 0 }
      : { verified: true, completedEvents: 120, trustedReviews: 38, firstSourcedBooking: true, branchIds: ['hq'], serviceCards: 4, inspirationPhotos: 18, awards: [], bookedLoops: 3 };
  const rows = facts && counts ? badgeRowsWithRewards(badgeTracker(facts), { facts: counts, granted: [], names: FALLBACK_REWARD_NAMES, awardTypeByTitle: {}, periodMonth: '2026-11-01' }) : null;
  const tiles = shopBadgeRow({
    rows,
    counts,
    completedEvents: facts?.completedEvents ?? null,
    trusted: facts?.trusted ?? null,
    inBusinessSinceYear: facts?.inBusinessSinceYear ?? null,
    founding: fail || none ? null : { isFounder: true, joinedYear: 2026 },
  });

  // `&none=1` passes what a NEW shop's reads return (nothing booked, no quotes, no market, no peers) — the lab drew a busy
  // shop's numbers under a new shop's cover, so its "empty" Analytics were never the empty ones (Build 3, 9 Nov).
  const capacity: CapacityAnalytics | null = fail
    ? null
    : none
      ? { waitlist: [], waitlistTotal: 0, load: { upcomingBookedDays: 0, upcomingBookings: 0, next30DaysBooked: 0, next90DaysBooked: 0 } }
      : { waitlist: [{ date: '2026-11-28', waiting: 1 }, { date: '2026-12-12', waiting: 1 }], waitlistTotal: 2, load: { upcomingBookedDays: 8, upcomingBookings: 9, next30DaysBooked: 3, next90DaysBooked: 8 } };
  const booked = fail
    ? null
    : none
      ? []
      : ['2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12', '2026-12-19', '2027-01-09', '2027-01-23'].map((date, i) => ({ date, bookings: i === 3 ? 2 : 1 }));
  const deals = fail
    ? null
    : none
      ? ({ quote: { sentCount: 0, acceptedCount: 0, acceptancePct: null, quotedWithInquiryCount: 0, avgHoursToQuote: 0 } } as unknown as ConversionAnalytics)
      : ({ quote: { sentCount: 21, acceptedCount: 9, acceptancePct: 42.9, quotedWithInquiryCount: 0, avgHoursToQuote: 0 } } as unknown as ConversionAnalytics);
  const price: PricePositionResult | { status: 'unreadable' } = fail
    ? { status: 'unreadable' }
    : none
      ? ({ status: 'no_data', key: { ownPricePhp: null } } as unknown as PricePositionResult)
      : ({
        status: 'positioned',
        key: { ownPricePhp: 45000 },
        band: { lowPhp: 25000, medianPhp: 40000, highPhp: 65000, sampleN: 14, computedAt: '2026-11-01T00:00:00Z' },
        position: 'in_band',
        percentile: 58,
      } as unknown as PricePositionResult);
  const worth: SourceAttribution | null = fail
    ? null
    : none
      ? ({ setnayan: { attribution: 'setnayan', bookingCount: 0, pricedCount: 0, revenuePhp: 0 }, offPlatform: { attribution: 'off_platform', bookingCount: 0, pricedCount: 0, revenuePhp: 0 }, unattributed: { attribution: 'unattributed', bookingCount: 0, pricedCount: 0, revenuePhp: 0 }, totalBookings: 0 } as unknown as SourceAttribution)
      : ({ setnayan: { attribution: 'setnayan', bookingCount: 14, pricedCount: 12, revenuePhp: 0 }, offPlatform: { attribution: 'off_platform', bookingCount: 9, pricedCount: 9, revenuePhp: 0 }, unattributed: { attribution: 'unattributed', bookingCount: 0, pricedCount: 0, revenuePhp: 0 }, totalBookings: 23 } as unknown as SourceAttribution);
  const benchmark = (none
    ? {
        hasBand: false,
        category: 'photography',
        sampleN: 0,
        metrics: [
          { key: 'reply_rate', label: 'Reply rate', direction: 'higher', own: null, band: null, percentile: null, tier: null },
          { key: 'reply_mins', label: 'Reply time', direction: 'lower', own: null, band: null, percentile: null, tier: null },
          { key: 'conversion', label: 'Inquiry → booking', direction: 'higher', own: null, band: null, percentile: null, tier: null },
        ],
      }
    : {
    hasBand: true,
    category: 'photography',
    sampleN: 12,
    metrics: [
      { key: 'reply_rate', label: 'Reply rate', direction: 'higher', own: 94, band: { p25: 60, p50: 75, p75: 88 }, percentile: 82, tier: 'top' },
      { key: 'reply_mins', label: 'Reply time', direction: 'lower', own: 45, band: { p25: 30, p50: 90, p75: 240 }, percentile: 64, tier: 'above_median' },
      { key: 'conversion', label: 'Inquiry → booking', direction: 'higher', own: 18, band: { p25: 10, p50: 20, p75: 30 }, percentile: 44, tier: 'below_median' },
    ],
  }) as unknown as FunnelBenchmark;

  const cards: AnalyticsCardData[] = [
    {
      key: 'ahead',
      face: <CapacityCard compact data={capacity} strip={booked ? { months: stripMonths(TODAY), ...stripMarks(TODAY, booked, (capacity?.waitlist ?? []).map((w) => ({ date: w.date }))) } : null} />,
      locked: false,
      series: fail ? null : none ? [] : booked!.map((b) => b.date).concat(['2026-11-02', '2026-10-03', '2026-10-17', '2026-10-24']),
    },
    { key: 'deals', face: <ConversionDealsCard compact data={deals} />, locked: false, series: fail ? null : none ? [] : ['2026-11-03T03:00:00Z', '2026-11-06T03:00:00Z', '2026-10-04T03:00:00Z'] },
    { key: 'price', face: <PricePositionCard compact result={price} />, locked: false },
    { key: 'worth', face: <RoiAttributionCard compact attribution={worth} unread={fail} annualPlanPhp={null} windowLabel="in the last 12 months" />, locked: false, series: fail ? null : none ? [] : ['2026-11-05T03:00:00Z', '2026-10-09T03:00:00Z'] },
    { key: 'compare', face: <FunnelBenchmarkCard compact benchmark={benchmark} unreadable={fail} />, locked: false },
  ];

  const cover: CoverData = {
    name: 'SetnaProd',
    initials: 'SP',
    logoUrl: null,
    logoFrame: { x: 50, y: 50, zoom: 100 } as CoverData['logoFrame'],
    logoUnavailable: false,
    coverUrl: none ? null : PHOTOS[0]!,
    hero: none ? { url: '/placeholders/vendor.webp', kind: 'placeholder' } : { url: PHOTOS[0]!, kind: 'photo' },
    heroCaption: none ? null : 'Cover · Your page',
    city: 'Batangas',
    verified: { isVerified: true, inReview: false, stepsDone: 2 },
    rating: fail || none ? null : '4.8',
    reviews: fail || none ? null : '38 reviews',
    events: fail ? null : none ? '0 events' : '120 events',
    planLabel: 'Pro',
    publicPath: '/setnaprod',
    websiteLive: true,
    slug: 'setnaprod',
    shareUrl: 'https://www.setnayan.com/setnaprod',
  };

  // 📷 Build 3 · integration: the Cover and Logo sheets are the REAL one-short-menus (`photo-menus.tsx`), on fixtures.
  const uploadFacts: PortfolioUploadFacts = { vendorProfileId: 'lab-shop', storedRefs: none ? [] : [...PHOTOS], free: 50, allowanceUnread: fail, walletBalance: fail ? null : 0 };
  const logoFields: ProfileFieldData = {
    business_name: 'SetnaProd', business_owner_name: '', hq_address: '', location_city: 'Batangas', hq_latitude: null, hq_longitude: null,
    contact_phone: '', contact_email: '', in_business_since_year: '', venue_width_m: '', venue_length_m: '', capacity_min: '', capacity_max: '',
    logo_url: null, logoDisplayMap: {}, services: ['live_band'], extraServiceLeaves: [], vendorProfileId: 'lab-shop',
  };
  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-shop-tab-lab="">
      <div className="mx-auto w-full max-w-3xl">
        <ShopCover
          d={{ ...cover, uploadFacts }}
          gearBody={
            /* Build 2 §10 #31 — the ⚙'s rows from fixtures (Your page first); the folds' editors mount on the real page. */
            <ShopSettingsRows
              planLine="Pro · renews 1 Dec"
              wallet={{ title: 'Shop wallet', line: '₱128 left' }}
              plan={<p className="text-[13px] text-ink/60">The shipped Plan screen mounts here.</p>}
              team={<p className="text-[13px] text-ink/60">The shipped Helpers screen mounts here.</p>}
              docs={{ isVerified: true, docsIn: 2, docsTotal: 2, measured: true, row: { state: 'done', badge: null } as never, section: <p className="text-[13px] text-ink/60">The papers mount here.</p> }}
            />
          }
          promoteBody={null}
          qrBody={null}
          logoBody={
            <div className="space-y-3" data-shop-logo-view="">
              <LogoPhotoMenu logoUrl={null} logoItem={{ key: 'logo', label: 'Logo', ok: false, surface: 'profile' }} logoFields={logoFields} isVerified />
            </div>
          }
          coverBody={
            <div className="space-y-3" data-shop-cover-view="">
              <CoverPhotoMenu coverUrl={cover.coverUrl} facts={uploadFacts} chooseHref="/vendor-dashboard/website#cover" />
            </div>
          }
        />
        <ShopAnalyticsCarousel cards={cards} recs={buildGrowthRecs(null, { askedInWindow: 4 })} nowMs={NOW} />
        <ShopBadgeRow tiles={tiles} />
        <ShopMakers
          scanners={fail ? null : none ? [] : [{ coverageId: 1, label: 'Photography', choice: 'once' }, { coverageId: 2, label: 'Photo booth', choice: 'off' }]}
          formsBody={null}
          categories={none ? [] : ['Live Band', 'Photo Booth']}
          services={none ? [] : ['live_band']}
          booked={fail ? null : none ? [] : [{ eventId: 'ev-santos', eventName: 'Santos – Dela Cruz wedding', bookedDate: '2026-11-14' }, { eventId: 'ev-cruz', eventName: 'Cruz debut', bookedDate: '2026-11-21' }]}
        />
        <section className="px-4 pt-3" id="services" aria-labelledby="shop-services-h" data-shop-services="">
          <ShopServicesHead
            line={none ? 'Bundles first, then every service you do, by category' : 'Bundles first, then every service you do, by category · 1 bundle · 2 cards · 1 live'}
            compact={none ? '' : '1 bundle · 2 cards · 1 live'}
            serviceHref="#services"
            bundlesOn
          />
          <ShopBundles bundles={fail ? null : none ? [] : [{ id: 'b1', name: 'Bar & mocktail night', priceCentavos: 15_000_000, live: true, cards: 2 }]} cards={none ? 0 : 2} />
          {none ? (
            <ServicesEmptyCard />
          ) : (
            <ul className="space-y-2.5 pt-2" data-shop-card-list="">
              <li className="px-1 pb-1 pt-1" data-shop-card-group="">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
                  Booths, carts &amp; bars › Mobile Bar
                </p>
                <p className="mt-1 text-[12px] leading-snug text-ink/60">
                  <span className="font-medium text-ink/75">Tools on every event · </span>Run of show &amp; countdown · Headcount · Review QR
                </p>
              </li>
              <li className="overflow-hidden rounded-2xl p-4" style={{ background: 'var(--m-paper)' }} data-shop-card="">
                <ServiceCardFace
                  snap={{ name: 'Mobile Bar by SetnaProd', priceText: `from ${php(110_000)}`, discountBadge: null, includesLine: null, notIncluded: ['Crew meal', 'Transport'], hasExclusive: false, givesSetnayanGift: false, hasCover: false }}
                  leafPathLabel="Mobile Bar · Booths, carts & bars"
                />
              </li>
            </ul>
          )}
        </section>
      </div>
      <ShopServicesThumb bundlesOn />
      {bar}
    </div>
  );
}

function portfolioLab(fail: boolean, none: boolean) {
  // ONE SOURCE draws both the counts and the albums, as `collections-data.ts` does (its `albums` count and its
  // `groups.events` are the same `albumsRead`). The lab used to hold fixed counts (180 album photos · 4 cards …) beside
  // `none`'s empty albums, so a new shop read "0 photos" and "about 216 photos" on one screen (Build 3, 9 Nov).
  const albumPhotos = none
    ? []
    : [
        ...PHOTOS.map((url, i) => ({ eventId: 'ev-santos', url, createdAt: `2026-11-07T0${i}:00:00Z` })),
        ...PHOTOS.slice(2, 8).map((url, i) => ({ eventId: 'ev-cruz', url, createdAt: `2026-10-18T0${i}:00:00Z` })),
        ...PHOTOS.slice(4, 9).map((url, i) => ({ eventId: 'ev-reyes', url, createdAt: `2026-09-27T0${i}:00:00Z` })),
      ];
  const serviceCards = none
    ? []
    : [
        { id: 'svc-photo', title: 'Wedding photo & video', urls: PHOTOS.slice(0, 8), total: 8 },
        { id: 'svc-booth', title: 'Photo booth', urls: PHOTOS.slice(5, 9), total: 4 },
      ];
  const looks = none
    ? []
    : [
        ...PHOTOS.slice(0, 5).map((url, i) => ({ id: `l${i}`, url, part: 'Reception styling' })),
        ...PHOTOS.slice(5, 8).map((url, i) => ({ id: `m${i}`, url, part: 'Bridal portraits' })),
      ];
  const input: CollectionsInput = {
    page: { photos: none ? 0 : 38, videos: none ? 0 : 12, shown: true },
    cards: fail ? null : { cards: serviceCards.length, photos: serviceCards.reduce((a, c) => a + c.total, 0), videos: 0 },
    albums: fail ? null : { photos: albumPhotos.length, events: new Set(albumPhotos.map((p) => p.eventId)).size },
    own: fail ? null : { items: none ? 0 : 18 },
    delivered: fail ? null : none ? { couples: 0, items: 0 } : { couples: 6, items: 6 },
    instagram: { configured: false, connected: false, posts: 0, shown: 0 },
    moodboard: fail ? null : { allowed: true, looks: looks.length, declined: 0 },
  };
  const saved = { sections: { portfolio: true } } as unknown as PageSaved;
  // Build 2 §10 #35 — v118's own sample groups, through the SAME pure builders the loader uses.
  const groups: PortfolioGroups = fail
    ? { events: null, services: null, inspiration: null, stories: null }
    : none
      ? { events: [], services: [], inspiration: [], stories: [] }
      : {
        events: eventAlbums(
          albumPhotos,
          [
            { eventId: 'ev-santos', eventName: 'Santos – Dela Cruz wedding', bookedDate: '2026-11-07' },
            { eventId: 'ev-cruz', eventName: 'Cruz debut', bookedDate: '2026-10-18' },
            { eventId: 'ev-reyes', eventName: 'Reyes christening', bookedDate: '2026-09-27' },
          ],
          { thisYear: 2026, albumHref: (id) => `/vendor-dashboard/on-the-day/live/${id}/papic#portfolio` },
        ),
        services: serviceAlbums(serviceCards),
        inspiration: inspirationAlbums(looks),
        stories: [
          { eventId: 'ev-santos', slug: 'santos-delacruz', hostNames: 'Ana & Miguel', line: 'Tagaytay · Nov 2026' },
          { eventId: 'ev-cruz', slug: 'bea-cruz-18', hostNames: 'Bea Cruz', line: 'Batangas · Oct 2026' },
        ],
      };
  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-portfolio-tab-lab="">
      <div className="mx-auto w-full max-w-3xl">
        <PortfolioView
          vendorId="lab"
          input={input}
          saved={saved}
          previews={none ? {} : { page: { urls: PHOTOS.slice(0, 9), total: 38 }, ...(fail ? {} : { cards: { urls: PHOTOS.slice(3, 9), total: input.cards?.photos ?? 0 } }) }}
          showAlbums={none ? {} : { page: { title: 'Photos on my page', urls: PHOTOS }, cards: { title: 'Service card photos', urls: PHOTOS.slice(3, 9) } }}
          photos={none ? 0 : 38}
          videoLinks={none ? 0 : 12}
          hero={none ? { url: '/placeholders/vendor.webp', kind: 'placeholder' } : { url: PHOTOS[9]!, kind: 'photo' }}
          moodboard={fail || none ? null : { looks: looks.length, declined: 0 }}
          songs={fail ? null : { count: none ? 0 : 24, withVideo: none ? 0 : 9 }}
          free={50}
          allowanceUnread={fail}
          walletBalance={fail ? null : 128}
          igFlash={null}
          groups={groups}
          allPhotos={none ? [] : [...PHOTOS].reverse()}
          libraryOpen={!fail}
          videoLinkUrls={fail || none ? [] : ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'https://vimeo.com/76979871', 'https://www.facebook.com/watch/?v=10153231379946729']}
          gallery={<p className="py-3 text-[13px] text-ink/60">The shipped uploader (GalleryMedia) mounts here on the real page.</p>}
        />
      </div>
      {bar}
    </div>
  );
}

export function ShopTabLab({ state, fail = false, none = false }: { state: ShopTabState; fail?: boolean; none?: boolean }) {
  return state === 'shop-tab' ? shopLab(fail, none) : portfolioLab(fail, none);
}
