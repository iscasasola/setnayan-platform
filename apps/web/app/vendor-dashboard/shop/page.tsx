import Link from 'next/link';
import { readLogoFrame, type LogoFrame } from '@/lib/open-shop-logo';
import { redirect } from 'next/navigation';
import { ArrowRight, ChevronRight, ExternalLink, Package as PackageIcon, Plus, UserRound } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile, businessProfileChecklist, profileGaps, type BusinessProfileItem, type VendorProfileRow } from '@/lib/vendor-profile';
import { fetchLatestApplication, requiredDocsComplete, type DocUploadMap } from '@/lib/vendor-verification';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { deriveVendorInitials as deriveInitials } from '@/app/_components/vendor-avatar';

import {
  VendorServicesManager,
  type ServicesManagerSearch,
} from '@/app/vendor-dashboard/services/_components/services-manager';

import { CouldNotLoad } from './_components/could-not-load';
import { SoftReadLog } from '@/lib/soft-read';
import { ServicesDisclosure } from './_components/services-disclosure';
import { moodboardLibraryAccessForProfile } from '@/lib/moodboard-library-access';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from '@/lib/inspiration-library-entry';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { DatesRow } from '../customers/_components/dates-row';
import { CouplePhotosToAnswer } from './_components/couple-photos';
import { ShopServiceRows } from './_components/shop-service-rows';
import { readShopScanSettings, type ScanSetting } from '@/lib/supplier-scan.server';
import { scannerChoiceOf } from '@/lib/supplier-scan';
import { ShopServicesThumb } from './_components/shop-services-thumb';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { resolveCoverageLabels } from '@/lib/vendor-coverages';
import { shopServiceRows, type ShopCardLite, type ShopCoverageLite, type ShopServiceRow } from '@/lib/shop-services-summary';
import { planWord } from '@/lib/vendor-plan-change-words';
import { siteOrigin } from '@/lib/site-origin';
import { myPageUrl } from '@/lib/supplier-qr-codes';
import { createAdminClient } from '@/lib/supabase/admin';
import { readShopTrackerFacts } from '@/lib/shop-badges.server';
import { badgeTracker, type TrackerFacts } from '@/lib/shop-badges';
import { readBadgeRewardTracker } from '@/lib/badge-rewards.server';
import { badgeRowsWithRewards, type TrackerRewardInput } from '@/lib/badge-rewards';
import { shopBadgeRow, type BadgeTile } from '@/lib/shop-badge-row';
import { loadShopAnalytics, type ShopAnalytics } from '@/lib/shop-analytics.server';
import { stripMarks, stripMonths } from '@/lib/analytics-growing';
import { formatCount } from '@/lib/format-number';
import type { ProfileFieldData } from './_components/editable-row';
import { ProfileChecklistEditor } from './_components/profile-checklist-editor';
import { ShopCover, type CoverData } from './_components/shop-cover';
import { ShopBadgeRow } from './_components/shop-badge-row';
import { ShopMakers, type ScannerLine } from './_components/shop-makers';
import { ShopAnalyticsCarousel, type AnalyticsCardData } from './_components/shop-analytics-carousel';
import { PromoteBody } from './promote/_components/promote-body';
import { CapacityCard } from '../performance/_components/capacity-card';
import { ConversionDealsCard } from '../performance/_components/conversion-deals-card';
import { PricePositionCard } from '../performance/_components/price-position-card';
import { RoiAttributionCard } from '../performance/_components/roi-attribution-card';
import { FunnelBenchmarkCard } from '../performance/_components/funnel-benchmark-card';
import { CardFace } from '../performance/_components/card-face';

/** Your details, and its papers fold — where every "finish your profile" / "get verified" link on this page goes. */
const DETAILS_HREF = '/vendor-dashboard/profile';
const PAGE_HREF = '/vendor-dashboard/website';

