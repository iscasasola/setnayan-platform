import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { MICROSITE_COLUMNS, micrositeFromRow } from '@/lib/vendor-microsite';
import { isShopLive } from '@/lib/vendor-visibility';
import { areBookingsOpen } from '@/lib/bookings-open.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { selfPublishedLive, shopPageGate } from '@/lib/own-shop-preview';
import { fetchReviewStats, fetchReviewsForVendorWithCouple, type ReviewWithCouple } from '@/lib/reviews';
import { readGuestReviewsForVendor, type GuestReviewsRead } from '@/lib/guest-reviews';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { distinctShopServices } from '@/lib/distinct-shop-services';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { isStoreShellRequest } from '@/lib/request-platform';
import { pageSavedFrom, type PageSaved } from '@/lib/supplier-page-draft';
import type { DomainRow } from './actions';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { shopBadges, trackerSummary, type ShopBadge } from '@/lib/shop-badges';

/**
 * YOUR PAGE — what the page editor needs, read once (simpler supplier dashboard step 5).
 *
 * 🔑 ONE SELECT FOR THE SHOP'S OWN ROW. The microsite (all eight columns), the plan, the verification state and the
 * travel distance are columns of the same row; `/website` used to read the visibility state alone, and My Shop read
 * the microsite in two more trips. `micrositeFromRow` parses them by `fetchVendorMicrosite`'s own rules.
 *
 * Every optional read degrades to "not read" (null), never to an empty list that would claim "no reviews yet" to a
 * shop that has forty.
 */

/** The reply list's ceiling — the retired /reviews page's own (`{ limit: 200 }`). */
const REPLY_LIST_MAX = 200;

export type PagePlanLine = { plan: string; line: string; pro: boolean };

