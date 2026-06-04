import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Mail, Phone, Globe, MapPin, Star, Sparkles } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  displayServiceLabel,
  formatPhp,
  isCanonicalService,
  resolveVendorDisplayName,
  serviceGroupOf,
  VENDOR_PLACEHOLDER_PHOTO,
  type ServiceGroupKey,
  type VendorCategory,
} from '@/lib/vendors';
import {
  isBookable,
  isPubliclyVisible,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { fetchVendorServices, type VendorServiceRow } from '@/lib/vendor-services';
import { fetchUserEvents } from '@/lib/events';
import { isFollowingVendor } from '@/lib/follow';
import { FollowGate } from '@/app/_components/follow-gate';
import { PackageCard } from '@/app/_components/vendor-packages/package-card';
import { LockPackageModal } from '@/app/_components/vendor-packages/lock-modal';
import type {
  VendorPackageItemRow,
  VendorPackageRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { SaveVendorButton } from '@/app/vendors/_components/save-vendor-button';
import { NavLinksRow } from '@/app/_components/nav-links';
import {
  fetchReviewsForVendorWithCouple,
  fetchReviewStats,
  formatStarRating,
  REVIEW_AXIS_LABEL,
  type ReviewAxis,
  type ReviewWithCouple,
  type ReviewStatsRow,
} from '@/lib/reviews';
import {
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
import {
  fetchVendorServiceAttributes,
  fetchSchemaWithSharedGroups,
} from '@/lib/vendor-service-attributes';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';
import { displayUrlForStoredAsset } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const REVIEWS_PAGE_SIZE = 5;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviewsPage?: string }>;
};

type PublicVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  portfolio_r2_keys: string[] | null;
  services: string[];
  location_city: string | null;
  hq_address: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  public_visibility: VendorPublicVisibility;
  compatible_ceremony_types: string[] | null;
  compatible_venue_settings: string[] | null;
  // PR brief 2026-05-22 evening — marketplace simulation workstream.
  // `is_demo` is added to `vendors` by Agent 1's PR. Defensive: nullable
  // + treated as FALSE when null so this PR keeps building if Agent 1's
  // column hasn't been merged yet. The actual `is_demo IS NOT TRUE` filter
  // on visibility lives below (see `isDemoVendor`).
  is_demo?: boolean | null;
  // V2.1 brief amendment #2 (locked 2026-05-30 · CLAUDE.md row
  // "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
  // [[project_setnayan_vendor_hybrid_anonymity]]). NULL = the vendor's
  // business_name is hidden in the microsite hero, page title, and
  // LocalBusiness JSON-LD name field; surfaces render the anonymized
  // taxonomy + city placeholder via `resolveVendorDisplayName` in
  // lib/vendors.ts. Non-NULL = name globally revealed (DB trigger
  // `reveal_vendor_name_on_chat` stamps on first vendor chat reply ·
  // PR #662 / migration 20260530010000). Pro + Enterprise vendors are
  // also revealed via the app-layer `isPaidTier` flag but no
  // subscription join exists here yet; placeholder still only renders
  // while name_revealed_at IS NULL so once any Pro+ vendor sends a
  // reply the real name surfaces unchanged.
  name_revealed_at?: string | null;
  // CLAUDE.md 2026-05-30 refinement row · screen_name. Bark-format
  // stored anonymized name like "Manila Wedding Photographer #4218".
  // Generated at signup by `generate_screen_name_for_vendor()` (migration
  // `20260714000000`) for Free + Verified non-venue vendors · venue-
  // exempt vendors (services overlap with religious_venue / venue) get
  // NULL screen_name on purpose since they always show real
  // business_name regardless. When present, `resolveVendorDisplayName`
  // returns this as the placeholder instead of computing the legacy
  // "service · city" string.
  screen_name?: string | null;
};

// Iteration 0043 — labels for wedding-type compatibility badges rendered on
// the public vendor profile. Mirror the vendor-dashboard editor labels so
// the badge text matches what the vendor saw when they ticked the box.
const CEREMONY_TYPE_LABELS: Readonly<Record<string, string>> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  mixed: 'Mixed / interfaith',
};

const VENUE_SETTING_LABELS: Readonly<Record<string, string>> = {
  banquet_hall: 'Banquet hall',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination',
  heritage: 'Heritage',
  outdoor_tent: 'Outdoor tent',
  civil_registrar: 'Civil registrar',
};

/**
 * Resolve whether the current request belongs to an admin session that
 * has demo mode turned on. Cheap (single auth + single users select),
 * but only called once per /v/[slug] render — wrapped to keep the
 * page body readable.
 *
 * Returns `false` for unauthenticated visitors AND for authenticated
 * non-admins, even if the demo-mode cookie is present. The cookie is
 * never the source of truth on its own — admin status is.
 */
async function isAdminInDemoMode(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value !== '1') return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return isAdminProfile(profile);
}