/**
 * /vendor-dashboard/shop — THE SHOP TAB (THE ONE BUILD, lane C4; owner-approved prototype v113/v114 `V.shop`).
 *
 * ONE scroll (v110 item 11): the cover (logo · name · Verified · ★ · events · plan · View shop ↗ · Share · Promote · QR ·
 * ⚙) → Your page · Your details → Analytics (five cards) → Badges (ONE row) → Makers (Scanner + Forms) → Services →
 * the thumb row (＋ Add a service). The `Shop ▾` section picker left this page: Analytics is in this scroll, Portfolio
 * is its own tab (`/vendor-dashboard/collections`), Promote and the QR codes are sheets from the cover, Details and the
 * papers are Your details and Shop ⚙. Their own addresses still work (`/performance`, `/shop/promote`, `/profile`).
 *
 * DATA — every number is LIVE and every read is HONEST: an unread one is "—" / "Couldn't load", never 0. Every read
 * starts at once and is awaited once (the 2026-09-29 rule below); the sheets' bodies (Promote, QR, ⚙, logo, cover)
 * are drawn only while the URL opens them. Request count: see the C4 build notes.
 */

export const metadata = { title: 'Shop' };

type ShopData = {
  businessName: string;
  initials: string;
  /** Presigned display URL of the uploaded logo, or null → initials. */
  logoUrl: string | null;
  /** The logo's align + zoom (owner 2026-11-06, A2). */
  logoFrame: LogoFrame;
  /** The cover band: Your page's cover pick, else the first portfolio photo (the page's own rule). */
  coverUrl: string | null;
  slug: string | null;
  city: string | null;
  tier: string | null;
  isVerified: boolean;
  websiteLive: boolean;
  /* Set when the read FAILED, as opposed to legitimately returning nothing. */
  logoUnavailable: boolean;
  verify: {
    status: VerifyStatus;
    requiredDocsIn: boolean;
    emailConfirmedAt: string | null;
    phoneConfirmedAt: string | null;
  };
  /** 🌱🖼 The shop's trades supply an inspiration part — "Add to the inspiration library" is drawn (owner 2026-10-19). */
  libraryOpen: boolean;
  /** 🧰 One row per service — `null` = the read failed, said as such, never "no services". */
  serviceRows: ShopServiceRow[] | null;
  /** 🎟 Each service's claim scanner (coverage id → setting) — `null` = unread. */
  scanSettings: Map<number, ScanSetting> | null;
  /** 🏅 The one badge row (`shopBadgeRow`) — null = unread. */
  badges: BadgeTile[] | null;
  /** The cover's "★ 4.8 · 120 events" — null = unread. */
  rating: string | null;
  events: string | null;
  /** 📊 The five Analytics cards. */
  analytics: ShopAnalytics | null;
  /** Fields of the business profile still empty (Your details' row) — the logo is its own first step (`profileGaps`). */
  fieldsLeft: number;
  /** The logo row's editor data (Your details' own close-save row). */
  logoItem: BusinessProfileItem | null;
  logoFields: ProfileFieldData;
};

type VerifyStatus = 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'withdrawn' | null;

