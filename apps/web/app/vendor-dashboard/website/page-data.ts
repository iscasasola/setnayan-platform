import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { MICROSITE_COLUMNS, micrositeCan, micrositeFromRow } from '@/lib/vendor-microsite';
import { isShopLive, isPubliclyVisible } from '@/lib/vendor-visibility';
import { fetchReviewStats, fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { tierCaps, asVendorTier, TIER_CAPS } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { pageSavedFrom, type PageSaved } from '@/lib/supplier-page-draft';
import type { DomainRow } from './actions';

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
export type PagePlanLine = { plan: string; line: string; pro: boolean };

export type PageData = {
  vendorId: string;
  businessName: string;
  slug: string | null;
  publicPath: string | null;
  /** Couples can see it (`isShopLive`) — the badge on the face says so either way. */
  live: boolean;
  /** The owner can open it (visible), even before couples can. */
  visible: boolean;
  isVerified: boolean;
  kindWord: string | null;
  city: string | null;
  outerRadiusKm: number | null;
  yearsLabel: string | null;
  rating: number | null;
  reviewCount: number | null;
  saved: PageSaved;
  services: { key: string; label: string }[];
  portfolio: { key: string; url: string }[];
  photoCount: number;
  videoCount: number;
  /** null = could not be read. */
  reviews: { id: string; label: string }[] | null;
  stories: { id: string; label: string }[] | null;
  domains: DomainRow[];
  domainsMeasured: boolean;
  personalizeAsks: boolean;
  proAsks: boolean;
  storeShell: boolean;
  plans: PagePlanLine[];
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
  const photos = (t: keyof typeof TIER_CAPS) => `up to ${TIER_CAPS[t].portfolioPhotos.toLocaleString('en-PH')} photos`;
  return [
    { plan: 'Free', line: `Name · services · reviews · ${photos('free')}`, pro: false },
    { plan: 'Solo', line: `Your About · your colour · what shows · ${photos('solo')}`, pro: true },
    { plan: 'Pro', line: `A cover photo · a pinned review · stories · ${photos('pro')}`, pro: true },
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
  })().catch(() => null);

  const statsRead = fetchReviewStats(supabase, vendorId).catch((err) => {
    logQueryError('VendorPage.reviewStats', err, { vendorId });
    return undefined;
  });
  const reviewsRead = fetchReviewsForVendorWithCouple(supabase, vendorId, { limit: 20, offset: 0 })
    .then((rows) =>
      rows.map((r) => {
        const name = r.couple_display_name ?? 'A couple';
        const snippet = r.body ? `“${r.body.slice(0, 60)}${r.body.length > 60 ? '…' : ''}”` : `${r.rating_overall}★`;
        return { id: r.review_id, label: `${name} · ${snippet}` };
      }),
    )
    .catch((err) => {
      logQueryError('VendorPage.reviewOptions', err, { vendorId });
      return null;
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
  })().catch(() => ({ measured: false, rows: [] as DomainRow[] }));
  const vocabRead = fetchVendorServicePickerVocab();
  const portfolioKeys = (profile.portfolio_r2_keys ?? []) as string[];
  const portfolioRead = Promise.all(
    portfolioKeys.map(async (key) => {
      try {
        const url = await displayUrlForStoredAsset(key);
        return url ? { key, url } : null;
      } catch {
        return null;
      }
    }),
  ).then((xs) => xs.filter((x): x is { key: string; url: string } => x !== null));
  const shellRead = isStoreShellRequest();

  const [own, stats, reviews, stories, domains, vocab, portfolio, storeShell] = await Promise.all([
    ownRead,
    statsRead,
    reviewsRead,
    storiesRead,
    domainsRead,
    vocabRead,
    portfolioRead,
    shellRead,
  ]);

  const microsite = micrositeFromRow(own);
  const tier = own?.tier_state ?? null;
  const services = ((profile.services ?? []) as string[]).map((key) => ({
    key,
    label: vocab.serviceLabels?.[key] ?? titleCase(key),
  }));
  const slug = profile.business_slug ?? null;
  const visible = isPubliclyVisible(profile.public_visibility ?? 'coming_soon');
  const live = isShopLive({ public_visibility: profile.public_visibility, verification_state: own?.verification_state ?? null });

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
    saved,
    services,
    portfolio,
    photoCount: portfolioKeys.length,
    videoCount: ((profile.gallery_video_links ?? []) as string[]).length,
    reviews,
    stories,
    domains: domains.rows,
    domainsMeasured: domains.measured,
    personalizeAsks: vendorPaywallApplies(micrositeCan(tier).canPersonalize) && !storeShell,
    proAsks: vendorPaywallApplies(tierCaps(asVendorTier(tier)).customWebsiteName) && !storeShell,
    storeShell,
    plans: pagePlanLines(),
  };
}
