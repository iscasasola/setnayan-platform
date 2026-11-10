import Link from 'next/link';
import { readLogoFrame, type LogoFrame } from '@/lib/open-shop-logo';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

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
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { CouplePhotosToAnswer } from './_components/couple-photos';
import { readShopScanSettings, type ScanSetting } from '@/lib/supplier-scan.server';
import { scannerChoiceOf } from '@/lib/supplier-scan';
import { ShopServicesThumb } from './_components/shop-services-thumb';
import { ShopServicesHead } from './_components/shop-services-head';
import { ShopBundles, type ShopBundle } from './_components/shop-bundles';
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
import { CoverPhotoMenu, LogoPhotoMenu } from './_components/photo-menus';
import { readPortfolioUploadFacts } from '@/lib/portfolio-upload-facts.server';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { ShopCover, type CoverData } from './_components/shop-cover';
import { ShopBadgeRow } from './_components/shop-badge-row';
import { ShopMakers, type BookedDay, type ScannerLine } from './_components/shop-makers';
import { heroPlaceholderUrl } from '@/lib/supplier-hero.server';
import { coverIsYourPagePick, shopCoverKey } from '@/lib/supplier-hero';
import { VENDOR_PACKAGE_SELECT } from '@/lib/vendor-packages';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { collapseToPickerDays, phTodayIso } from '@/lib/vendor-day-picker';
import { ShopAnalyticsCarousel, type AnalyticsCardData } from './_components/shop-analytics-carousel';
import { PromoteBody } from './promote/_components/promote-body';
import { CapacityCard } from '../performance/_components/capacity-card';
import { ConversionDealsCard } from '../performance/_components/conversion-deals-card';
import { PricePositionCard } from '../performance/_components/price-position-card';
import { RoiAttributionCard } from '../performance/_components/roi-attribution-card';
import { FunnelBenchmarkCard } from '../performance/_components/funnel-benchmark-card';
import { CardFace } from '../performance/_components/card-face';

const PAGE_HREF = '/vendor-dashboard/website';

/**
 * /vendor-dashboard/shop — THE SHOP TAB (THE ONE BUILD, lane C4; owner-approved prototype v113/v114 `V.shop`).
 *
 * ONE scroll (v110 item 11): the cover (logo · name · Verified · ★ · events · plan · View shop ↗ · Share · Promote · QR ·
 * ⚙) → Analytics (five cards) → Badges (ONE row, each in its progress ring) → Makers (one row of tiles: Forms Maker ·
 * Scanner, each opening into the body) → Services → the thumb row (＋ Add a service). Build 2 (§10 #31): no loose rows
 * under the cover — Your page is the Shop ⚙'s first row, Your details the account sheet's; the cover's "★ · N reviews"
 * opens Your page › Reviews and stories. The `Shop ▾` section picker left this page: Analytics is in this scroll, Portfolio
 * is its own tab (`/vendor-dashboard/collections`), Promote and the QR codes are sheets from the cover, Details and the
 * papers are Your details and Shop ⚙. Their own addresses still work (`/performance`, `/shop/promote`, `/profile`).
 *
 * DATA — every number is LIVE and every read is HONEST: an unread one is "—" / "Couldn't load", never 0. Every read
 * starts at once and is awaited once (the 2026-09-29 rule below); the sheets' bodies (Promote, QR, ⚙, logo, cover)
 * are drawn only while the URL opens them — and the Forms Maker's (`?maker=forms`). Request count: see the C4 + B2-B
 * build notes (Build 2 drops the inspiration-parts read from this page: its door moved to Portfolio).
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
  /** 🧰 One row per service — `null` = the read failed, said as such, never "no services". */
  serviceRows: ShopServiceRow[] | null;
  /** 🎟 Each service's claim scanner (coverage id → setting) — `null` = unread. */
  scanSettings: Map<number, ScanSetting> | null;
  /** 🏅 The one badge row (`shopBadgeRow`) — null = unread. */
  badges: BadgeTile[] | null;
  /** The cover's "★ 4.8 · 120 events" — null = unread. */
  rating: string | null;
  /** "38 reviews" beside the ★ — the cover's link into Your page › Reviews and stories (§10 #31). */
  reviews: string | null;
  events: string | null;
  /** 📊 The five Analytics cards — a started read, streamed by `ShopAnalyticsSection` (never part of the one wait). */
  analytics: Promise<ShopAnalytics | null>;
  /** 🖼 The hero (Lane E 11–12): the cover photo, else the category placeholder — and its caption. */
  hero: { url: string; kind: 'photo' | 'placeholder' };
  heroCaption: string | null;
  /** 🧰 Booked days today and ahead — where the per-event Specialized tools run (null = unread). */
  booked: BookedDay[] | null;
  /** `vendor_profiles.services` — the Song bank's music rule. */
  services: string[];
  /** 📦 The shop's bundles (Lane E item 7: bundles FIRST) — null = unread; [] with `bundlesOn` false = the flag is off. */
  bundles: ShopBundle[] | null;
  /** Fields of the business profile still empty (Your details' row) — the logo is its own first step (`profileGaps`). */
  fieldsLeft: number;
  /** The logo row's editor data (Your details' own close-save row). */
  logoItem: BusinessProfileItem | null;
  logoFields: ProfileFieldData;
  /** 📂 What the Upload doors' uploader needs (the stored list · free room · wallet) — Portfolio's own three reads. */
  uploadFacts: PortfolioUploadFacts;
  /** 📋 How many live forms the shop has saved (the Forms Maker tile) — null = unread, said as "Couldn't load". */
  formsSaved: number | null;
};