async function loadShopData(): Promise<ShopData | 'no-vendor'> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return 'no-vendor';

  const vendorId = profile.vendor_profile_id;
  const businessName = profile.business_name ?? 'Your shop';

  // ─── EVERY READ BELOW STARTS AT ONCE ─────────────────────────────────────
  // 🔑 The gate above runs first (who is signed in, which shop is theirs). Every read below is scoped to THAT
  // `vendorId`, started here as a promise with its own graceful-degrade, and awaited together in the ONE
  // `Promise.all` below (measured 2026-09-29: one-after-another took 1.7 s). Analytics waits only for the plan.
  // ⚠ ADD A NEW READ AS ANOTHER STARTED PROMISE, NOT AS ANOTHER `await` IN THIS RUN.

  // The shop's own row, the columns the profile select does not carry: the plan, Your page's cover pick, the
  // founding mark and when the shop opened — ONE select.
  const ownRead = (async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('tier_state, microsite_hero_photo_key, is_founder, created_at')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      if (error) logQueryError('VendorShopPage.ownRow', error, { vendorId }, 'graceful_degrade');
      return error
        ? null
        : ((data as { tier_state?: string | null; microsite_hero_photo_key?: string | null; is_founder?: boolean | null; created_at?: string | null } | null) ?? null);
    } catch {
      return null;
    }
  })();

  const soft = new SoftReadLog('VendorShopPage');
  const verifyAppRead = soft.read('latestApplication', () => fetchLatestApplication(supabase, vendorId), null);
  const logoRead = (async () => {
    try {
      const url = profile.logo_url ? await displayUrlForStoredAsset(profile.logo_url) : null;
      return { logoUrl: url, logoUnavailable: false };
    } catch (err) {
      logQueryError('VendorShopPage.logoDisplayUrl', err, { vendorId, hasLogo: !!profile.logo_url });
      return { logoUrl: null, logoUnavailable: !!profile.logo_url };
    }
  })();

  // 🧰 Services (coverage rows) and the few columns of their cards the rows count.
  const serviceRowsRead = (async (): Promise<ShopServiceRow[] | null> => {
    try {
      const [cov, cards, labels] = await Promise.all([
        supabase.from('vendor_coverages').select('id,canonical_service').eq('vendor_profile_id', vendorId).order('created_at', { ascending: true }),
        supabase
          .from('vendor_services')
          .select(
            'vendor_service_id,coverage_id,category,is_active,starting_price_php,added_pax_price_php,pricing_basis,per_pax_price_php,min_pax,base_pax,hour_base_php,min_hours,extra_hour_php',
          )
          .eq('vendor_profile_id', vendorId)
          .order('created_at', { ascending: true }),
        resolveCoverageLabels(),
      ]);
      if (cov.error || cards.error) {
        logQueryError('VendorShopPage.serviceRows', cov.error ?? cards.error, { vendorId }, 'graceful_degrade');
        return null;
      }
      return shopServiceRows((cov.data ?? []) as ShopCoverageLite[], (cards.data ?? []) as ShopCardLite[], (cs) => labels.leafLabel(cs));
    } catch (err) {
      logQueryError('VendorShopPage.serviceRows', err, { vendorId });
      return null;
    }
  })();

  const scanSettingsRead = readShopScanSettings(supabase, vendorId).catch((err) => {
    logQueryError('VendorShopPage.scanSettings', err, { vendorId });
    return null;
  });

  // 🏅 THE BADGES — the shipped tracker's facts, then #7298's reward engine (measured, paid once if newly earned, read —
  // exactly as Performance does), chained on the facts so it adds no round trip beside the batch.
  const factsRead: Promise<TrackerFacts | null> = readShopTrackerFacts(vendorId).catch((err: unknown) => {
    logQueryError('VendorShopPage.badgeFacts', err, { vendorId });
    return null;
  });
  const rewardsRead: Promise<TrackerRewardInput | null> = (async () => {
    const facts = await factsRead;
    if (!facts) return null;
    try {
      return await readBadgeRewardTracker(createAdminClient(), vendorId, facts);
    } catch (err) {
      logQueryError('VendorShopPage.badgeRewards', err, { vendorId });
      return null;
    }
  })();

  // The cover: Your page's pick (when it is still on the page), else the first portfolio photo — `page-parts.tsx`'s
  // rule. Chained on the shop's own row only, so the presign rides beside the batch.
  const portfolio = (profile.portfolio_r2_keys ?? []) as string[];
  const coverRead = (async (): Promise<string | null> => {
    const own = await ownRead;
    const heroKey = own?.microsite_hero_photo_key && portfolio.includes(own.microsite_hero_photo_key) ? own.microsite_hero_photo_key : (portfolio[0] ?? null);
    if (!heroKey) return null;
    try {
      return await displayUrlForStoredAsset(heroKey);
    } catch (err) {
      logQueryError('VendorShopPage.coverDisplayUrl', err, { vendorId });
      return null;
    }
  })();

  // 📊 Analytics — the five cards, gated by the plan (chained on the shop's own row only).
  const analyticsRead = ownRead
    .then((own) => loadShopAnalytics(supabase, profile, user.id, own?.tier_state ?? null))
    .catch((err: unknown) => {
      logQueryError('VendorShopPage.analytics', err, { vendorId });
      return null;
    });

  // ─── THE ONE WAIT ────────────────────────────────────────────────────────
  const [own, verifyApp, { logoUrl, logoUnavailable }, serviceRows, scanSettings, facts, rewards, analytics, coverUrl] = await Promise.all([
    ownRead,
    verifyAppRead,
    logoRead,
    serviceRowsRead,
    scanSettingsRead,
    factsRead,
    rewardsRead,
    analyticsRead,
    coverRead,
  ]);

  const completion = businessProfileChecklist(profile);
  const verifyUploads = (verifyApp?.doc_uploads ?? {}) as DocUploadMap;
  const trusted = facts?.trusted ?? null;
  const avg = trusted?.trusted_avg_rating ?? null;
  const count = trusted?.trusted_review_count ?? null;

  const rows = facts ? (rewards ? badgeRowsWithRewards(badgeTracker(facts), rewards) : badgeTracker(facts)) : null;
  const badges = shopBadgeRow({
    rows,
    counts: rewards?.facts ?? null,
    completedEvents: facts?.completedEvents ?? null,
    trusted,
    inBusinessSinceYear: facts?.inBusinessSinceYear ?? null,
    founding: own ? { isFounder: own.is_founder === true, joinedYear: own.created_at ? Number(own.created_at.slice(0, 4)) : null } : null,
    // C2's `shop_booked_loop_count` is not in this tree yet (spec §9 #11) — the Booked Loop stays hidden.
    bookedLoopMeasured: false,
  });

  return {
    businessName,
    initials: deriveInitials(businessName),
    logoUrl,
    logoFrame: readLogoFrame(profile),
    coverUrl,
    slug: profile.business_slug ?? null,
    city: profile.location_city ?? null,
    tier: own?.tier_state ?? null,
    isVerified: profile.public_visibility === 'verified',
    websiteLive: Boolean(profile.business_slug) && isPubliclyVisible(profile.public_visibility),
    logoUnavailable,
    verify: {
      status: (verifyApp?.status as VerifyStatus) ?? null,
      requiredDocsIn: requiredDocsComplete(verifyUploads),
      emailConfirmedAt: verifyApp?.contact_email_confirmed_at ?? null,
      phoneConfirmedAt: verifyApp?.contact_phone_confirmed_at ?? null,
    },
    libraryOpen: moodboardLibraryAccessForProfile(profile, await getInspirationParts()).allowed,
    serviceRows,
    scanSettings,
    badges,
    // Honest zero: no trusted review → no rating word; unread → "—" (null).
    rating: trusted === null ? null : avg && count ? avg.toFixed(1) : null,
    events: facts?.completedEvents == null ? null : `${formatCount(facts.completedEvents)} ${facts.completedEvents === 1 ? 'event' : 'events'}`,
    analytics,
    // The logo is its own first step on Today, not a hidden 'field left' (`profileGaps`, owner 2026-10-22).
    fieldsLeft: profileGaps(completion).fieldsLeft,
    logoItem: completion.items.find((i) => i.key === 'logo') ?? null,
    logoFields: logoFieldData(profile, logoUrl),
  };
}