export type PageData = {
  vendorId: string;
  businessName: string;
  slug: string | null;
  publicPath: string | null;
  /** Couples can see it (`isShopLive`, or shown before verification — `selfPublishedLive`) — the badge says so either way. */
  live: boolean;
  /** 🧪 `vendor_profiles.is_demo` — the public page wears "(DEMO ONLY)". */
  isDemo: boolean;
  /**
   * 🏪 Show my page before verification (owner 2026-11-02): `offer` = bookings are closed and the shop is not verified-
   * live, so the switch is drawn; `shown` = the shop has pressed it. `null` = the read failed (the switch is not drawn —
   * an unread switch is never shown as off).
   */
  showBeforeVerified: { offer: boolean; shown: boolean } | null;
  /** The owner can open it (visible), even before couples can. */
  visible: boolean;
  isVerified: boolean;
  kindWord: string | null;
  city: string | null;
  outerRadiusKm: number | null;
  yearsLabel: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** 📌 Couples who opened the page in the last 30 days (v13 Shop › Page's first figure). null = unread, never 0. */
  views30: number | null;
  saved: PageSaved;
  services: { key: string; label: string }[];
  portfolio: { key: string; url: string }[];
  photoCount: number;
  videoCount: number;
  /** null = could not be read. */
  reviews: { id: string; label: string }[] | null;
  /** 💬 The reviews themselves, for replying in place (owner 2026-11-06) — the same read as the pin options; null = not read. */
  replyRows: ReviewWithCouple[] | null;
  /** The reply list stops at REPLY_LIST_MAX — said under it, never silently. */
  replyCapped: boolean;
  /** ⭐ From guests (owner, 6 Nov) — its own labelled group under the hosts'. Three states; refused is said. */
  guestReviews: GuestReviewsRead;
  stories: { id: string; label: string }[] | null;
  domains: DomainRow[];
  domainsMeasured: boolean;
  /** The plan, for the ◆ asks the page decides (`vendorPaywallApplies`, in `page.tsx`). */
  tier: string | null;
  storeShell: boolean;
  plans: PagePlanLine[];
  /** 🏅 Awards and badges (`lib/shop-badges.ts`), read on every visit — nothing about a badge is stored. */
  badges: { summary: string; pills: ShopBadge[] };
};

type OwnRow = Record<string, unknown> & {
  tier_state?: string | null;
  verification_state?: string | null;
  outer_radius_km?: number | null;
};

const titleCase = (s: string) =>
  s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** What each plan adds to the page — composed from the plan table, never typed (`TIER_CAPS` is the one source). */
export function pagePlanLines(): PagePlanLine[] {
  // 📸 The photo count is the SAME free base on every plan (owner 2026-10-23), so it is said once, on Free — a plan
  // line never sells a photo count. Read from the table, never typed.
  const photos = `${TIER_CAPS.free.portfolioPhotos.toLocaleString('en-PH')} photos free`;
  return [
    { plan: 'Free', line: `Name · services · reviews · ${photos}`, pro: false },
    // 🌐 Your own web address sits on the first plan that has it — Solo since owner 2026-11-04 ("website applies to
    // solo as well"); read from `customWebsiteName`, never typed onto a line.
    { plan: 'Supplier Plus', line: `Your About · your colour · what shows${TIER_CAPS.solo.customWebsiteName ? ' · your own web address' : ''}`, pro: true },
    { plan: 'Supplier Pro', line: `A cover photo · a pinned review · stories${!TIER_CAPS.solo.customWebsiteName && TIER_CAPS.pro.customWebsiteName ? ' · your own web address' : ''}`, pro: true },
  ];
}

export async function loadPageData(supabase: SupabaseClient, profile: VendorProfileRow): Promise<PageData> {
  const vendorId = profile.vendor_profile_id;

  const ownRead = (async (): Promise<OwnRow | null> => {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select(`tier_state, verification_state, outer_radius_km, ${MICROSITE_COLUMNS}`)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    // ⚠ The page as it is published. Refused, the editor starts from the auto-composed defaults — said on the
    // ⚠ screen? No: logged, because the defaults ARE what couples see when these columns are empty.
    if (error) logQueryError('VendorPage.ownRow', error, { vendorId }, 'graceful_degrade');
    return (data as OwnRow | null) ?? null;
  })().catch((err) => {
    logQueryError('VendorPage.ownRow', err, { vendorId });
    return null;
  });

  const statsRead = fetchReviewStats(supabase, vendorId).catch((err) => {
    logQueryError('VendorPage.reviewStats', err, { vendorId });
    return undefined;
  });
  // 💬 ONE read for the pin picker (its first 20, as before) AND the reply-in-place list (owner 2026-11-06: Page ›
  // Reviews and stories = read + reply to reviews in place; the retired /reviews page read 200 the same way).
  const reviewsRead = (async () => {
    try {
      const rows = await fetchReviewsForVendorWithCouple(supabase, vendorId, { limit: REPLY_LIST_MAX, offset: 0 });
      const options = rows.slice(0, 20).map((r) => {
        const name = r.couple_display_name ?? 'A couple';
        const snippet = r.body ? `“${r.body.slice(0, 60)}${r.body.length > 60 ? '…' : ''}”` : `${r.rating_overall}★`;
        return { id: r.review_id, label: `${name} · ${snippet}` };
      });
      return { options, rows };
    } catch (err) {
      logQueryError('VendorPage.reviewOptions', err, { vendorId });
      return null;
    }
  })();
  // ⭐ FROM GUESTS — read on the service role, scoped to THIS shop (resolved above as the signed-in team's own): the
  // guest's name comes from the seat, which a supplier's session cannot read. Hidden rows stay out (admin-only).
  const guestReviewsRead: Promise<GuestReviewsRead> = readGuestReviewsForVendor(createAdminClient(), vendorId, {
    limit: REPLY_LIST_MAX,
  }).catch((err): GuestReviewsRead => {
    logQueryError('VendorPage.guestReviews', err, { vendorId });
    return { state: 'refused' };
  });
  const storiesRead = (async () => {
    try {
      const bookings = await fetchVendorPoolBookings(supabase, vendorId);
      const stories = await loadVendorFeaturedStories(bookings.map((b) => b.eventId));
      return stories.map((s) => ({
        id: s.eventId,
        label: [s.hostNames, [s.city, s.dateLabel].filter(Boolean).join(' · ')].filter(Boolean).join(' — '),
      }));
    } catch (err) {
      logQueryError('VendorPage.stories', err, { vendorId });
      return null;
    }
  })();
  const domainsRead = (async () => {
    const { data, error } = await supabase
      .from('custom_domains')
      .select('domain_id, domain, verified_at')
      .eq('owner_type', 'vendor')
      .order('created_at', { ascending: true });
    // ⚠ Their custom domains. Refused, the list would read as "none connected" while the domain keeps working.
    if (error) logQueryError('VendorPage.domains', error, {}, 'graceful_degrade');
    return {
      measured: !error && data !== null,
      rows: (data ?? []).map((d) => ({
        domain_id: d.domain_id as string,
        domain: d.domain as string,
        verified: Boolean(d.verified_at),
      })),
    };
  })().catch((err) => {
    logQueryError('VendorPage.domains', err, { vendorId });
    return { measured: false, rows: [] as DomainRow[] };
  });
  // 🏪 Show my page before verification: the shop's own choice (no session grant on the column — service role, this
  // shop's row only) and the bookings switch, together.
  const showRead = Promise.all([
    createAdminClient().from('vendor_profiles').select('self_published_at, is_demo').eq('vendor_profile_id', vendorId).maybeSingle(),
    areBookingsOpen(),
  ]).then(
    ([r, bookingsOpen]) => {
      if (r.error) {
        logQueryError('VendorPage.selfPublished', r.error, { vendorId }, 'graceful_degrade');
        return null;
      }
      const row = r.data as { self_published_at?: string | null; is_demo?: boolean | null } | null;
      return { selfPublishedAt: row?.self_published_at ?? null, isDemo: row?.is_demo === true, bookingsOpen };
    },
    (err) => {
      logQueryError('VendorPage.selfPublished', err, { vendorId });
      return null;
    },
  );
  const vocabRead = fetchVendorServicePickerVocab();
  const portfolioKeys = (profile.portfolio_r2_keys ?? []) as string[];
  const portfolioRead = Promise.all(
    portfolioKeys.map(async (key) => {
      try {
        const url = await displayUrlForStoredAsset(key);
        return url ? { key, url } : null;
      } catch (err) {
        // A short grid is visible on its own (the page knows how many photos it asked for); logged, not announced.
        logQueryError('VendorPage.portfolioThumb', err, { vendorId, key });
        return null;
      }
    }),
  ).then((xs) => xs.filter((x): x is { key: string; url: string } => x !== null));
  const shellRead = isStoreShellRequest();
  // 🏅 The badges' facts — the shop's own id, the service-role client (the public stats views + its own row).
  // Page keeps the pills only (owner 2026-11-06) — the tracker's extra read (couples not yet asked) is Analytics'.
  const badgesRead = readShopBadgeFacts(createAdminClient(), vendorId);
  // 📌 v13: "opened your page · 30 d" on the pinned row — one head count, the same store Analytics' funnel counts.
  const views30Read = (async (): Promise<number | null> => {
    const { count, error } = await supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('viewed_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (error) logQueryError('VendorPage.views30', error, { vendorId }, 'graceful_degrade');
    return error || count === null ? null : count;
  })().catch((err) => {
    logQueryError('VendorPage.views30', err, { vendorId });
    return null;
  });

  const [own, stats, reviews, stories, domains, vocab, portfolio, storeShell, badgeFacts, views30, guestReviews] = await Promise.all([
    ownRead,
    statsRead,
    reviewsRead,
    storiesRead,
    domainsRead,
    vocabRead,
    portfolioRead,
    shellRead,
    badgesRead,
    views30Read,
    guestReviewsRead,
  ]);

  const microsite = micrositeFromRow(own);
  const tier = own?.tier_state ?? null;
  // 🧹 RW-167: one row per service — an older spelling of the same key is not a second service.
  const services = distinctShopServices((profile.services ?? []) as string[], vocab.serviceLabels, titleCase);
  const slug = profile.business_slug ?? null;
  // The page opens for its own team whenever a stranger's not-found is not "closed" (lib/own-shop-preview.ts) — so
  // 👁 View my page works BEFORE couples can see it, which is the whole point of the button. This used to be
  // `isPubliclyVisible`, which greyed the button for every shop not yet listed: the very shops that need a preview.
  const visible = shopPageGate(
    { public_visibility: profile.public_visibility, verification_state: own?.verification_state ?? null },
    { isTeam: true, adminDemoMode: false },
  ).open !== 'nobody';
  const verifiedLive = isShopLive({ public_visibility: profile.public_visibility, verification_state: own?.verification_state ?? null });
  const show = await showRead;
  const gateRow = {
    public_visibility: profile.public_visibility,
    verification_state: own?.verification_state ?? null,
    is_demo: show?.isDemo ?? null,
    self_published_at: show?.selfPublishedAt ?? null,
  };
  const live = verifiedLive || (show !== null && selfPublishedLive(gateRow, show.bookingsOpen));
  const showBeforeVerified =
    show === null
      ? null
      : {
          offer: !verifiedLive && !show.bookingsOpen && selfPublishedLive({ ...gateRow, self_published_at: 'offer' }, false),
          shown: show.selfPublishedAt !== null,
        };

  const saved: PageSaved = pageSavedFrom(
    microsite,
    services.map((x) => x.key),
    portfolioKeys,
  );

  return {
    vendorId,
    businessName: profile.business_name ?? 'Your shop',
    slug,
    publicPath: slug ? `/${slug}` : null,
    live,
    // 🧪 The page is public and marked "(DEMO ONLY)" when the shop is a demo shop (owner 2026-11-06).
    isDemo: show?.isDemo === true,
    showBeforeVerified,
    visible,
    isVerified: profile.public_visibility === 'verified',
    kindWord: services[0]?.label ?? null,
    city: profile.location_city ?? null,
    outerRadiusKm: own?.outer_radius_km ?? null,
    yearsLabel: profile.in_business_since_year
      ? `${Math.max(0, new Date().getFullYear() - profile.in_business_since_year)} yrs in business`
      : null,
    rating: stats === undefined ? null : Number(stats?.avg_rating_overall ?? 0) || 0,
    reviewCount: stats === undefined ? null : Number(stats?.total_count ?? 0) || 0,
    views30,
    saved,
    services,
    portfolio,
    photoCount: portfolioKeys.length,
    videoCount: ((profile.gallery_video_links ?? []) as string[]).length,
    reviews: reviews?.options ?? null,
    replyRows: reviews?.rows ?? null,
    replyCapped: (reviews?.rows.length ?? 0) >= REPLY_LIST_MAX,
    guestReviews,
    stories,
    domains: domains.rows,
    domainsMeasured: domains.measured,
    tier,
    storeShell,
    plans: pagePlanLines(),
    badges: {
      summary: trackerSummary(badgeFacts),
      pills: shopBadges(badgeFacts),
    },
  };
}