async function fetchVendor(slug: string): Promise<PublicVendorRow | null> {
  const admin = createAdminClient();
  // The `is_demo` column ships in a parallel PR (marketplace simulation
  // workstream, Agent 1). If that PR hasn't landed yet on `main`,
  // requesting the column returns a PostgREST error. We try with the
  // column first and fall back to the legacy select — keeps this PR
  // mergeable in either order. Once both PRs are on main the fallback
  // path is dormant.
  /* V2.1 brief amendment #2 (2026-05-30): bundle `name_revealed_at`
     into the FULL select so the microsite resolves hybrid-anonymity
     in a single fetch. The column ships pre-pilot via PR #662 /
     migration 20260530010000 · the existing legacy fallback already
     handles pre-`is_demo` deploys, and the new column lands in the
     same migration window so any failure mode that surfaces an
     "undefined column name_revealed_at" message routes through the
     same legacy path with a NULL default (= hidden, which is the
     conservative behavior). */
  // CLAUDE.md 2026-05-30 refinement row · screen_name added to the full
  // select. Generated at signup by `generate_screen_name_for_vendor()`
  // (migration `20260714000000`) + persists forever once stamped. When
  // present, `resolveVendorDisplayName` surfaces this Bark-format
  // stable identifier ("Manila Wedding Photographer #4218") instead of
  // computing the legacy "service · city" placeholder on every render.
  // The fallback regex below extends to detect `screen_name` undefined-
  // column errors too · routes through the legacy select path with
  // screen_name silently null (resolver falls back to computed
  // placeholder).
  const fullSelect =
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,portfolio_r2_keys,services,location_city,hq_address,hq_latitude,hq_longitude,website,contact_email,contact_phone,public_visibility,compatible_ceremony_types,compatible_venue_settings,is_demo,name_revealed_at,screen_name';
  const legacySelect =
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,portfolio_r2_keys,services,location_city,hq_address,hq_latitude,hq_longitude,website,contact_email,contact_phone,public_visibility,compatible_ceremony_types,compatible_venue_settings';

  let { data, error } = await admin
    .from('vendor_profiles')
    .select(fullSelect)
    .ilike('business_slug', slug)
    .maybeSingle();
  if (error && /(is_demo|name_revealed_at|screen_name)/i.test(error.message)) {
    ({ data } = await admin
      .from('vendor_profiles')
      .select(legacySelect)
      .ilike('business_slug', slug)
      .maybeSingle());
  }
  return (data ?? null) as PublicVendorRow | null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  if (!vendor || !isPubliclyVisible(vendor.public_visibility)) {
    return { title: 'Setnayan vendor' };
  }
  // Demo vendors are admin-only. Don't leak their business name in
  // metadata to crawlers / link previews — generic title only. Admins
  // in demo mode still see the real page title on the dashboard tab
  // because the page itself sets `metadata` per render via the
  // surrounding header text.
  if (vendor.is_demo === true) {
    return { title: 'Setnayan vendor' };
  }
  const suffix = vendor.public_visibility === 'coming_soon' ? ' · Coming soon' : '';
  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  const canonicalUrl = `${siteUrl}/v/${vendor.business_slug ?? slug}`;
  /* V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity in
     metadata. Page title + description + OG card all consume the
     resolved display label so search engines + social previews
     extract the safe placeholder (e.g., "Manila Wedding Photographer
     · Manila") while the vendor's name is hidden, and the real
     business_name once revealed. */
  const displayLabel = resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at ?? null,
    primary_canonical_service: vendor.services?.[0] ?? null,
    location_city: vendor.location_city,
    // CLAUDE.md 2026-05-30 refinement row: pass services + screen_name
    // so the venue exception (services overlap with religious_venue /
    // venue) applies AND the stored Bark-format screen_name surfaces
    // when present (e.g., "Manila Wedding Photographer #4218") instead
    // of the legacy computed "service · city" placeholder. Both
    // optional · null-safe · vendor type from generateMetadata loads
    // them post-this-PR (see microsite vendor query below).
    services: vendor.services ?? null,
    screen_name: vendor.screen_name ?? null,
  });
  const titleText = `${displayLabel} · Setnayan vendor${suffix}`;
  const descText = vendor.tagline ?? `${displayLabel} on Setnayan.`;
  // SEO/GEO Bucket 4 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — extend the
  // base metadata from PR #573 with canonical URL + OpenGraph profile card
  // + Twitter summary_large_image so social shares of a vendor profile
  // render with the vendor's logo + name instead of the layout-default
  // /brand/og-card.webp. Falls back to logo_url when present; layout-level
  // og:image (Bucket 2 PR #607) covers the no-logo case.
  return {
    title: titleText,
    description: descText,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'profile',
      url: canonicalUrl,
      title: titleText,
      description: descText,
      siteName: 'Setnayan',
      locale: 'en_PH',
      ...(vendor.logo_url
        ? {
            images: [
              {
                url: vendor.logo_url,
                /* Hybrid-anonymity (V2.1 amendment #2): alt text uses
                   the resolved display label so social previews don't
                   leak a hidden business_name via crawler-friendly alt. */
                alt: `${displayLabel} logo`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description: descText,
      ...(vendor.logo_url ? { images: [vendor.logo_url] } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Iteration 0044 — per-category attribute display + portfolio gallery.
// Surfaces the vendor's filled vendor_service_attributes (the "details &
// customization" they declared per category) + their portfolio images on the
// public profile. Best-effort: the table / column may be unapplied in a given
// deploy env, so both fetchers swallow errors and degrade to empty.
// ---------------------------------------------------------------------------

type AttrDetailGroup = {
  canonicalService: string;
  displayName: string;
  /** Non-boolean fields rendered as label → value. */
  facts: Array<{ label: string; value: string }>;
  /** True booleans rendered as capability chips. */
  flags: string[];
};

// pricing_signal shared-group keys — redundant with the Packages section + the
// marketplace price filter, so they're omitted from the Details list.
const DETAIL_SKIP_KEYS = new Set<string>([
  'starting_price_centavos',
  'typical_range_min_centavos',
  'typical_range_max_centavos',
  'price_model',
  'show_prices_publicly',
]);

function humanizeAttrLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeAttrToken(token: string): string {
  if (/^https?:\/\//i.test(token)) return token;
  return token.replace(/_/g, ' ');
}

function formatAttrFactValue(
  key: string,
  raw: unknown,
): string | null {
  if (Array.isArray(raw)) {
    const parts = raw
      .map((v) => humanizeAttrToken(String(v)))
      .filter((v) => v.length > 0);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof raw === 'number') {
    return /centavos/i.test(key)
      ? `₱${Math.round(raw / 100).toLocaleString('en-PH')}`
      : String(raw);
  }
  if (typeof raw === 'string') {
    return raw.trim().length > 0 ? humanizeAttrToken(raw) : null;
  }
  return null;
}

async function fetchVendorAttributeDetails(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<AttrDetailGroup[]> {
  try {
    const rows = await fetchVendorServiceAttributes(admin, vendorProfileId);
    const groups: AttrDetailGroup[] = [];
    for (const row of rows) {
      const payload = (row.attribute_payload ?? {}) as Record<string, unknown>;
      if (Object.keys(payload).length === 0) continue;
      const schema = await fetchSchemaWithSharedGroups(admin, row.canonical_service);
      if (!schema) continue;
      const facts: Array<{ label: string; value: string }> = [];
      const flags: string[] = [];
      for (const [key, def] of Object.entries(schema.fields)) {
        if (DETAIL_SKIP_KEYS.has(key) || key.endsWith('_urls')) continue;
        const raw = payload[key];
        if (raw === null || raw === undefined) continue;
        const label = def.label ?? humanizeAttrLabel(key);
        if (def.type === 'boolean') {
          if (raw === true) flags.push(label);
          continue;
        }
        const value = formatAttrFactValue(key, raw);
        if (value) facts.push({ label, value });
      }
      if (facts.length > 0 || flags.length > 0) {
        groups.push({
          canonicalService: row.canonical_service,
          displayName:
            schema.display_name_en || displayServiceLabel(row.canonical_service),
          facts,
          flags,
        });
      }
    }
    return groups;
  } catch {
    return [];
  }
}

async function resolvePortfolioUrls(keys: string[] | null): Promise<string[]> {
  if (!keys || keys.length === 0) return [];
  try {
    const resolved = await Promise.all(
      keys.slice(0, 12).map((k) => displayUrlForStoredAsset(k)),
    );
    return resolved.filter((u): u is string => Boolean(u));
  } catch {
    return [];
  }
}

export default async function PublicVendorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const vendor = await fetchVendor(slug);
  // Hidden + archived vendors 404 from the public surface (don't leak the
  // existence of suspended / closed profiles). Coming-soon + verified render.
  if (!vendor || !isPubliclyVisible(vendor.public_visibility)) notFound();

  // PR brief 2026-05-22 evening — demo vendor gate. A vendor with
  // `is_demo=TRUE` only renders on /v/[slug] when the requesting
  // session is an admin AND demo mode is on. Non-demo vendors are
  // unaffected. Defensive null-coalesce: if Agent 1's `is_demo`
  // column hasn't shipped yet, every vendor reads as non-demo (false),
  // which is the conservative outcome that preserves current behavior.
  const isDemoVendor = vendor.is_demo === true;
  const inDemoMode = await isAdminInDemoMode();
  if (isDemoVendor && !inDemoMode) notFound();

  const visibility = parseVisibility(vendor.public_visibility);
  const bookable = isBookable(visibility);
  const isComingSoon = visibility === 'coming_soon';

  const pageRaw = Number(search.reviewsPage ?? '1');
  const reviewsPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = reviewsPage * REVIEWS_PAGE_SIZE;

  const admin = createAdminClient();
  const [reviewStats, reviews, allServices, vendorPackages] = await Promise.all([
    fetchReviewStats(admin, vendor.vendor_profile_id),
    fetchReviewsForVendorWithCouple(admin, vendor.vendor_profile_id, { limit, offset: 0 }),
    fetchVendorServices(admin, vendor.vendor_profile_id),
    // Vendor packages (owner directive 2026-05-22) — bundled multi-category
    // wedding offerings. Public-read via RLS when is_active=TRUE. The fetch
    // is best-effort: if the table doesn't exist yet in a deploy environment
    // (migration unapplied), the catch returns [] and the page renders
    // without the Packages section.
    fetchVendorPackagesWithItems(admin, vendor.vendor_profile_id),
  ]);
  const hasMore = reviewStats.total_count > reviews.length;
  const activeServices = allServices.filter((s) => s.is_active);

  // Per-category attribute details + portfolio gallery (iteration 0044).
  const [attributeDetails, portfolioUrls] = await Promise.all([
    fetchVendorAttributeDetails(admin, vendor.vendor_profile_id),
    resolvePortfolioUrls(vendor.portfolio_r2_keys),
  ]);

  /* V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity. Resolves
     once at the page level so the hero, "Get in touch" copy,
     LocalBusiness JSON-LD's `name` field, BreadcrumbList's leaf
     label, and the FollowGate vendorName all surface the same
     display label. Real business_name when the column says revealed
     (or when the vendor's a paid tier · no subscription join here
     yet, so isPaidTier=false today; the placeholder still only
     renders while name_revealed_at IS NULL so a Pro+ vendor's name
     reveals the moment they reply). */
  const displayLabel = resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at ?? null,
    primary_canonical_service: vendor.services?.[0] ?? null,
    location_city: vendor.location_city,
    // CLAUDE.md 2026-05-30 refinement row · pass services + screen_name
    // (Bark-format stored anonymized name from `vendor_profiles.screen_name`
    // per migration `20260714000000`). Venue exception fires when services
    // overlap with ['religious_venue', 'venue'] → real business_name.
    // Stored screen_name surfaces when present instead of the legacy
    // computed taxonomy-and-city placeholder.
    services: vendor.services ?? null,
    screen_name: vendor.screen_name ?? null,
  });

  // Resolve viewer state for the FollowGate (iteration 0019 § Gate). Public
  // page so the supabase client may have no user; that's fine — the gate
  // renders a "Sign in to follow" CTA in that case.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let initialFollowing = false;
  let coupleEventId: string | null = null;
  let isAlreadySaved = false;
  if (user) {
    initialFollowing = await isFollowingVendor(supabase, user.id, vendor.vendor_profile_id);
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = events[0]?.event_id ?? null;
    if (coupleEventId) {
      const { data: saved } = await supabase
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', coupleEventId)
        .eq('marketplace_vendor_id', vendor.vendor_profile_id)
        .maybeSingle();
      isAlreadySaved = Boolean(saved?.vendor_id);
    }
  }

  // GEO Phase G4 (2026-05-28) — LocalBusiness JSON-LD lets AI answer engines
  // (ChatGPT-User · OAI-SearchBot · PerplexityBot · ClaudeBot — allowlisted
  // via robots.txt per CLAUDE.md 2026-05-14 SEO playbook) extract the
  // vendor's name, city, services, aggregate rating, and active packages
  // directly when responding to "find me a wedding photographer in Manila"
  // style queries. The schema mirrors only what's visibly on the page —
  // honest-state rule per [[feedback_setnayan_no_dev_text_post_launch]] +
  // no aggregateRating block when total_count is 0, no makesOffer entries
  // for inactive packages. RA 10173: address is city-level only (no street
  // number leaked to crawlers).
  const SITE_URL = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');

  const vendorJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${SITE_URL}/v/${slug}#business`,
    /* V2.1 brief amendment #2 (2026-05-30): emit the hybrid-anonymity
       display label so AI engines + Google extract the safe
       placeholder ("Manila Wedding Photographer · Manila") while the
       business_name is hidden — not the real name. Once revealed,
       the real business_name surfaces unchanged. */
    name: displayLabel,
    url: `${SITE_URL}/v/${slug}`,
    description: vendor.tagline ?? `${displayLabel} on Setnayan.`,
    image: vendor.logo_url ?? `${SITE_URL}/icon-512.svg`,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PH',
      ...(vendor.location_city ? { addressLocality: vendor.location_city } : {}),
    },
    areaServed: { '@type': 'Country', name: 'Philippines' },
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
    },
  };

  // Vendor services — surface canonical_service strings as `knowsAbout`
  // entries so AI engines can match the vendor against category queries.
  // Maps the enum key to its human-readable label when recognized.
  if (Array.isArray(vendor.services) && vendor.services.length > 0) {
    vendorJsonLd.knowsAbout = vendor.services.map((s: string) =>
      isCanonicalService(s) ? displayServiceLabel(s) : s,
    );
  }

  // Aggregate rating ONLY when real reviews exist. Never invent ratings.
  if (reviewStats.total_count > 0 && reviewStats.avg_rating_overall > 0) {
    vendorJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(reviewStats.avg_rating_overall.toFixed(2)),
      reviewCount: reviewStats.total_count,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // makesOffer — one Offer per vendor_package with a price. Pesos as the
  // major currency unit per schema.org (NOT centavos). Skips packages
  // missing a price so AI engines don't see ₱0 phantom offers.
  const offerPackages = vendorPackages.filter(
    (pkg) => typeof pkg.total_price_centavos === 'number' && pkg.total_price_centavos > 0,
  );
  if (offerPackages.length > 0) {
    vendorJsonLd.makesOffer = offerPackages.map((pkg) => ({
      '@type': 'Offer',
      name: pkg.package_name,
      ...(pkg.description ? { description: pkg.description } : {}),
      price: String(Math.round(pkg.total_price_centavos / 100)),
      priceCurrency: 'PHP',
    }));
  }

  // SEO/GEO Bucket 4 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — explicit
  // OfferCatalog wrapping the vendor's canonical_service entries. Mirrors
  // the lighter `knowsAbout` array (kept above for AI-engine entity
  // extraction) but uses Schema.org's marketplace-native structure:
  // OfferCatalog → Offer → Service, each linked back to the vendor as
  // provider. Lets Google + AI engines answer "does {vendor} do X?" with
  // structured precision instead of fuzzy string match.
  if (Array.isArray(vendor.services) && vendor.services.length > 0) {
    vendorJsonLd.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      /* Hybrid-anonymity (V2.1 amendment #2): the OfferCatalog's
         own `name` field uses the display label so a hidden vendor
         doesn't leak its real business_name through the structured
         data tree. */
      name: `${displayLabel} services`,
      itemListElement: vendor.services.map((s: string, i: number) => ({
        '@type': 'Offer',
        position: i + 1,
        itemOffered: {
          '@type': 'Service',
          name: isCanonicalService(s) ? displayServiceLabel(s) : s,
          provider: { '@id': `${SITE_URL}/v/${slug}#business` },
        },
      })),
    };
  }

  // SEO/GEO Bucket 4 — BreadcrumbList JSON-LD. 3-level trail
  // (Home → Wedding vendors → {vendor name}). Google surfaces breadcrumb
  // trails in SERP under the result title, lifting CTR. The 4th level
  // (category) is intentionally omitted — vendor.services[0] is the
  // closest proxy but adds parsing complexity and risks misrepresenting
  // multi-category vendors. 3 levels is the canonical breadcrumb depth
  // for marketplace listings (Yelp, Amazon, Etsy all ship 3-level for
  // seller pages).
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Wedding vendors',
        item: `${SITE_URL}/vendors`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        /* Hybrid-anonymity (V2.1 amendment #2): breadcrumb leaf label
           uses the display label so SERP breadcrumbs surface the safe
           placeholder while the name is hidden. */
        name: displayLabel,
        item: `${SITE_URL}/v/${slug}`,
      },
    ],
  };

  return (
    <main className="min-h-dvh bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* v2.1 visual treatment per CLAUDE-CODE-BRIEF-v2.1 § 8 design
              system. Wordmark from @/app/_components/brand-marks is the
              canonical brand mark across /, /for-vendors, /login, /signup,
              /vendors, and all dashboard chromes after V2 cutover Phase B
              (PRs #560-#564 + #572-#580). Matches the marketplace overlay
              pattern from PR #580. */}
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Return to Dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Plan with Setnayan
            </Link>
          )}
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {isDemoVendor ? <DemoVendorBanner /> : null}
        {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): pass the
            resolved display label so the ComingSoon banner copy + Logo
            initial fallback + alt text all surface the safe placeholder
            while the vendor's name is hidden. */}
        {isComingSoon ? <ComingSoonBanner vendorName={displayLabel} /> : null}
        {/* Owner directive: a vendor with no photo for their service still
            shows at least a generic placeholder photo. With no portfolio, a
            hero banner renders the bundled placeholder so the page never looks
            empty. Vendors WITH portfolio photos show those in the gallery
            below (no banner needed). */}
        {portfolioUrls.length === 0 ? (
          <div className="relative mb-6 h-44 w-full overflow-hidden rounded-2xl bg-ink/5 sm:h-56 lg:h-64">
            <Image
              src={VENDOR_PLACEHOLDER_PHOTO}
              alt={displayLabel}
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : null}
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <Logo logoUrl={vendor.logo_url} name={displayLabel} />
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Setnayan vendor
            </p>
            {/* v2.1 visual treatment per CLAUDE-CODE-BRIEF-v2.1 § 8 design
                system + /tmp/setnayan-keynote-template/components/vendor-
                microsite.jsx hero typography. Italic-serif headline matches
                the homepage + /for-vendors + /vendors marketplace headline
                rhythm (PR #580 lineage). Cream + ink + terracotta tokens
                unchanged. Business name stays the visual anchor — v2.1
                publisher posture means real vendor names are always visible
                (CLAUDE.md 2026-05-28 tenth row § 1 explicitly retires the
                Path B lead-broker anonymization from CLAUDE.md seventh row).

                V2.1 brief amendment #2 (CLAUDE.md 2026-05-30 row
                "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d)) re-introduces
                a hybrid mechanic for Free + Verified vendors ONLY:
                business_name is hidden until the vendor sends their
                first chat reply (DB trigger reveal_vendor_name_on_chat
                stamps `name_revealed_at` on first reply · PR #662 /
                migration 20260530010000). The render below now
                consumes `displayLabel` from the page-level
                resolveVendorDisplayName call so the hero surfaces the
                taxonomy + city placeholder during the hidden window
                and the real business_name once revealed. */}
            <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl">
              {displayLabel}
            </h1>
            {vendor.tagline ? (
              <p className="text-base text-ink/70">{vendor.tagline}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              {vendor.location_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.location_city}
                </span>
              ) : null}
              {/* Contact links surface only for verified (bookable) vendors —
                  coming-soon profiles are read-only previews per 0022 § 2.1c. */}
              {bookable && vendor.contact_email ? (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_email}
                </a>
              ) : null}
              {bookable && vendor.contact_phone ? (
                <a
                  href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_phone}
                </a>
              ) : null}
              {vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Website
                </a>
              ) : null}
            </div>
            {bookable ? (
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <FollowGate
                  vendorProfileId={vendor.vendor_profile_id}
                  /* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30):
                     FollowGate's "Follow {name}" copy uses the
                     display label so hidden vendors surface as
                     "Follow Manila Wedding Photographer · Manila"
                     instead of leaking the real business_name. */
                  vendorName={displayLabel}
                  vendorEmail={vendor.contact_email}
                  isAuthenticated={user !== null}
                  initialFollowing={initialFollowing}
                  eventId={coupleEventId}
                  revalidatePath={`/v/${slug}`}
                />
                {/* Save-to-picks (2026-05-20). Only surfaced for logged-in
                    couples with at least one event; the button hides
                    itself otherwise via canSave. */}
                <SaveVendorButton
                  vendorProfileId={vendor.vendor_profile_id}
                  initiallySaved={isAlreadySaved}
                  canSave={user !== null && coupleEventId !== null}
                  variant="profile"
                />
              </div>
            ) : null}
            {/* Nav deep-links (2026-05-21). Renders Google Maps · Waze ·
                Apple Maps when the vendor has hq_lat/lng. Falls back to
                a single Google Maps text-search when only the address
                is set. Hidden entirely when neither exists. */}
            <NavLinksRow
              latitude={vendor.hq_latitude}
              longitude={vendor.hq_longitude}
              addressFallback={vendor.hq_address ?? vendor.location_city ?? null}
            />
          </div>
        </section>

        {portfolioUrls.length > 0 ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Portfolio
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {portfolioUrls.map((url, idx) => (
                <div
                  key={url}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
                >
                  <Image
                    src={url}
                    alt={`${displayLabel} portfolio ${idx + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {vendor.services.length > 0 ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Services offered
            </h2>
            <ul className="flex flex-wrap gap-2">
              {vendor.services.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700"
                >
                  {displayServiceLabel(s)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {attributeDetails.length > 0 ? (
          <section className="space-y-6 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Details
            </h2>
            <div className="space-y-6">
              {attributeDetails.map((group) => (
                <div key={group.canonicalService} className="space-y-3">
                  <h3 className="text-sm font-medium text-ink">{group.displayName}</h3>
                  {group.flags.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {group.flags.map((flag) => (
                        <li
                          key={flag}
                          className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70"
                        >
                          {flag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {group.facts.length > 0 ? (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                      {group.facts.map((fact) => (
                        <div key={fact.label} className="flex flex-col">
                          <dt className="text-xs uppercase tracking-wide text-ink/45">
                            {fact.label}
                          </dt>
                          <dd className="text-sm text-ink/80">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {(vendor.compatible_ceremony_types && vendor.compatible_ceremony_types.length > 0) ||
        (vendor.compatible_venue_settings && vendor.compatible_venue_settings.length > 0) ? (
          <section className="space-y-4 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Wedding compatibility
            </h2>
            {vendor.compatible_ceremony_types && vendor.compatible_ceremony_types.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Ceremonies
                </p>
                <ul className="flex flex-wrap gap-2">
                  {vendor.compatible_ceremony_types.map((ct) => (
                    <li
                      key={ct}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                    >
                      {CEREMONY_TYPE_LABELS[ct] ?? ct}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vendor.compatible_venue_settings && vendor.compatible_venue_settings.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Venues
                </p>
                <ul className="flex flex-wrap gap-2">
                  {vendor.compatible_venue_settings.map((v) => (
                    <li
                      key={v}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                    >
                      {VENUE_SETTING_LABELS[v] ?? v.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeServices.length > 0 ? (
          /* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
             the services section's section heading + per-service
             cards' "by {vendor}" copy don't leak the hidden name. */
          <ServicesPricingSection
            services={activeServices}
            businessName={displayLabel}
          />
        ) : null}

        {/* Vendor packages (owner directive 2026-05-22) — bundled multi-
            category offerings. Hotels sell their "wedding package" SKU
            here; locking one cascade-locks every included planning-card
            category. Public read; the LockPackageModal CTA only renders
            for signed-in hosts with an active event. */}
        {vendorPackages.length > 0 ? (
          <VendorPackagesSection
            packages={vendorPackages}
            coupleEventId={coupleEventId}
            isComingSoon={isComingSoon}
          />
        ) : null}

        {/* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
            the reviews section heading + per-review attribution
            ("review of {vendor}") render the placeholder while
            hidden, and the real business_name once revealed. */}
        <ReviewsSection
          slug={slug}
          businessName={displayLabel}
          reviewStats={reviewStats}
          reviews={reviews}
          hasMore={hasMore}
          nextPage={reviewsPage + 1}
        />

        <section className="space-y-4 py-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {bookable ? 'Get in touch' : 'Not yet bookable'}
          </h2>
          <p className="max-w-2xl text-sm text-ink/65">
            {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30):
                "Get in touch" copy uses displayLabel so a hidden
                vendor surfaces as e.g. "Manila Wedding Photographer"
                instead of leaking the real name through the
                contact-info section. */}
            {bookable ? (
              vendor.contact_email ? (
                <>
                  Already a Setnayan couple? Start a thread directly with{' '}
                  <span className="font-medium text-ink">{displayLabel}</span> from
                  your dashboard using the contact email above. Identity stays masked
                  until you choose to share.
                </>
              ) : (
                <>
                  {displayLabel} is on Setnayan but hasn&rsquo;t published a contact
                  email yet. Check back soon.
                </>
              )
            ) : (
              <>
                <span className="font-medium text-ink">{displayLabel}</span> has set
                up their Setnayan profile but is still completing verification. Bookings
                will open as soon as the Setnayan Team finishes their review.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary">
              Plan with Setnayan
            </Link>
            <Link href="/" className="button-secondary">
              Back to home
            </Link>
          </div>
        </section>

        <footer className="border-t border-ink/10 pt-6 text-xs text-ink/50">
          <p>Vendor ID · <span className="font-mono">{vendor.public_id}</span></p>
        </footer>
      </article>
    </main>
  );
}

function ComingSoonBanner({ vendorName }: { vendorName: string }) {
  return (
    <section
      aria-label="Coming soon"
      className="mb-8 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.04] p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        Coming soon
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {vendorName} is verifying their Setnayan account.
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/65">
        Their profile is a read-only preview while the Setnayan Team completes
        verification. Bookings open as soon as that&rsquo;s done.
      </p>
    </section>
  );
}

/**
 * Visible only to admins in demo mode — the gate above this banner
 * 404s for non-admins, so when this banner renders the viewer already
 * has admin grants AND the demo cookie set. Marks the profile as
 * synthetic so the admin doesn't mistake it for a real onboarded
 * vendor. Brand-voice copy per `feedback_setnayan_no_dev_text_post_launch`.
 */
function DemoVendorBanner() {
  return (
    <section
      aria-label="Demo vendor"
      className="mb-8 rounded-2xl border border-amber-300/70 bg-amber-50 p-5"
    >
      <div className="flex items-start gap-3">
        <Sparkles
          aria-hidden
          className="mt-0.5 h-4 w-4 text-amber-700"
          strokeWidth={1.75}
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">
            Demo vendor
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-amber-900">
            This profile is synthetic — visible only to admins in demo mode.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-amber-900/85">
            Pricing renders publicly here so admins can dogfood how the page
            would feel if the 2026-05-16 hide-prices lock were lifted. Real
            vendors stay private to the apply/register flow.
          </p>
        </div>
      </div>
    </section>
  );
}

function Logo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt={name}
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}

function ServicesPricingSection({
  services,
  businessName,
}: {
  services: ReadonlyArray<VendorServiceRow>;
  businessName: string;
}) {
  const byGroup = new Map<ServiceGroupKey, VendorServiceRow[]>();
  for (const s of services) {
    const key: ServiceGroupKey = isCanonicalService(s.category)
      ? serviceGroupOf(s.category as VendorCategory)
      : 'other';
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(s);
    else byGroup.set(key, [s]);
  }

  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
      <header className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Services &amp; pricing
        </h2>
        <p className="text-sm text-ink/65">
          Starting prices set by {businessName}. Final quotes happen in chat.
        </p>
      </header>
      <div className="space-y-5">
        {SERVICE_GROUPS.map((group) => {
          const rows = byGroup.get(group.key);
          if (!rows || rows.length === 0) return null;
          return (
            <div key={group.key} className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {group.label}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {rows.map((s) => (
                  <li key={s.vendor_service_id}>
                    <ServiceRow row={s} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ServiceRow({ row }: { row: VendorServiceRow }) {
  const label = isCanonicalService(row.category)
    ? VENDOR_CATEGORY_LABEL[row.category as VendorCategory]
    : row.category;
  const priceLabel =
    row.starting_price_php !== null && row.starting_price_php > 0
      ? `from ${formatPhp(row.starting_price_php)}`
      : 'Inquire';
  const crewParts: string[] = [];
  if (row.crew_size !== null && row.crew_size > 0) {
    crewParts.push(`${row.crew_size} crew on-site`);
  }
  if (row.crew_meal_required) {
    crewParts.push('crew meal required');
  }
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-ink">{label}</p>
        <p className="font-mono text-sm text-ink/80">{priceLabel}</p>
      </div>
      {crewParts.length > 0 ? (
        <p className="mt-1 text-[12px] text-ink/55">{crewParts.join(' · ')}</p>
      ) : null}
    </div>
  );
}

function ReviewsSection({
  slug,
  businessName,
  reviewStats,
  reviews,
  hasMore,
  nextPage,
}: {
  slug: string;
  businessName: string;
  reviewStats: ReviewStatsRow;
  reviews: ReadonlyArray<ReviewWithCouple>;
  hasMore: boolean;
  nextPage: number;
}) {
  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Reviews
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            From verified couples who&rsquo;ve booked {businessName} via Setnayan.
          </p>
        </div>
      </header>

      <ReviewHeroMetrics stats={reviewStats} />

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6">
          <p className="text-sm text-ink/65">This vendor still has no review.</p>
          <p className="mt-1 text-xs text-ink/45">
            Bookings through Setnayan generate a review request 24 hours after
            the event.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <ReviewRow review={r} />
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="pt-2">
          <Link
            href={`/v/${slug}?reviewsPage=${nextPage}#reviews`}
            className="button-secondary inline-flex h-10 px-4"
          >
            Show more reviews
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function ReviewHeroMetrics({ stats }: { stats: ReviewStatsRow }) {
  const hero = stats.avg_rating_overall;
  const totals: Array<{ star: 5 | 4 | 3 | 2 | 1; count: number }> = [
    { star: 5, count: stats.count_5_star },
    { star: 4, count: stats.count_4_star },
    { star: 3, count: stats.count_3_star },
    { star: 2, count: stats.count_2_star },
    { star: 1, count: stats.count_1_star },
  ];
  const max = Math.max(1, ...totals.map((t) => t.count));

  return (
    <div className="grid gap-6 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          <Star
            className={`h-6 w-6 ${hero > 0 ? 'fill-amber-400 text-amber-500' : 'text-ink/25'}`}
            strokeWidth={1.5}
          />
          <span className="text-3xl font-semibold text-ink">
            {hero > 0 ? formatStarRating(hero) : '—'}
          </span>
        </div>
        <p className="text-xs text-ink/60">
          {stats.total_count} review{stats.total_count === 1 ? '' : 's'}
        </p>
      </div>
      <ul className="space-y-1.5 text-xs">
        {totals.map(({ star, count }) => (
          <li key={star} className="grid grid-cols-[28px_1fr_40px] items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-ink/65">
              {star}
              <Star className="h-3 w-3 fill-amber-400 text-amber-500" strokeWidth={1.5} />
            </span>
            <span className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <span
                className="block h-full bg-amber-400"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[11px] text-ink/55">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({ review }: { review: ReviewWithCouple }) {
  const author =
    review.couple_display_name && review.couple_display_name.trim().length > 0
      ? review.couple_display_name
      : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRow value={review.rating_overall} />
          <span className="text-sm font-medium text-ink">{author}</span>
        </div>
        <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
          {dateLabel}
        </time>
      </header>
      {review.body ? (
        <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{review.body}</p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-[11px] text-ink/55 sm:grid-cols-4">
        <AxisStat axis="communication" value={review.rating_communication} />
        <AxisStat axis="quality" value={review.rating_quality} />
        <AxisStat axis="value" value={review.rating_value} />
        <AxisStat axis="on_time" value={review.rating_on_time} />
      </dl>
      {review.vendor_reply ? <VendorReplyBlock review={review} /> : null}
    </article>
  );
}

function AxisStat({ axis, value }: { axis: ReviewAxis; value: number }) {
  return (
    <div className="rounded-md bg-ink/[0.03] px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
        {REVIEW_AXIS_LABEL[axis]}
      </dt>
      <dd className="flex items-center gap-1 text-ink/80">
        <Star className="h-3 w-3 fill-amber-400 text-amber-500" strokeWidth={1.5} />
        <span className="font-mono text-[11px]">{value.toFixed(0)}</span>
      </dd>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`h-4 w-4 ${
            n <= value ? 'fill-amber-400 text-amber-500' : 'text-ink/25'
          }`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function VendorReplyBlock({ review }: { review: ReviewWithCouple }) {
  const repliedAt = review.vendor_reply_at
    ? new Date(review.vendor_reply_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  return (
    <div className="mt-3 rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
        Vendor reply {repliedAt ? `· ${repliedAt}` : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{review.vendor_reply}</p>
    </div>
  );
}

/**
 * Fetch vendor packages with their items in one round-trip per package.
 * Best-effort: errors (table missing in stale deploy environment) return
 * an empty array so /v/[slug] keeps rendering without the Packages
 * section. Migrations applied → real data flows.
 */
async function fetchVendorPackagesWithItems(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<VendorPackageWithItems[]> {
  try {
    const { data: pkgs, error: pkgsErr } = await admin
      .from('vendor_packages')
      .select(
        'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at, updated_at',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (pkgsErr || !pkgs || pkgs.length === 0) return [];

    const packageIds = pkgs.map((p) => p.package_id);
    const { data: items } = await admin
      .from('vendor_package_items')
      .select(
        'item_id, package_id, canonical_service, service_description, is_default_included, replacement_value_centavos, display_order, created_at',
      )
      .in('package_id', packageIds)
      .order('display_order', { ascending: true });

    const itemsByPackage = new Map<string, VendorPackageItemRow[]>();
    for (const row of items ?? []) {
      const list = itemsByPackage.get(row.package_id) ?? [];
      list.push(row as VendorPackageItemRow);
      itemsByPackage.set(row.package_id, list);
    }
    return (pkgs as VendorPackageRow[]).map((p) => ({
      ...p,
      items: itemsByPackage.get(p.package_id) ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Vendor packages section on /v/[slug] (owner directive 2026-05-22).
 *
 * Renders one PackageCard per active package. The CTA slot wires either:
 *   • LockPackageModal — signed-in host on a bookable verified vendor
 *   • A signed-in "couple_event_id missing" hint — sign-in works, no event
 *   • A coming_soon "not yet bookable" sub-line — informational only
 *   • A signed-out "sign in to customize" link
 */
function VendorPackagesSection({
  packages,
  coupleEventId,
  isComingSoon,
}: {
  packages: ReadonlyArray<VendorPackageWithItems>;
  coupleEventId: string | null;
  isComingSoon: boolean;
}) {
  return (
    <section className="space-y-4 border-b border-ink/10 py-8">
      <header>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Packages
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/70">
          One price, everything bundled. Locking a package locks every
          included planning category to this vendor.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pkg) => {
          let cta: React.ReactNode = null;
          if (isComingSoon) {
            cta = (
              <p className="text-xs text-ink/55">
                Not yet bookable — this vendor is finishing verification.
              </p>
            );
          } else if (coupleEventId) {
            cta = <LockPackageModal eventId={coupleEventId} pkg={pkg} />;
          } else {
            cta = (
              <Link
                href="/login"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep"
              >
                Sign in to customize
              </Link>
            );
          }
          return <PackageCard key={pkg.package_id} pkg={pkg} ctaSlot={cta} />;
        })}
      </div>
    </section>
  );
}