/** The logo row's data — the same shape Your details builds (`details-data.ts`); only the logo row reads it here. */
function logoFieldData(profile: VendorProfileRow, logoUrl: string | null): ProfileFieldData {
  return {
    business_name: profile.business_name ?? '',
    business_owner_name: profile.business_owner_name ?? '',
    hq_address: profile.hq_address ?? '',
    location_city: profile.location_city ?? '',
    hq_latitude: profile.hq_latitude ?? null,
    hq_longitude: profile.hq_longitude ?? null,
    contact_phone: profile.contact_phone ?? '',
    contact_email: profile.contact_email ?? '',
    in_business_since_year: profile.in_business_since_year ? String(profile.in_business_since_year) : '',
    venue_width_m: profile.venue_width_m != null ? String(profile.venue_width_m) : '',
    venue_length_m: profile.venue_length_m != null ? String(profile.venue_length_m) : '',
    capacity_min: profile.capacity_min != null ? String(profile.capacity_min) : '',
    capacity_max: profile.capacity_max != null ? String(profile.capacity_max) : '',
    logo_url: profile.logo_url ?? null,
    logoFrame: readLogoFrame(profile),
    logoDisplayMap: profile.logo_url && logoUrl ? { [profile.logo_url]: logoUrl } : {},
    services: (profile.services ?? []) as string[],
    extraServiceLeaves: [],
    vendorProfileId: profile.vendor_profile_id,
  };
}