/** The badge facts were unread — the reward lines are then simply absent (a sentinel, never logged twice). */
const FACTS_UNREAD = Symbol('badge facts unread');

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
  // 📋 …and the Forms Maker tile's "N saved" (Build 2 leftover, owner 9 Nov "finish it"): the shop's LIVE forms ride
  // this SAME request as an embed (ids only, retired ones filtered out) — no new request on any Shop load.
  const ownRead = (async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('tier_state, microsite_hero_photo_key, is_founder, created_at, vendor_forms!vendor_forms_vendor_profile_id_fkey(form_id)')
        .is('vendor_forms.retired_at', null)
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      if (error) logQueryError('VendorShopPage.ownRow', error, { vendorId }, 'graceful_degrade');
      return error
        ? null
        : ((data as {
            tier_state?: string | null;
            microsite_hero_photo_key?: string | null;
            is_founder?: boolean | null;
            created_at?: string | null;
            vendor_forms?: { form_id: string }[] | null;
          } | null) ?? null);
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

  // 🏅 THE BADGES — the shipped tracker's facts, and #7298's reward engine READ beside them (its reads start now; only
  // the final merge waits for the facts). 🛑 READ ONLY: this render never pays a reward — `<BadgeRewardSweep />` asks
  // the paying door after the page has drawn (`lib/badge-rewards.server.ts` header; guard: the-shop-render-never-writes).
  const factsRead: Promise<TrackerFacts | null> = readShopTrackerFacts(vendorId).catch((err: unknown) => {
    logQueryError('VendorShopPage.badgeFacts', err, { vendorId });
    return null;
  });
  const rewardsRead: Promise<TrackerRewardInput | null> = (async () => {
    try {
      return await readBadgeRewardTracker(
        createAdminClient(),
        vendorId,
        factsRead.then((f) => (f ? f : Promise.reject(FACTS_UNREAD))),
      );
    } catch (err) {
      // Unread facts were already logged above — no reward lines then, as before.
      if (err !== FACTS_UNREAD) logQueryError('VendorShopPage.badgeRewards', err, { vendorId });
      return null;
    }
  })();

  // The cover: Your page's pick (when it is still on the page), else the first portfolio photo — `page-parts.tsx`'s
  // rule. Chained on the shop's own row only, so the presign rides beside the batch.
  const portfolio = (profile.portfolio_r2_keys ?? []) as string[];
  const coverRead = (async (): Promise<string | null> => {
    const own = await ownRead;
    const heroKey = shopCoverKey(portfolio, own?.microsite_hero_photo_key);
    if (!heroKey) return null;
    try {
      return await displayUrlForStoredAsset(heroKey);
    } catch (err) {
      logQueryError('VendorShopPage.coverDisplayUrl', err, { vendorId });
      return null;
    }
  })();

  // 🖼 The hero's placeholder (Lane E item 12) — read only when there is no cover photo to wear.
  const heroRead = (async (): Promise<{ url: string; kind: 'photo' | 'placeholder' }> => {
    const url = await coverRead;
    return url ? { url, kind: 'photo' } : { url: await heroPlaceholderUrl(profile.services as string[] | null), kind: 'placeholder' };
  })();

  // 📦 Bundles — the shipped packages (flag-dark until NEXT_PUBLIC_PACKAGE_AUTHORING), listed FIRST (Lane E item 7).
  const bundlesRead: Promise<ShopBundle[] | null> = packageAuthoringEnabled()
    ? (async () => {
        try {
          const { data, error } = await supabase
            .from('vendor_packages')
            .select(`${VENDOR_PACKAGE_SELECT}, vendor_package_items(vendor_service_id)`)
            .eq('vendor_profile_id', vendorId)
            .order('updated_at', { ascending: false });
          if (error) {
            logQueryError('VendorShopPage.bundles', error, { vendorId }, 'graceful_degrade');
            return null;
          }
          return (data ?? []).map((p: { package_id: string; package_name: string | null; total_price_centavos: number | null; is_active: boolean | null; vendor_package_items?: { vendor_service_id: string | null }[] | null }) => ({
            id: p.package_id,
            name: p.package_name?.trim() || 'Untitled bundle',
            priceCentavos: p.total_price_centavos ?? null,
            live: p.is_active === true,
            cards: (p.vendor_package_items ?? []).filter((i) => i.vendor_service_id).length,
          }));
        } catch (err) {
          logQueryError('VendorShopPage.bundles', err, { vendorId });
          return null;
        }
      })()
    : Promise.resolve([]);

  // 🧰 The booked days the per-event Specialized tools run on — the same days the Hub picks from (`on-the-day/page.tsx`).
  const bookedRead: Promise<BookedDay[] | null> = (async () => {
    try {
      const rows = await fetchVendorRoomEvents(supabase, vendorId);
      return collapseToPickerDays(rows, phTodayIso())
        .filter((b) => b.when !== 'past')
        .map((b) => ({ eventId: b.eventId, eventName: b.eventName, bookedDate: b.bookedDate }));
    } catch (err) {
      logQueryError('VendorShopPage.bookedDays', err, { vendorId });
      return null;
    }
  })();

  // 📊 Analytics — the five cards, gated by the plan (its role read starts now, beside the shop's own row). NOT in the
  // one wait: the cards STREAM in their own <Suspense> (`ShopAnalyticsSection`), so the cover never waits for them.
  const analyticsRead: Promise<ShopAnalytics | null> = loadShopAnalytics(
    supabase,
    profile,
    user.id,
    ownRead.then((own) => own?.tier_state ?? null),
  ).catch((err: unknown) => {
    logQueryError('VendorShopPage.analytics', err, { vendorId });
    return null;
  });

  // 📂 The Upload doors (hero · Cover · Logo menus): the uploader's free room and wallet, beside the batch.
  const uploadFactsRead = readPortfolioUploadFacts(supabase, vendorId, portfolio, ownRead.then((own) => own?.tier_state ?? null));

  // ─── THE ONE WAIT ────────────────────────────────────────────────────────
  const [own, verifyApp, { logoUrl, logoUnavailable }, serviceRows, scanSettings, facts, rewards, coverUrl, hero, booked, uploadFacts] = await Promise.all([
    ownRead,
    verifyAppRead,
    logoRead,
    serviceRowsRead,
    scanSettingsRead,
    factsRead,
    rewardsRead,
    coverRead,
    heroRead,
    bookedRead,
    uploadFactsRead,
  ]);
  const bundles = await bundlesRead;

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
    // 🔁 The Booked Loop rides `rewards.facts.bookedLoops` (C2's counter, read by the reward engine) — hidden when unread.
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
    serviceRows,
    scanSettings,
    badges,
    // Honest zero: no trusted review → no rating word; unread → "—" (null).
    rating: trusted === null ? null : avg && count ? avg.toFixed(1) : null,
    reviews: trusted === null || !avg || !count ? null : `${formatCount(count)} ${count === 1 ? 'review' : 'reviews'}`,
    events: facts?.completedEvents == null ? null : `${formatCount(facts.completedEvents)} ${facts.completedEvents === 1 ? 'event' : 'events'}`,
    analytics: analyticsRead,
    hero,
    heroCaption:
      hero.kind === 'photo'
        ? coverIsYourPagePick(portfolio, own?.microsite_hero_photo_key)
          ? 'Cover · Your page'
          : 'Cover · first photo'
        : null,
    booked,
    services: (profile.services ?? []) as string[],
    bundles,
    // The logo is its own first step on Today, not a hidden 'field left' (`profileGaps`, owner 2026-10-22).
    fieldsLeft: profileGaps(completion).fieldsLeft,
    logoItem: completion.items.find((i) => i.key === 'logo') ?? null,
    logoFields: logoFieldData(profile, logoUrl),
    uploadFacts,
    formsSaved: own && Array.isArray(own.vendor_forms) ? own.vendor_forms.length : null,
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

/** 📊 The Analytics section, once its read lands — unread says so, never empty cards. */
async function ShopAnalyticsSection({ read }: { read: Promise<ShopAnalytics | null> }) {
  const analytics = await read;
  if (analytics === null) {
    return (
      <p role="status" className="px-4 pt-5 text-[13.5px] text-ink/65" data-shop-analytics-unread="">
        Couldn&rsquo;t load your analytics just now.
      </p>
    );
  }
  if (analytics.access === 'ok') {
    return <ShopAnalyticsCarousel cards={analyticsCards(analytics)} recs={analytics.recs} nowMs={Date.now()} />;
  }
  return (
    <p className="px-4 pt-5 text-[13.5px] text-ink/60" data-shop-analytics-owner-only="">
      Analytics are for the shop&rsquo;s owner and admins.
    </p>
  );
}

/** A sheet opened before its streamed body landed — the same words the sheet says for a body still on its way. */
function SheetOpening({ line = 'Opening…' }: { line?: string }) {
  return (
    <p role="status" className="py-4 text-[13.5px] text-ink/60">
      {line}
    </p>
  );
}

/** The streaming stand-in: the section's own heading and one card's height, so nothing jumps when the cards land. */
function AnalyticsPlaceholder() {
  return (
    <section aria-busy="true" aria-label="Analytics, loading" data-shop-analytics-loading="" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <span className="sn-eye">Analytics</span>
      </div>
      <div className="px-4">
        <div className="h-[196px] animate-pulse rounded-2xl bg-ink/[0.05]" />
      </div>
    </section>
  );
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

/** The services head's line: "Bundles first, then every service you do, by category · 1 bundle · 2 cards · 1 live". */
function servicesLine(d: ShopData): string {
  const parts = ['Bundles first, then every service you do, by category'];
  const c = servicesCompact(d);
  return c ? `${parts[0]} · ${c}` : parts[0]!;
}
/** "1 bundle · 2 cards · 1 live" — what the compressed row keeps. Unread counts are left out, never 0. */
function servicesCompact(d: ShopData): string {
  const n = (x: number, one: string, many: string) => `${formatCount(x)} ${x === 1 ? one : many}`;
  const bits: string[] = [];
  if (packageAuthoringEnabled() && d.bundles) bits.push(n(d.bundles.length, 'bundle', 'bundles'));
  const cards = cardsOf(d);
  if (cards !== null) {
    bits.push(n(cards, 'card', 'cards'));
    const live = (d.serviceRows ?? []).filter((r) => r.live).length;
    if (cards > 0) bits.push(`${formatCount(live)} live`);
  }
  return bits.join(' · ');
}
/** How many service cards the shop has — null when the rows were unread. */
function cardsOf(d: ShopData): number | null {
  return d.serviceRows === null ? null : d.serviceRows.reduce((t, r) => t + r.cards, 0);
}
/** Each service's "Tools on every event" line (the Event Hub's own tools), keyed by its coverage id. */
function toolsByCoverage(d: ShopData): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of d.serviceRows ?? []) {
    if (r.coverageId == null) continue;
    const t = [...r.tools, ...(r.scanner ? [r.scanner] : [])].join(' · ');
    if (t) out[r.coverageId] = t;
  }
  return out;
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
    reviews: data.reviews,
    events: data.events,
    planLabel: planWord(data.tier),
    publicPath,
    websiteLive: data.websiteLive,
    slug: data.slug,
    shareUrl,
    hero: data.hero,
    heroCaption: data.heroCaption,
    uploadFacts: data.uploadFacts,
  };
  const qrSearch = { et: one('et'), cat: one('cat'), mode: one('mode') };
  const scanners: ScannerLine[] | null =
    data.serviceRows === null || data.scanSettings === null
      ? null
      : data.serviceRows.filter((r) => r.coverageId != null).map((r) => ({ coverageId: r.coverageId!, label: r.label, choice: scannerChoiceOf(data.scanSettings!.get(r.coverageId!)) }));

  return (
    <>
      <div className="mx-auto w-full max-w-3xl pb-32" data-shop-tab="">
        {/* 🗂 Every cover sheet's body comes WITH the page (the picked client's pattern, `clients/[eventId]/_pages/switch.tsx`):
            Promote · QR · ⚙ stream in their own <Suspense> (the cover never waits for them), Logo · Cover are drawn from
            what the page already read. Opening or closing one is client state + `history.replaceState` — no request
            (guard: the-shop-sheets-open-without-a-request). The address still opens a sheet on arrival. */}
        <ShopCover
          d={cover}
          gearBody={<Suspense fallback={<SheetOpening line="Opening your settings…" />}>{shopGearBodyAlways(sp)}</Suspense>}
          promoteBody={
            <Suspense fallback={<SheetOpening />}>
              <PromoteBody search={qrSearch} part="promote" />
            </Suspense>
          }
          qrBody={
            <Suspense fallback={<SheetOpening />}>
              <PromoteBody search={qrSearch} part="qr" />
            </Suspense>
          }
          logoBody={
            <div className="space-y-3" data-shop-logo-view="">
                {data.logoUnavailable ? <CouldNotLoad what="your logo" /> : null}
                {/* 📷 One short menu (owner 9 Nov, Facebook's profile photo): See · Upload (the picker, then the shipped
                    framer) · Adjust. */}
                <LogoPhotoMenu logoUrl={data.logoUrl} logoItem={data.logoItem} logoFields={data.logoFields} isVerified={data.isVerified} />
              </div>
          }
          coverBody={
            <div className="space-y-3" data-shop-cover-view="">
                {/* 📷 One short menu (owner 9 Nov, Facebook's cover photo): See · Upload (the picker, in place) · Choose
                    (Your page's Pick from Portfolio). It still goes live with Your page's Apply. */}
                <CoverPhotoMenu coverUrl={data.coverUrl} facts={data.uploadFacts} chooseHref={`${PAGE_HREF}#cover`} />
              </div>
          }
        />
        {/* 🎁 Pays a newly earned badge's reward AFTER this page has drawn — the render itself only reads. */}
        <BadgeRewardSweep />
        {/* The old anchors still land here, once each (links already sent: notifications, bookmarks). */}
        <span id="d1" className="block scroll-mt-24" aria-hidden />
        <span id="get-verified" className="block scroll-mt-24" aria-hidden />
        <span id="manage-shop" className="block scroll-mt-24" aria-hidden />
        <span id="getting-paid" className="block scroll-mt-24" aria-hidden />

        {/* 🧭 No loose rows under the cover (Build 2 §10 #31): Your page is the Shop ⚙'s first row, Your details is the
            top-right account sheet's, and the inspiration library's door is Portfolio's (its tab, `pageHome`). */}

        {/* 📸 Photos couples shared for a service card, waiting for Approve — draws nothing when none. */}
        <div className="px-4">
          <Suspense fallback={null}>
            <CouplePhotosToAnswer />
          </Suspense>
        </div>

        {/* 📊 ANALYTICS — five cards (spec §4). Owners and admins only (the cards carry booking revenue). Streamed: the
            cover and the badges draw first, the cards arrive in place of a same-height placeholder. */}
        <Suspense fallback={<AnalyticsPlaceholder />}>
          <ShopAnalyticsSection read={data.analytics} />
        </Suspense>

        {/* 🏅 BADGES — ONE row: completed first, then in progress, then not yet (Lane E item 2). */}
        <ShopBadgeRow tiles={data.badges} />

        {/* 🛠 MAKERS — one row of tiles (Forms Maker · Specialized tools, Lane E item 13), each opening into the body. */}
        <ShopMakers
          scanners={scanners}
          formsBody={shopFormsBody(sp)}
          formsSaved={data.formsSaved}
          categories={(data.serviceRows ?? []).map((r) => r.label)}
          services={data.services}
          booked={data.booked}
        />

        {/* 🧰 YOUR SERVICES — ONE list (Build 3 Lane E items 5–7; owner: *"Bundles should be first and the services grouped
            in categories under. They are all services"*): the head (compresses into one sticky row; its ＋ = New bundle ·
            New service) → BUNDLES → every service card, grouped Group › Category (the one taxonomy). No Coverage · Service
            cards · Tools picker, no "Add a service or coverage" dropdown, no second "+ Add a service" link. */}
        <section className="px-4 pt-3" id="services" aria-labelledby="shop-services-h" data-shop-services="">
          <ShopServicesHead
            line={servicesLine(data)}
            compact={servicesCompact(data)}
            serviceHref={SERVICE_MAKER_HREF}
            bundlesOn={packageAuthoringEnabled()}
          />
          {/* 📦 BUNDLES FIRST — the shipped packages; the old Bundles card's anchor still lands here. */}
          <span id="packages" className="block scroll-mt-24" aria-hidden />
          {packageAuthoringEnabled() ? <ShopBundles bundles={data.bundles} cards={cardsOf(data)} /> : null}
          <p hidden className="py-3 text-[14px] text-ink/65" data-shop-cards-none="">
            No services match that search.
          </p>
          <VendorServicesManager search={sp} basePath="/vendor-dashboard/shop" toolsByCoverage={toolsByCoverage(data)} />
        </section>
      </div>
      {/* 👍 Tools in the lower third — Search services · Show & sort · ＋ Add a service (v95). */}
      <ShopServicesThumb bundlesOn={packageAuthoringEnabled()} />
    </>
  );
}

/* ── My Shop hub ─────────────────────────────────────────────────────────────
 * Contracts and Proposals left this page 2026-08-26 (they live beside the customer); More tools went to Settings
 * 2026-10-21; and the LAST fold, Manpower, left on 2026-11-09 (Build 3 Lane E, owner: *"Remove manpower gigs lets not
 * deal with this first"* — no door anywhere for now; `/vendor-dashboard/manpower` and its data are untouched). So Shop
 * has no folds. Old `?open=…` links still land here; `#shop-folds` keeps its anchor. */
import { Suspense } from 'react';
import { shopGearBodyAlways } from './_components/shop-settings-body';
import { BadgeRewardSweep } from '../_components/badge-reward-sweep';
import { shopFormsBody } from './_components/shop-forms-body';

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

  return (
    <>
      {/* Home stays on top: identity · the door rows · services. */}
      <ShopHome searchParams={Promise.resolve(sp) as never} />

      {/* The folds' old anchor — links already sent still land at the foot of Shop. */}
      <span id="shop-folds" className="block scroll-mt-24" aria-hidden />
    </>
  );
}