/** The five faces — each the SHIPPED card's `compact` variant; a plan-locked card says which plan shows it. */
function analyticsCards(a: Extract<ShopAnalytics, { access: 'ok' }>): AnalyticsCardData[] {
  const locked = (title: string, plan: string) => (
    <CardFace title={title} window="Your plan" line={`Shows on ${plan} and up`} data="locked">
      <Link href="#plan" className="mt-4 inline-flex text-[13px] font-medium" style={{ color: 'var(--m-orange-deep)' }}>
        What each plan includes ›
      </Link>
    </CardFace>
  );
  const ahead =
    a.ahead === 'locked'
      ? { face: locked('What’s ahead', 'Pro'), locked: true }
      : {
          face: (
            <CapacityCard
              compact
              data={a.ahead.capacity}
              strip={
                a.ahead.booked === null
                  ? null
                  : {
                      months: stripMonths(a.todayIso),
                      ...stripMarks(a.todayIso, a.ahead.booked, (a.ahead.capacity?.waitlist ?? []).map((w) => ({ date: w.date }))),
                    }
              }
            />
          ),
          locked: false,
        };
  return [
    { key: 'ahead', ...ahead, series: a.series.ahead },
    a.deals === 'locked'
      ? { key: 'deals', face: locked('Quotes that turn into bookings', 'Pro'), locked: true }
      : { key: 'deals', face: <ConversionDealsCard compact data={a.deals} />, locked: false, series: a.series.deals },
    a.price === 'locked'
      ? { key: 'price', face: locked('Where your price sits', 'Pro'), locked: true }
      : { key: 'price', face: <PricePositionCard compact result={a.price ?? { status: 'unreadable' }} />, locked: false },
    a.worth === 'locked'
      ? { key: 'worth', face: locked('What Setnayan added', 'Solo'), locked: true }
      : { key: 'worth', face: <RoiAttributionCard compact attribution={a.worth} unread={a.worth === null} annualPlanPhp={null} windowLabel="in the last 12 months" />, locked: false, series: a.series.worth },
    a.compare === 'locked'
      ? { key: 'compare', face: locked('Compared with similar suppliers', 'Pro'), locked: true }
      : { key: 'compare', face: <FunnelBenchmarkCard compact benchmark={a.compare.benchmark} unreadable={a.compare.unreadable} />, locked: false },
  ];
}

async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<ServicesManagerSearch & Record<string, string | string[] | undefined>>;
}) {
  let data: ShopData | 'no-vendor' | null;
  try {
    data = await loadShopData();
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/shop] loader failed', err);
    data = null;
  }

  if (data === 'no-vendor') redirect('/open-shop');

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl tab:max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Shop</h1>
          <p className="max-w-prose text-base text-ink/65">Everything that defines your shop and your reach.</p>
        </header>
        <div>
          <p className="text-sm text-ink/70">
            Set up your business profile first — once it&rsquo;s created, your storefront, reach, and reputation all live
            here.
          </p>
          <Link href="/open-shop" className="button-primary mt-4 inline-flex items-center gap-2" data-tour="shop-details">
            Set up my shop
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    );
  }

  // Canonical vendor URL is the bare-root alias (www.setnayan.com/{slug}).
  const publicPath = data.slug ? `/${data.slug}` : null;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const shareUrl = data.slug ? myPageUrl(siteOrigin(), data.slug) : null;
  const cover: CoverData = {
    name: data.businessName,
    initials: data.initials,
    logoUrl: data.logoUrl,
    logoFrame: data.logoFrame,
    logoUnavailable: data.logoUnavailable,
    coverUrl: data.coverUrl,
    city: data.city,
    verified: {
      isVerified: data.isVerified,
      inReview: data.verify.status === 'pending_review' || data.verify.status === 'in_review',
      stepsDone: (data.verify.requiredDocsIn ? 1 : 0) + (data.verify.emailConfirmedAt && data.verify.phoneConfirmedAt ? 1 : 0),
    },
    rating: data.rating,
    events: data.events,
    planLabel: planWord(data.tier),
    publicPath,
    websiteLive: data.websiteLive,
    slug: data.slug,
    shareUrl,
  };
  const qrSearch = { et: one('et'), cat: one('cat'), mode: one('mode') };
  const scanners: ScannerLine[] | null =
    data.serviceRows === null || data.scanSettings === null
      ? null
      : data.serviceRows.filter((r) => r.coverageId != null).map((r) => ({ coverageId: r.coverageId!, label: r.label, choice: scannerChoiceOf(data.scanSettings!.get(r.coverageId!)) }));

  return (
    <>
      <div className="mx-auto w-full max-w-3xl pb-32" data-shop-tab="">
        <ShopCover
          d={cover}
          gearBody={shopGearBody(sp)}
          promoteBody={one('sheet') === 'promote' ? <PromoteBody search={qrSearch} part="promote" /> : null}
          qrBody={one('sheet') === 'qr' ? <PromoteBody search={qrSearch} part="qr" /> : null}
          logoBody={
            one('view') === 'logo' ? (
              <div className="space-y-3" data-shop-logo-view="">
                <p className="text-[13px] text-ink/65">Your logo · shows on your page, cards and chat. Drag to move, pinch to zoom.</p>
                {data.logoUnavailable ? <CouldNotLoad what="your logo" /> : null}
                {data.logoItem ? (
                  <ProfileChecklistEditor items={[data.logoItem]} data={data.logoFields} isVerified={data.isVerified} showProgress={false} flat />
                ) : null}
              </div>
            ) : null
          }
          coverBody={
            one('view') === 'cover' ? (
              <div className="space-y-3" data-shop-cover-view="">
                {data.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a presigned display URL
                  <img src={data.coverUrl} alt="Your cover photo" className="aspect-[16/10] w-full rounded-2xl object-cover" />
                ) : (
                  <p className="text-[13.5px] text-ink/65">No cover yet — your first portfolio photo becomes it.</p>
                )}
                <p className="text-[13px] text-ink/65">Cover photo · the top of your page. You pick it on Your page, and it goes live when you Apply there.</p>
                <ul className="divide-y divide-ink/10">
                  <li>
                    <DatesRow data="shop-cover-pick" title="Pick from Portfolio" line="Your photos · the cover goes live with your page's Apply" href={`${PAGE_HREF}#cover`} />
                  </li>
                  <li>
                    <DatesRow data="shop-cover-upload" title="Upload" line="Add photos to your Portfolio, then pick one" href="/vendor-dashboard/collections#gallery-media" />
                  </li>
                </ul>
              </div>
            ) : null
          }
        />
        {/* The old anchors still land here, once each (links already sent: notifications, bookmarks). */}
        <span id="get-verified" className="block scroll-mt-24" aria-hidden />
        <span id="manage-shop" className="block scroll-mt-24" aria-hidden />
        <span id="getting-paid" className="block scroll-mt-24" aria-hidden />

        {/* Your page · Your details — the two doors under the cover (v113). */}
        <ul id="d1" className="divide-y divide-ink/10 px-4 pt-2" data-shop-doors="">
          <li>
            <Link href={PAGE_HREF} className="sn-press flex min-h-[60px] items-center gap-3 py-2.5" data-shop-door="page">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
                <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">Your page</span>
                <span className="block truncate text-[13px] text-ink/60">
                  {data.websiteLive ? 'What couples see, part by part' : 'What couples will see · not shown yet'}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
            </Link>
          </li>
          <li>
            <Link href={DETAILS_HREF} className="sn-press flex min-h-[60px] items-center gap-3 py-2.5" data-shop-door="details" data-tour="shop-details">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
                <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">Your details</span>
                <span className="block truncate text-[13px] text-ink/60">
                  {data.fieldsLeft > 0
                    ? `${data.fieldsLeft === 1 ? '1 field left' : `${data.fieldsLeft} fields left`} · name · documents · how clients pay you`
                    : 'Name · documents · how clients pay you'}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
            </Link>
          </li>
          {/* 🌱🖼 The inspiration library, findable (owner 2026-10-19). */}
          {data.libraryOpen ? (
            <li>
              <DatesRow data="shop-inspiration-library" title={INSPIRATION_LIBRARY_ROW.label} line={INSPIRATION_LIBRARY_ROW.line} href={INSPIRATION_LIBRARY_HREF} />
            </li>
          ) : null}
          {/* Auto-reply moves to Clients ⚙ (spec §9 #6) — this row leaves only at integration, once L2's mount lands. */}
          {vendorAutoReplyEnabled() ? (
            <li id="auto-reply" className="scroll-mt-24">
              <DatesRow data="shop-auto-reply" title="Auto-reply" line="Answers the first message" href="/vendor-dashboard/website#auto-reply" />
            </li>
          ) : null}
        </ul>

        {/* 📸 Photos couples shared for a service card, waiting for Approve — draws nothing when none. */}
        <div className="px-4">
          <Suspense fallback={null}>
            <CouplePhotosToAnswer />
          </Suspense>
        </div>

        {/* 📊 ANALYTICS — five cards (spec §4). Owners and admins only (the cards carry booking revenue). */}
        {data.analytics === null ? (
          <p role="status" className="px-4 pt-5 text-[13.5px] text-ink/65" data-shop-analytics-unread="">
            Couldn&rsquo;t load your analytics just now.
          </p>
        ) : data.analytics.access === 'ok' ? (
          <ShopAnalyticsCarousel cards={analyticsCards(data.analytics)} recs={data.analytics.recs} nowMs={Date.now()} />
        ) : (
          <p className="px-4 pt-5 text-[13.5px] text-ink/60" data-shop-analytics-owner-only="">
            Analytics are for the shop&rsquo;s owner and admins.
          </p>
        )}

        {/* 🏅 BADGES — ONE row, the closest goal first. */}
        <ShopBadgeRow tiles={data.badges} />

        {/* 🛠 MAKERS — Scanner + the Forms door (no Tools Maker in this build). */}
        <ShopMakers scanners={scanners} formsHref={null} />

        {/* 🧰 SERVICES — one row per service, then every card with its switches (the shipped manager, whole). */}
        {/* The shipped rows carry their own "Services ⓘ" heading. */}
        <section className="px-4 pt-3" id="services">
          <ShopServiceRows rows={data.serviceRows} scan={null} />
          <p hidden className="py-3 text-[14px] text-ink/65" data-shop-cards-none="">
            No services match that search.
          </p>
          <ServicesDisclosure defaultOpen>
            <VendorServicesManager search={sp} basePath="/vendor-dashboard/shop" />
          </ServicesDisclosure>
          {/* 📦 Bundles — the shipped packages (flag-dark until NEXT_PUBLIC_PACKAGE_AUTHORING). */}
          {packageAuthoringEnabled() ? (
            <Link href="/vendor-dashboard/packages" id="packages" className="mt-4 flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--m-line)', background: 'var(--m-card)' }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--m-accent-soft)', color: 'var(--m-accent)' }}>
                <PackageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                  Bundles
                </span>
                <span className="block text-xs" style={{ color: 'var(--m-ink-soft)' }}>
                  Bundle your services into something a couple can make their own
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-ink-soft)' }} />
            </Link>
          ) : null}
          <Link href={SERVICE_MAKER_HREF} className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-ink/20 text-[14px] font-medium text-ink/75" data-shop-add-service="">
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add a service
          </Link>
        </section>
      </div>
      {/* 👍 Tools in the lower third — Search services · Show & sort · ＋ Add a service (v95). */}
      <ShopServicesThumb />
    </>
  );
}

/* ── My Shop hub (owner 5-page IA, 2026-07-12) ──────────────────────────────
 * One menu item, the whole business integrated: the shop home (profile ·
 * services · verify · website — this file's original body, incl. the
 * services fold-in from 2026-07-02) plus Contracts, Proposals (Earnings moved to Customers › Money, S-PR4),
 * How clients pay you, Manpower as tabs, and a Tools tab linking the
 * long-tail surfaces that left the sidebar. Old routes redirect in. */
import { Suspense } from 'react';
import { HardHat } from 'lucide-react';
import {
  FeatureAccordion,
  AccordionSkeleton,
  type AccordionSection,
} from '../_components/feature-accordion';
import ManpowerSurface from '../manpower/surface';
import { shopGearBody } from './_components/shop-settings-body';

// The folded feature sections, in strategic order below the shop home. Each
// expands in place and loads its server body on open (owner one-page IA
// 2026-07-12). Home (profile · services · verify · website) stays above.
/*
  ── CONTRACTS AND PROPOSALS LEFT THIS PAGE 2026-08-26 ───────────────────────
  Owner re-cut ("yes i agree"): a contract and a quote are papers about a deal
  with ONE customer, so a shop owner looks for them beside that customer, not
  beside their opening hours. Both now fold into the My Customers hub; their
  own routes still exist and now forward there, so every inbound link — the
  client page, the message thread's send-a-quote card, the requote nudge, the
  public proposal page — keeps working untouched.

  🔑 THIS RESTORES AN AGREEMENT THAT WAS ALREADY BROKEN. The phone's bottom bar
  has lit **Customers** for `/contracts` and `/proposals` all along, while the
  laptop rendered them under My Shop — the same question answered two ways
  depending on which screen you held. Nothing lit Shop for them, so no phone
  tab goes dark.
*/
const SHOP_SECTIONS: AccordionSection[] = [
  {
    key: 'manpower',
    label: 'Manpower',
    sub: 'Pick up paid crew gigs from events already booked',
    icon: <HardHat className="h-4 w-4" strokeWidth={1.75} />,
  },
];

/*
  ── MORE TOOLS LEFT THIS PAGE (owner "Yes to all", 2026-10-21, item 3) ──────
  ONE door, in Settings › More tools, as the approved 2026-10-14 prototype draws
  it. The shelves are still `shop-tool-shelves.ts` — Settings reads them
  (`settings/settings-rows.ts`), so not one tool was lost, only the copy. An old
  `?open=tools` link lands on Settings' fold (below).
*/
/** The open section's body — async so <Suspense> streams a skeleton while its
 *  queries run. Only the matching one renders, so folded sections cost nothing
 *  until expanded. */
async function ShopSectionBody({ open }: { open: string }) {
  switch (open) {
    case 'manpower':
      return <ManpowerSurface />;
    default:
      return null;
  }
}

export default async function VendorShopHub({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // `open` is canonical; `tab` is the legacy alias the old redirect stubs emit.
  const openRaw =
    (typeof sp.open === 'string' && sp.open) ||
    (typeof sp.tab === 'string' && sp.tab) ||
    null;
  // HOW CLIENTS PAY YOU left these folds for Your details (step 5, 2026-10-14). An
  // old `?open=payments` / `?tab=payments` link — the payout nudge's, a bookmark —
  // lands on that fold, with any flash it carried.
  if (openRaw === 'payments') {
    const qs = new URLSearchParams();
    for (const k of ['msg', 'error'] as const) {
      const v = sp[k];
      if (typeof v === 'string' && v) qs.set(k, v);
    }
    const query = qs.toString();
    redirect(`/vendor-dashboard/profile${query ? `?${query}` : ''}#pay`);
  }
  // MORE TOOLS is Settings' fold now (2026-10-21, item 3) — one door, not two.
  if (openRaw === 'tools') redirect('/vendor-dashboard/settings#more-tools');
  const open =
    openRaw && SHOP_SECTIONS.some((s) => s.key === openRaw) ? openRaw : null;

  return (
    <>
      {/* Home stays on top: identity · the door rows · services. */}
      <ShopHome searchParams={Promise.resolve(sp) as never} />

      {/* Everything else folds in below — one open at a time, loaded on expand.
          The id is where Settings' Manpower row lands (`settings-rows.ts`). */}
      <div id="shop-folds" className="scroll-mt-24">
        <FeatureAccordion sections={SHOP_SECTIONS} openKey={open} measure="reading">
          {open ? (
            <Suspense fallback={<AccordionSkeleton />}>
              <ShopSectionBody open={open} />
            </Suspense>
          ) : null}
        </FeatureAccordion>
      </div>
    </>
  );
}
