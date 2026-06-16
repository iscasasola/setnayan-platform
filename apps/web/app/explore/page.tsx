import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { runSocialFlush } from '@/lib/social/flush';
import { Star, MapPin, ChevronLeft, ChevronRight, Navigation, Sparkles } from 'lucide-react';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { Wordmark } from '@/app/_components/brand-marks';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { displayServiceLabel, formatPhp } from '@/lib/vendors';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { isVendorSearchGateEnabled } from '@/lib/vendor-search-gate';
import {
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
import { fetchDemoVendorIds } from '@/lib/demo-vendors';
import {
  PUBLIC_SURFACE_VISIBILITIES,
  isBookable,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import type { ActiveAdLookup } from '@/lib/vendor-ads';
import { formatStarRating } from '@/lib/reviews';
import { EventTypeNotifyForm } from './_components/event-type-notify-form';
import { TaxonomySearch, type TaxonomyOption } from './_components/taxonomy-search';
import { CategoryTile, type CategoryTileData } from './_components/category-tile';
import { SaveVendorButton } from './_components/save-vendor-button';
// 2026-05-30 Airbnb-vibe redesign — see CLAUDE.md decision log row "Marketplace ·
// Airbnb vibe with uniform sizing". The chip-style FolderTabs is retired in the
// non-focused catalog + vendor-grid render branches in favor of IconTileFolderStrip
// (12 Lucide icon tiles) + StickyMarketplaceHeader (pinned search + filter button)
// + FilterDrawer (slide-up sheet). The FolderTab TYPE is kept (re-imported as
// type-only below) because the `tabs` const at the catalog-mode return path
// still consumes that shape verbatim — IconTileFolderStrip accepts the same
// structural type so the const passes through unchanged.
import type { FolderTab } from './_components/mega-column-tabs';
import { IconTileFolderStrip } from './_components/icon-tile-folder-strip';
import { StickyMarketplaceHeader } from './_components/sticky-marketplace-header';
import { ExploreSearchHero, type ExploreChip } from './_components/explore-search-hero';
import type { FilterDrawerProps } from './_components/filter-drawer';
import { PairedVenuePanel } from './_components/paired-venue-panel';
import { CeremonyVenuesSection } from './_components/ceremony-venues-section';
import { ReceptionVenuesSection } from './_components/reception-venues-section';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_FOLDER_SLUG,
  WEDDING_TILE_LABEL,
  WEDDING_TILE_SLUG,
  WEDDING_TILE_ORDER,
  WEDDING_TILES_BY_PARENT,
  TILE_PARENT,
  type WeddingFolder,
  type WeddingTile,
  type WeddingFaithKey,
  type TaxonomyEntry,
  type TaxonomyPhase,
} from '@/lib/taxonomy';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { buildCoupleFaithSet, passesEventTypeFilter, passesFaithFilter } from '@/lib/taxonomy-filters';
import { getEventTypeVocab } from '@/lib/event-types-db';
import {
  fetchTopVendorNamesByService,
  fetchVendorCountsByService,
  getCanonicalBuckets,
  type VendorCount,
} from '@/lib/vendor-counts';
import { FolderVendorsSection } from './_components/folder-vendors-section';
import { fetchUserEvents, formatEventDateWithPrecision, resolvePrimaryHostEvent, type EventDatePrecision } from '@/lib/events';
import { FollowGate } from '@/app/_components/follow-gate';
import {
  computeCandidateWindow,
  filterVendorsByAvailabilityIntersection,
  getEventCommonAvailability,
} from '@/lib/vendor-availability';
import { VendorsAvailabilityBanner } from './_components/vendors-availability-banner';
// 2026-05-22 quick-view redesign — see CLAUDE.md decision log row
// "Ship vendor marketplace card quick-view redesign + 4-badge system".
// VendorCard replaces the inline VendorMarketCard render and consumes
// the badge engine + review carousel + service-photo enrichment.
import { VendorCard } from './_components/vendor-card';
import {
  computeVendorBadges,
  fetchCompletedBookingCounts,
  type VendorBadge,
} from '@/lib/vendor-badges';
import { fetchLatestReviewsByVendor } from '@/lib/vendor-reviews-preview';
import { r2PublicUrl, R2_BUCKETS } from '@/lib/r2';

// Mirrors TaxonomyEntry['faith']. `null` covers two cases: anonymous browse
// (no event linked) AND civil ceremonies (secular by nature — no faith tag
// applies). In both cases the religion-default-on filter doesn't fire.
type CoupleFaith =
  | 'Catholic'
  | 'Christian'
  | 'INC'
  | 'Muslim'
  | 'Cultural'
  | 'Chinese'
  | 'Jewish'
  | 'Born Again'
  | 'Aglipayan'
  | 'LDS'
  | 'SDA'
  | 'JW'
  | 'Hindu'
  | 'Sikh'
  | 'Buddhist'
  | 'Orthodox'
  | null;

function mapCeremonyTypeToFaith(ceremonyType: string): CoupleFaith {
  switch (ceremonyType) {
    case 'catholic':
      return 'Catholic';
    case 'christian':
      return 'Christian';
    case 'inc':
      return 'INC';
    case 'muslim':
      return 'Muslim';
    case 'cultural':
      return 'Cultural';
    case 'chinese':
      return 'Chinese';
    case 'jewish':
      return 'Jewish';
    case 'born_again':
      return 'Born Again';
    case 'aglipayan':
      return 'Aglipayan';
    case 'lds':
      return 'LDS';
    case 'sda':
      return 'SDA';
    case 'jw':
      return 'JW';
    case 'hindu':
      return 'Hindu';
    case 'sikh':
      return 'Sikh';
    case 'buddhist':
      return 'Buddhist';
    case 'orthodox':
      return 'Orthodox';
    default:
      return null;
  }
}

// Derive a human-readable label from a snake_case canonical_service key.
// Pre-baked overrides for cases that don't title-case cleanly (acronyms,
// hyphenated terms, Setnayan-branded SKUs).
const TAXONOMY_LABEL_OVERRIDE: Record<string, string> = {
  pre_nup_photographer: 'Pre-Nup Photographer',
  pre_nup_shoot_locations: 'Pre-Nup Shoot Locations',
  setnayan_papic: 'Setnayan · Papic',
  setnayan_ai_edited_highlight: 'Setnayan · AI Highlight',
};

function taxonomyLabel(key: string): string {
  if (TAXONOMY_LABEL_OVERRIDE[key]) return TAXONOMY_LABEL_OVERRIDE[key];
  return key
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// Build the full 192-item autocomplete list once at module load.
const TAXONOMY_OPTIONS: ReadonlyArray<TaxonomyOption> = Object.entries(
  TAXONOMY_MAP,
)
  .map(([key, meta]) => ({
    key,
    label: taxonomyLabel(key),
    column: WEDDING_FOLDER_SHORT_LABEL[meta.folder],
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

// Multi-field marketplace text search (owner directive 2026-06-13 — "we just
// want a search bar … they can search for a category + vendor + service +
// place or details they can combine and we want to show all that works with
// their search").
//
// Each whitespace token must match SOMETHING: the vendor's business name, its
// tagline, its city, OR a service it lists (resolved against the 192-item
// taxonomy by label/key substring). One PostgREST `.or()` group per token (OR
// across those fields); chaining one `.or()` per token ANDs the groups, so
// multiple tokens INTERSECT — "photographer tagaytay" returns photography
// vendors in Tagaytay only, not the union. Tokens are stripped to [a-z0-9],
// which removes PostgREST-reserved characters ( , ( ) { } % ) so the predicate
// string stays well-formed and injection-safe, and drops noise punctuation.
// Tokens under 2 chars are ignored.
function resolveServiceKeysForToken(token: string): string[] {
  const keys: string[] = [];
  for (const opt of TAXONOMY_OPTIONS) {
    if (opt.label.toLowerCase().includes(token) || opt.key.includes(token)) {
      keys.push(opt.key);
    }
  }
  return keys;
}

// Loose structural type so the deeply-chained PostgREST builder type doesn't
// instantiate through this helper and trip the TS2589 "excessively deep"
// ceiling — same widening trick the demo-exclusion `.not()` call uses below.
// Call sites cast in via `as unknown as OrFilterable` and back out via
// `as unknown as typeof <builder>`.
type OrFilterable = { or: (filters: string) => OrFilterable };

function applyMarketplaceTextSearch(
  builder: OrFilterable,
  rawQuery: string,
): OrFilterable {
  const tokens = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2);
  let q = builder;
  for (const token of tokens) {
    const orParts = [
      `business_name.ilike.%${token}%`,
      `tagline.ilike.%${token}%`,
      `location_city.ilike.%${token}%`,
    ];
    const serviceKeys = resolveServiceKeysForToken(token);
    if (serviceKeys.length > 0) {
      // PostgREST array-overlap predicate inside an `.or()` group — mirrors the
      // existing `compatible_ceremony_types.cs.{…}` usage further below. The
      // {…} literal lists the candidate canonical_service keys for this token.
      orParts.push(`services.ov.{${serviceKeys.join(',')}}`);
    }
    q = q.or(orParts.join(','));
  }
  return q;
}

// Search-first hero (2026-06-13) — a few high-intent quick-search chips under
// the universal search box. Each is a real V1.1-base canonical_service so the
// chip lands the visitor in the vendor-grid (`?category=`) results path; sparse
// pre-launch pools fall through to the existing graceful empty state. Kept
// short + weddings-first per the owner's "dead simple" directive. NOTE: the
// `setnayan_*` first-party services are intentionally NOT chipped here — they
// surface in the search autocomplete + the catalog tiles below, but a
// `?category=setnayan_papic` grid is currently empty on prod (no publicly-
// visible first-party listing yet — flagged for owner provisioning).
const EXPLORE_HERO_CHIPS: ReadonlyArray<ExploreChip> = [
  { label: 'Photographers', href: '/explore?category=photography' },
  { label: 'Videographers', href: '/explore?category=videography' },
  { label: 'Caterers', href: '/explore?category=catering' },
  { label: 'Coordinators', href: '/explore?category=wedding_coordination' },
  { label: 'Hair & Makeup', href: '/explore?category=bridal_hmua' },
  { label: 'Cake', href: '/explore?category=wedding_cake' },
];

// GEO Phase G4 (2026-05-28) — enriched marketplace metadata. Adds canonical
// URL, keywords (AI-engine match hint), and a richer description that
// surfaces the verified-vendor + 0% commission positioning. The per-vendor
// LocalBusiness JSON-LD lives on /v/[slug] (same sprint, sister PR) — this
// page is a category landing page so the metadata-only treatment is
// proportional to the surface's role in the funnel.
export const metadata = {
  title: 'Filipino wedding vendors · Setnayan marketplace',
  description:
    'Browse verified Filipino wedding vendors on Setnayan. Photographers, caterers, planners, florists, hair and makeup, music, decor, and more. Free to discover. 0% commission on bookings.',
  alternates: { canonical: '/explore' },
  keywords: [
    'Filipino wedding vendors',
    'Philippines wedding photographers',
    'Manila wedding caterers',
    'Cebu wedding planners',
    'verified wedding vendors Philippines',
    'wedding marketplace Philippines',
    'Setnayan vendors',
  ],
  openGraph: {
    title: 'Filipino wedding vendors · Setnayan marketplace',
    description:
      'Browse verified Filipino wedding vendors. Free to discover. 0% commission on bookings.',
    url: '/explore',
    siteName: 'Setnayan',
    locale: 'en_PH',
    type: 'website',
  },
  // SEO/GEO Bucket 6 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) · twitter
  // card so social shares of /vendors render with the 1200×630 layout-level
  // /brand/og-card.webp (Bucket 2 PR #607) instead of a 144×144 thumbnail.
  twitter: {
    card: 'summary_large_image',
    title: 'Filipino wedding vendors · Setnayan marketplace',
    description:
      'Browse verified Filipino wedding vendors. Free to discover. 0% commission on bookings.',
  },
};

// SEO/GEO Bucket 6 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — ItemList JSON-LD
// enumerating the 12 wedding folders. Each ListItem points at the
// folder-scoped marketplace URL (`/explore?folder=<slug>` per CLAUDE.md
// 2026-05-22 row 4 PR #310 folder scope). Lets AI engines extract the
// taxonomy hierarchy when asked "what kinds of wedding vendors does
// Setnayan list" + powers SERP sitelink-style category breakouts.
//
// Build origin-aware at render time so the `item:` field carries the
// canonical absolute URL Google + AI engines prefer (relative URLs
// degrade extraction quality on ItemList).
function buildVendorsItemListJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Filipino wedding vendor categories on Setnayan',
    description:
      'The 12 wedding-vendor categories Setnayan organizes its Filipino marketplace under.',
    numberOfItems: WEDDING_FOLDER_ORDER.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: WEDDING_FOLDER_ORDER.map((folder, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: WEDDING_FOLDER_LABEL[folder],
      url: `${siteUrl}/explore?folder=${WEDDING_FOLDER_SLUG[folder]}`,
    })),
  };
}

// The marketplace is public, but the underlying queries hit Supabase with a
// service-role client so anonymous visitors don't need to install a per-page
// cookie or burn an auth roundtrip. Each query is scoped to is_published =
// TRUE so we never leak in-progress profiles.
export const dynamic = 'force-dynamic';

type SortKey = 'most_reviews' | 'highest_rated' | 'newest' | 'name_asc';
const SORT_KEYS: ReadonlyArray<SortKey> = [
  'most_reviews',
  'highest_rated',
  'newest',
  'name_asc',
];
const SORT_LABEL: Record<SortKey, string> = {
  most_reviews: 'Most reviews',
  highest_rated: 'Highest rated',
  newest: 'Newest',
  name_asc: 'Name (A → Z)',
};

const PAGE_SIZE = 24;

// Task #48 — couple-facing labels for the 7 venue_setting enum values.
// Source of truth lives in migration 20260521000000_iteration_0043 's
// events_venue_setting_check constraint. Re-used by both the catalog
// Reception facet chips AND the vendor-grid VenueFilterBanner so the
// host sees the same wording everywhere ("Garden venues only", "Garden
// Estate" chip, etc.). Keep in sync when V1.2 adds new venue settings.
//
// The literal-keyed object type (vs Record<string, string>) lets TS infer
// each key's value as `string`-not-`string | undefined`, which the
// RECEPTION_VENUE_FACETS literal below needs to satisfy its own
// readonly-of-{key,label,combined} shape.
const VENUE_SETTING_LABEL = {
  banquet_hall: 'Hotel Ballroom / Banquet Hall',
  garden: 'Garden Estate',
  beach: 'Beach',
  destination: 'Destination Resort',
  heritage: 'Heritage / Hacienda',
  outdoor_tent: 'Outdoor Tent',
  civil_registrar: "Civil Registrar's Office",
} as const;

// Shorter form for inline-banner copy ("Garden venues only · your wedding's
// setting"). Same literal-key shape so the banner doesn't have to defend
// against undefined.
const VENUE_SETTING_SHORT_LABEL = {
  banquet_hall: 'Banquet hall',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination resort',
  heritage: 'Heritage venue',
  outdoor_tent: 'Outdoor tent',
  civil_registrar: 'Civil registrar',
} as const;

// Defensive accessor — when a venue_setting key comes from the DB and
// hasn't been added to the literal map yet (e.g. a V1.2 addition the
// frontend hasn't picked up), fall back to a Title Case of the key so
// nothing renders blank. Used by the VenueFilterBanner + FilterBar copy.
function venueSettingLongLabel(key: string): string {
  return (VENUE_SETTING_LABEL as Record<string, string>)[key]
    ?? key.replace(/_/g, ' ');
}
function venueSettingShortLabel(key: string): string {
  return (VENUE_SETTING_SHORT_LABEL as Record<string, string>)[key]
    ?? key.replace(/_/g, ' ');
}

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    sort?: string;
    page?: string;
    verified?: string;
    match?: string;
    event_type?: string;
    /** Task #12 · CLAUDE.md 2026-05-22 — middleware redirects
     *  /vendors/compare here with `notice=compare_v1_2`. Surfaces the
     *  "compare is coming in V1.2" banner under the marketplace header. */
    notice?: string;
    /** Task #47 · CLAUDE.md 2026-05-22 — when present and resolves to one
     *  of WEDDING_FOLDER_ORDER, scopes the catalog to a single folder
     *  section. Driven by the dashboard planning-group [Search] buttons,
     *  which set `?folder=reception#reception` (etc.) so couples landing
     *  on Reception don't also see the entire Ceremony folder + its
     *  church/mosque venue cards directly above. Absent on the universal
     *  Browse entry (top-nav, sitemap, direct visit) so the full
     *  12-folder catalog renders as before. Invalid values fall back to
     *  unscoped catalog. */
    folder?: string;
    /** 10-parent model (2026-05-31) — tile-scoped vendor grid. `?tile=<slug>`
     *  filters the grid to that tile's canonical set. Set by dashboard
     *  planning-group [Search] buttons + catalog tile cards. */
    tile?: string;
    /** Task #48 · CLAUDE.md 2026-05-22 — venue_setting default-on filter
     *  for the Reception folder. When the host's primary event has a
     *  picked `events.venue_setting` AND they're viewing Reception (catalog
     *  mode with ?folder=reception, OR vendor-grid mode anchored to a
     *  venue-typed canonical), the marketplace defaults to filtering
     *  vendor_profiles whose `compatible_venue_settings` array contains
     *  the host's setting. Mirrors the religion-match shape from PR #305:
     *  default ON when present, toggle OFF via `?venue=0`. Absent (default
     *  null) is treated as "on when applicable, off when the host has no
     *  venue_setting". Composes cleanly with ?match=1/0 (religion) and
     *  ?folder=reception (catalog scope). */
    venue?: string;
    /** Marketplace focused-mode toggle (owner directive 2026-05-22).
     *  When set to 'plan', the host arrived from a planning card or
     *  locked-vendor "Switch vendor" follow-up — they're already in
     *  "find a vendor for this category" flow. Strip the marketplace
     *  chrome: hide MARKETPLACE eyebrow + headline + paragraph + "Browse
     *  all 192 categories" back-link + "SHOWING:" pill + City + Sort By
     *  + Verified-only + Match-my-wedding toggles + Apply/Clear buttons.
     *  Search box + vendor list + pagination stay always-rendered. The
     *  folder= / category= / match= / venue= filters still narrow the
     *  query silently — only the FILTER UI is hidden.
     *
     *  Set by `buildPlanGroupSearchHref` in `lib/wedding-plan-groups.ts`
     *  (used by 3 in-dashboard surfaces: planning-groups [Search] +
     *  todays-one-thing CTA + event-home-detail-pane Browse vendors
     *  button — the next-steps CTA was removed 2026-05-24). Direct
     *  visits to /vendors (top-nav
     *  Browse, sitemap, /realstories, /venue, /waitlist, /not-found, etc.)
     *  never set this param so the full chrome renders unchanged. */
    from?: string;
    /** 2026-05-30 — Ceremony Faith pill (StickyMarketplaceHeader contextual
     *  narrow). Lowercase faith key (`catholic` / `christian` / `inc` /
     *  `muslim` / `cultural`). Maps to the TitleCase faith key the
     *  TAXONOMY_MAP uses internally. Only meaningful when the catalog is
     *  Ceremony-scoped (`folder=ceremony`); other folders ignore the
     *  param so a stale link from a Catholic-pinned share doesn't
     *  unexpectedly narrow Photography or Catering. Absent / typo /
     *  unknown → no narrow applied. */
    faith?: string;
    /** 2026-06-14 search-first — `?browse=1` opts back into the curated browse
     *  catalog (icon-tile strip + Ceremony/Reception venue pickers + per-folder
     *  sections) below the search hero. A bare /vendors visit now shows the
     *  search hero + popular chips ONLY; the catalog renders only with this
     *  flag or the ?folder=/?tile=/?from=plan deep-links dashboard planning
     *  cards set. */
    browse?: string;
  }>;
};

// Single-source notice copy for query-string-driven banners on /vendors. Add
// new entries here as future deferred features start redirecting through the
// same gateway pattern; keep the brand voice (no dev text) per
// `feedback_setnayan_no_dev_text_post_launch`.
const VENDORS_NOTICE_COPY: Record<string, { title: string; body: string }> = {
  compare_v1_2: {
    title: 'Side-by-side comparison is coming soon.',
    body:
      'For now, save vendors you’re considering to your shortlist from each vendor’s profile — we’ll bring the comparison view alongside it shortly.',
  },
};

function NoticeBanner({ noticeKey }: { noticeKey: string | null }) {
  if (!noticeKey) return null;
  const copy = VENDORS_NOTICE_COPY[noticeKey];
  if (!copy) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-terracotta/15 bg-terracotta/5"
    >
      <div className="mx-auto w-full px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm text-ink/80">
          <span className="font-medium text-ink">{copy.title}</span>{' '}
          <span className="text-ink/70">{copy.body}</span>
        </p>
      </div>
    </div>
  );
}

// Iteration 0041 — multi-event support. Filter chip on `vendor_profiles.event_types[]`.
// DB-driven since the 2026-06-13 cutover: the allowlist is every ACTIVE
// `event_type_vocab` key (admin-managed at /admin/event-types), validated in
// the page body after the vocab fetch — parseFilters only shape-checks the
// raw param. EventTypeFilter is therefore an open string, not a closed union.
type EventTypeFilter = string;
const EVENT_TYPE_PARAM_RE = /^[a-z][a-z0-9_]{0,40}$/;

type VendorCardRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  contact_email: string | null;
  public_visibility: VendorPublicVisibility;
  created_at: string;
  // Iteration 0006 — sourced from vendor_market_stats view (see migration
  // 20260601020000). avg_rating + review_count let the marketplace card
  // render without a second SELECT; ad_* lets it render the Sponsored /
  // Boosted pill without a third SELECT. ad_rank powers the SQL-side sort
  // so we no longer hydrate 2000 rows just to re-sort 24.
  avg_rating_overall: number;
  review_count: number;
  ad_rank: number;
  ad_tier: 'sponsored' | 'boosted' | null;
  ad_sku_code: string | null;
  ad_radius_km: number | null;
  ad_expires_at: string | null;
  // Sort key #1 (first-party Setnayan canonicals float above all else, incl.
  // paid sponsors — owner directive 2026-05-22 PM). Selected so the Phase C
  // in-memory rating/review re-sort can preserve this precedence explicitly.
  is_setnayan_service?: boolean | null;
  // PR brief 2026-05-22 evening — demo-mode marketplace simulation.
  // Optional because (a) Agent 1's `is_demo` column may not be on main
  // yet, and (b) the vendor_market_stats view doesn't currently surface
  // it. Populated post-query via a targeted lookup against
  // vendor_profiles below. Cards with `is_demo=TRUE` render a DEMO chip
  // and the starting price (when one exists). Cards with `is_demo` null
  // or false render exactly as before.
  is_demo?: boolean | null;
  // Starting price label for demo vendors — computed only when demo
  // mode is on. `null` means the vendor has no starting price set OR
  // demo mode is off; either way the card renders without the price
  // row. Real-vendor cards never populate this in V1 (the 2026-05-16
  // hide-prices lock).
  demo_starts_at_label?: string | null;
  // 2026-05-22 quick-view enrichment additions. All optional + null-
  // safe — the new VendorCard handles missing values by hiding the
  // surface, never by surfacing a placeholder.
  /** `vendor_profiles.verification_state` — pulled in a targeted
   *  follow-up read because the `vendor_market_stats` view didn't
   *  carry it pre-2026-05-22. Drives the badge engine in
   *  `lib/vendor-badges.ts`. */
  verification_state?: string | null;
  /** V2.1 brief amendment #2 (locked 2026-05-30 · CLAUDE.md row
   *  "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
   *  [[project_setnayan_vendor_hybrid_anonymity]]). Pulled in the
   *  same vendor_profiles follow-up batch as verification_state.
   *  NULL = hide the business_name in marketplace cards (Free +
   *  Verified pre-first-reply) · non-NULL = name globally revealed.
   *  Card consumes via VendorCardData.name_revealed_at +
   *  `resolveVendorDisplayName` in lib/vendors.ts. */
  name_revealed_at?: string | null;
  /** CLAUDE.md 2026-05-30 refinement row · screen_name field. Bark-
   *  format anonymized name like "Manila Wedding Photographer #4218"
   *  generated at signup by `generate_screen_name_for_vendor()`
   *  function (migration `20260714000000`). When present, surfaces use
   *  this instead of computing the taxonomy-and-city placeholder.
   *  Pulled in the same vendor_profiles batched read as
   *  verification_state + name_revealed_at. Null = vendor doesn't have
   *  a screen_name yet (pre-backfill OR venue-exempt vendor where the
   *  generator deliberately skipped). */
  screen_name?: string | null;
  /** Phase C tier gate (vendor-tier-caps). `tier_state` enum on
   *  vendor_profiles (free | verified | pro | enterprise). NOT carried by
   *  the vendor_market_stats view, so pulled in the SAME vendor_profiles
   *  follow-up batch as verification_state / name_revealed_at / screen_name.
   *  Drives (a) the day-1 name reveal (isTrueNameTier → pro/enterprise show
   *  real business_name) and (b) the review-display gate (tierCaps
   *  reviewStarsCounted — Free hides its star rating + review count). Null =
   *  pre-migration deploy → free → hidden + gated. */
  tier_state?: string | null;
  /** Resolved public URL for the vendor's hero service photo
   *  (`vendor_services.primary_photo_r2_key` → r2PublicUrl). Null when
   *  the vendor has no service with a photo set. */
  primary_photo_url?: string | null;
  /** Lowest active `vendor_services.starting_price_php` across all
   *  the vendor's services. Real-vendor cards intentionally render
   *  this only when present + the page is in demo mode OR the
   *  vendor opts in (V1 hide-prices lock kept). */
  starting_price_php?: number | null;
};

/** Reverse map: tile URL slug (e.g. `photo-video`) → WeddingTile key. */
const SLUG_TO_TILE: Map<string, WeddingTile> = new Map(
  (Object.entries(WEDDING_TILE_SLUG) as [WeddingTile, string][]).map(
    ([tile, slug]) => [slug, tile],
  ),
);

function parseFilters(
  raw: Awaited<Props['searchParams']>,
): {
  q: string;
  // `category` is the marketplace "filter by service" param. It can be:
  //   - one of the 28-enum VendorCategory keys (set by the chip UI)
  //   - one of the 192 canonical_service keys from TAXONOMY_MAP (set by
  //     the /vendors/categories browser or the taxonomy autocomplete)
  // The query at .contains('services', [category]) treats either form
  // as an opaque string and matches when vendor.services[] includes it.
  // Categories not yet stocked with vendors hit the empty state —
  // documented V1.1 progressive-launch behavior, not a bug.
  category: string | null;
  city: string;
  sort: SortKey;
  page: number;
  verifiedOnly: boolean;
  matchEvent: boolean;
  eventType: EventTypeFilter | null;
  /** Task #47 — catalog-mode folder scope. When set to one of the 12
   *  WeddingFolder values, CatalogView renders only that single section.
   *  Source: dashboard planning-group [Search] buttons (planning-groups.tsx).
   *  Absent / invalid → render all 10 parents (universal Browse). */
  folder: WeddingFolder | null;
  /** 10-parent model (2026-05-31) — tile-scoped vendor grid. When set to a
   *  valid WeddingTile (decoded from `?tile=<slug>`), the vendor grid filters
   *  to that tile's canonical set (overlaps). Set by dashboard planning-group
   *  [Search] buttons + catalog tile cards. Absent / invalid → no tile scope. */
  tile: WeddingTile | null;
  /** Task #48 — venue_setting default-on toggle. Three states:
   *   - `'on'` (default when absent OR `?venue=1`): apply the host's
   *     `events.venue_setting` as a filter on `compatible_venue_settings`
   *     whenever the marketplace is anchored to Reception (folder=reception
   *     in catalog mode, OR vendor-grid mode where the URL carries venue=1).
   *   - `'off'` (`?venue=0`): explicit opt-out — broaden the result set to
   *     include vendors compatible with any venue setting.
   * Anonymous browsers + hosts without a venue_setting picked treat
   * 'on' as a no-op (no filter applies; toggle stays hidden). */
  venueDefault: 'on' | 'off';
  /** 2026-05-22 evening (Pull V1.2 venue directory forward) — when `?venue=`
   *  carries an explicit facet key (banquet_hall, garden, beach, destination,
   *  heritage, outdoor_tent), this surfaces it. Null when the URL is using
   *  the on/off toggle form. Drives the Reception folder's <FacetFilterBar>
   *  active-chip highlight + the card grid filter override (explicit pick
   *  wins over host's default-on setting so a host who picked Garden at
   *  event creation can still browse Beach venues). */
  venueFacet: string | null;
  /** Owner directive 2026-05-22 — focused-mode chrome toggle. TRUE when
   *  the URL carries `?from=plan` (set by dashboard planning cards via
   *  buildPlanGroupSearchHref). Hides the marketplace MARKETPLACE eyebrow
   *  + headline + paragraph + "Browse all 192 categories" back-link +
   *  "SHOWING:" pill + FilterBar (City + Sort By + Verified-only + Match-
   *  my-wedding + Apply / Clear). Search box + vendor list + pagination
   *  stay always-rendered. Filter logic still applies silently — host
   *  just doesn't see the filter UI. */
  focusedMode: boolean;
  /** Owner directive 2026-05-30 — contextual sub-category filter inline
   *  with search. Per-folder axis: Ceremony surfaces a Faith pill
   *  (catholic / christian / inc / muslim / cultural) so couples narrow
   *  the 17-tile ceremony grid to their own tradition. Null = no narrow
   *  applied (default).
   *
   *  Composition with religion-default-on (matchEvent + coupleFaith):
   *  explicit faithFilter WINS over the auto-derived coupleFaith — a host
   *  picked Garden but exploring Beach venues should be able to do the
   *  same for ceremonies (Catholic couple browsing Muslim Imams for a
   *  sibling's interfaith wedding context, etc.).
   *
   *  Other folders' contextual filters can layer in here as new keys
   *  (venue style for Reception, editing style for Photo & Video, etc.).
   *  For V1 scope today we only ship Ceremony.faith. */
  faithFilter: FaithKey | null;
} {
  const q = (raw.q ?? '').trim();
  const sort = (SORT_KEYS as readonly string[]).includes(raw.sort ?? '')
    ? (raw.sort as SortKey)
    : 'most_reviews';
  // Accept any non-empty string (28-enum OR canonical_service from the
  // 192-taxonomy). Length-cap + character-class guard against injection
  // — the value flows into a PostgREST `.contains()` predicate.
  const rawCategory = (raw.category ?? '').trim();
  const category = rawCategory.length > 0 && rawCategory.length <= 64
    && /^[a-z0-9_]+$/i.test(rawCategory)
    ? rawCategory
    : null;
  const city = (raw.city ?? '').trim();
  const pageRaw = Number(raw.page ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  // Verified-only toggle (locked 2026-05-15) — OFF by default; ON filters
  // marketplace to vendors with public_visibility = 'verified' only.
  const verifiedOnly = raw.verified === '1' || raw.verified === 'on';
  // Match-my-wedding toggle (iteration 0043, 2026-05-20) — OFF by default;
  // ON filters marketplace to vendors whose compatible_ceremony_types +
  // compatible_venue_settings include the couple's primary event values.
  // No-op (toggle hidden) for non-logged-in visitors and couples without
  // an event yet.
  const matchEvent = raw.match === '1' || raw.match === 'on';
  // Iteration 0041 — event-type filter. Restricts the marketplace to
  // vendors who serve a specific event_type (debut, gender_reveal, etc.).
  // Default null = show vendors who serve any event_type. The CHECK
  // constraint on vendor_profiles.event_types guarantees every vendor
  // serves at least one type; existing wedding vendors were backfilled
  // to ['wedding'] in migration 20260521090000.
  const eventType = EVENT_TYPE_PARAM_RE.test(raw.event_type ?? '')
    ? ((raw.event_type as string) as EventTypeFilter)
    : null;
  // Task #47 — catalog-mode folder scope. Validate against the canonical
  // 12-folder enum. Invalid / typo / null all fall back to unscoped.
  const rawFolder = (raw.folder ?? '').trim();
  const folder = (WEDDING_FOLDER_ORDER as readonly string[]).includes(rawFolder)
    ? (rawFolder as WeddingFolder)
    : null;
  // 10-parent model — tile scope from `?tile=<slug>`. Decode the hyphenated
  // slug back to the WeddingTile key; invalid / typo / absent → null.
  const rawTile = (raw.tile ?? '').trim();
  const tile = SLUG_TO_TILE.get(rawTile) ?? null;
  // Task #48 — venue default-on toggle. Default 'on' (apply host's
  // venue_setting when applicable). `?venue=0` explicit opt-out. Anything
  // else collapses to 'on'. The "applicable" check (host has a
  // venue_setting + we're in Reception scope) happens at the query layer
  // where we have the event data; this just decodes the URL signal.
  //
  // 2026-05-22 evening — the same `?venue=` param now also accepts explicit
  // facet keys (banquet_hall, garden, beach, destination, heritage,
  // outdoor_tent, civil_registrar). When set, the Reception folder's
  // <FacetFilterBar> reads the value as the active chip; the card grid
  // narrows accordingly. Three decoded states:
  //   • '0'                   → venueDefault='off', venueFacet=null
  //   • '1' / 'on' / absent   → venueDefault='on',  venueFacet=null
  //   • <facet_key>           → venueDefault='on',  venueFacet=<facet_key>
  const VENUE_FACET_KEYS = new Set([
    'banquet_hall', 'garden', 'beach', 'destination',
    'heritage', 'outdoor_tent', 'civil_registrar',
  ]);
  const rawVenue = (raw.venue ?? '').trim();
  const venueDefault = rawVenue === '0' ? ('off' as const) : ('on' as const);
  const venueFacet = VENUE_FACET_KEYS.has(rawVenue) ? rawVenue : null;
  // Owner directive 2026-05-22 — focused-mode flag. Only one accepted
  // value (`plan`) so a typo or future surface adding another `from=`
  // value doesn't accidentally trip the chrome-stripped layout. Set by
  // 3 in-dashboard surfaces (planning cards Search, todays-one-thing,
  // event-home-detail-pane Browse vendors) via the canonical
  // buildPlanGroupSearchHref helper — the next-steps surface was
  // removed 2026-05-24. Direct visits never set it.
  const focusedMode = (raw.from ?? '').trim() === 'plan';
  // 2026-05-30 — Ceremony Faith pill. URL value is lowercase for clean
  // hrefs (?faith=catholic) and maps to the TitleCase faith key the
  // taxonomy uses internally ('Catholic'). Unknown values fall back to
  // null (no narrow applied) so typos don't break the page.
  const rawFaith = (raw.faith ?? '').trim().toLowerCase();
  const faithFilter = (FAITH_URL_TO_KEY[rawFaith] ?? null) as FaithKey | null;
  return {
    q,
    category,
    city,
    sort,
    page,
    verifiedOnly,
    matchEvent,
    eventType,
    folder,
    tile,
    venueDefault,
    venueFacet,
    focusedMode,
    faithFilter,
  };
}

/**
 * 2026-05-30 — Ceremony Faith pill canonical lookups. The TaxonomyEntry
 * uses TitleCase faith keys ('Catholic' / 'Christian' / 'INC' / 'Muslim'
 * / 'Cultural') because they were authored as display labels. The URL
 * carries lowercase so /vendors?folder=ceremony&faith=catholic stays
 * scannable + matches the existing param style (?venue=garden, etc.).
 * The pill UI reads `FAITH_KEY_TO_LABEL` for the chip caption.
 *
 * INC stays uppercase as the label (it's an organization name —
 * Iglesia Ni Cristo) but the URL param is `inc` for consistency.
 */
// Derived from the canonical lib vocabulary (minus Civil — civil couples have
// no faith pill; they simply see the universal set). Adding a faith to
// WEDDING_FAITH_KEYS forces the URL/label maps below to be extended here.
export type FaithKey = Exclude<WeddingFaithKey, 'Civil'>;
const FAITH_URL_TO_KEY: Record<string, FaithKey> = {
  catholic: 'Catholic',
  christian: 'Christian',
  inc: 'INC',
  muslim: 'Muslim',
  cultural: 'Cultural',
  chinese: 'Chinese',
  jewish: 'Jewish',
  born_again: 'Born Again',
  aglipayan: 'Aglipayan',
  lds: 'LDS',
  sda: 'SDA',
  jw: 'JW',
  hindu: 'Hindu',
  sikh: 'Sikh',
  buddhist: 'Buddhist',
  orthodox: 'Orthodox',
};
const FAITH_KEY_TO_URL: Record<FaithKey, string> = {
  Catholic: 'catholic',
  Christian: 'christian',
  INC: 'inc',
  Muslim: 'muslim',
  Cultural: 'cultural',
  Chinese: 'chinese',
  Jewish: 'jewish',
  'Born Again': 'born_again',
  Aglipayan: 'aglipayan',
  LDS: 'lds',
  SDA: 'sda',
  JW: 'jw',
  Hindu: 'hindu',
  Sikh: 'sikh',
  Buddhist: 'buddhist',
  Orthodox: 'orthodox',
};
const FAITH_KEY_TO_LABEL: Record<FaithKey, string> = {
  Catholic: 'Catholic',
  Christian: 'Christian',
  INC: 'INC',
  Muslim: 'Muslim',
  Cultural: 'Cultural',
  Chinese: 'Chinese',
  Jewish: 'Jewish',
  'Born Again': 'Born Again',
  Aglipayan: 'Aglipayan (IFI)',
  LDS: 'LDS (Latter-day Saints)',
  SDA: 'Seventh-day Adventist',
  JW: "Jehovah's Witnesses",
  Hindu: 'Hindu',
  Sikh: 'Sikh',
  Buddhist: 'Buddhist',
  Orthodox: 'Orthodox Christian',
};
const FAITH_KEYS_ORDER: ReadonlyArray<FaithKey> = [
  'Catholic',
  'Muslim',
  'INC',
  'Chinese',
  'Born Again',
  'Christian',
  'Cultural',
  'Jewish',
  'Aglipayan',
  'LDS',
  'SDA',
  'JW',
  'Hindu',
  'Sikh',
  'Buddhist',
  'Orthodox',
];

/**
 * Look up the minimum `starting_price_php` per vendor_profile_id for
 * the given list — used only for demo-mode marketplace card pricing.
 * Returns a Map for O(1) lookup at render time.
 *
 * Non-demo vendors never reach this function: the caller gates on
 * `is_demo` membership. So this is exclusively a demo-mode read.
 */
async function fetchDemoStartingPrices(
  admin: ReturnType<typeof createAdminClient>,
  vendorIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (vendorIds.length === 0) return out;
  try {
    const { data, error } = await admin
      .from('vendor_services')
      .select('vendor_profile_id, starting_price_php, is_active')
      .in('vendor_profile_id', vendorIds as string[]);
    if (error) {
      console.warn('[demo-mode] fetchDemoStartingPrices failed:', error.message);
      return out;
    }
    for (const row of data ?? []) {
      const vpId = row.vendor_profile_id as string;
      const isActive = (row as { is_active?: boolean }).is_active !== false;
      const price = (row as { starting_price_php?: number | null })
        .starting_price_php;
      if (!isActive || price === null || price === undefined || price <= 0) {
        continue;
      }
      const current = out.get(vpId);
      if (current === undefined || price < current) {
        out.set(vpId, price);
      }
    }
    return out;
  } catch {
    return out;
  }
}

export default async function VendorsMarketplacePage({ searchParams }: Props) {
  const raw = await searchParams;
  let filters = parseFilters(raw);
  const admin = createAdminClient();

  // Social auto-publish flush — the traffic-piggyback doctrine: the platform
  // is cron-free by lock ([[project_setnayan_cron_free]]), so the dispatch
  // engine rides on organic traffic via Next 15 after() instead of a
  // scheduler. The public marketplace is the highest-traffic server-rendered
  // route, so posts go out on time even when nobody on the team is in
  // /admin. Fire-and-forget after the response; the 10-minute throttle
  // inside runSocialFlush makes this effectively free, and it never throws.
  after(() => runSocialFlush().catch(() => {}));

  // DB-driven event-type roster (2026-06-13 cutover) — ACTIVE vocab rows.
  // parseFilters only shape-checked ?event_type=; here it's validated against
  // the live roster (unknown / retired keys fall back to null = no filter).
  const eventTypeVocab = await getEventTypeVocab();
  const eventTypeKeys = new Set(eventTypeVocab.map((t) => t.key));
  const eventTypeLabel = new Map(eventTypeVocab.map((t) => [t.key, t.label]));
  if (filters.eventType && !eventTypeKeys.has(filters.eventType)) {
    filters = { ...filters, eventType: null };
  }

  // 0043 compatibility hooks — resolve the viewer's couple-side primary event
  // BEFORE the marketplace query is built so the compatibility filter can
  // attach onto the query when ?match=1 is set. The same `user` + supabase
  // client are reused for the follow-set lookup below (saves one auth roundtrip).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // PR brief 2026-05-22 evening — demo-mode resolution. Cheap fast
  // path: skip the admin check entirely unless the cookie is present.
  // When ON for an admin session, the marketplace additionally surfaces
  // is_demo=TRUE vendor rows; cards render a DEMO chip + starting price.
  const cookieStore = await cookies();
  const hasDemoCookie =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';
  let inDemoMode = false;
  if (hasDemoCookie && user) {
    const { data: viewerProfile } = await supabase
      .from('users')
      .select('account_type, is_internal, is_team_member')
      .eq('user_id', user.id)
      .maybeSingle();
    inDemoMode = isAdminProfile(viewerProfile);
  }

  let coupleEventId: string | null = null;
  let matchableEvent: {
    ceremony_type: string;
    // Mixed/interfaith weddings (CLAUDE.md 2026-06-01) carry a second rite;
    // the religion-match filter admits vendors fit for EITHER (additive).
    secondary_ceremony_type: string | null;
    venue_setting: string;
  } | null = null;
  let coupleEventType: string | null = null;
  // 2026-05-21 — reception venue anchor (lat/lng) for the distance chip on
  // every vendor card. Populated by saveVendorToPicks when the couple saves
  // a category='venue' vendor with coords. NULL = no anchor → no chips.
  let venueAnchor: { lat: number; lng: number } | null = null;
  let venueAnchorName: string | null = null;
  // Task #45 (2026-05-22) — host's event_date + precision drive the
  // marketplace candidate-window. Read alongside the existing event fields
  // in the same select so the intersection filter doesn't add a roundtrip.
  let coupleEventDate: string | null = null;
  let coupleEventDatePrecision: 'year' | 'month' | 'day' | null = null;
  if (user) {
    const userEvents = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = userEvents[0]?.event_id ?? null;
    // Task #46 (2026-05-22) — hosts who joined via the iteration 0048
    // invite flow at /host/accept/[token] only have an event_moderators
    // row, NOT an event_members 'couple' row. Fall back to the cross-
    // table resolver so the marketplace gates ("Add to plan" CTA,
    // distance chips, compat filter) work for them too.
    if (!coupleEventId) {
      try {
        const resolved = await resolvePrimaryHostEvent(admin, user.id);
        coupleEventId = resolved?.event_id ?? null;
      } catch {
        // Best-effort fallback — the marketplace still renders without
        // an event link; downstream UI will show the anonymous variant.
      }
    }
    if (coupleEventId) {
      const { data: ev } = await admin
        .from('events')
        .select(
          'ceremony_type, secondary_ceremony_type, venue_setting, event_type, venue_latitude, venue_longitude, venue_name, event_date, event_date_precision',
        )
        .eq('event_id', coupleEventId)
        .maybeSingle();
      if (
        ev?.venue_latitude !== null &&
        ev?.venue_latitude !== undefined &&
        ev?.venue_longitude !== null &&
        ev?.venue_longitude !== undefined
      ) {
        venueAnchor = {
          lat: Number(ev.venue_latitude),
          lng: Number(ev.venue_longitude),
        };
        venueAnchorName = (ev?.venue_name as string | null) ?? null;
      }
      // Iteration 0043 — ceremony × venue compat fields are wedding-only
      // (NULL for non-wedding events per migration 20260521080000), so the
      // matchable block only populates for wedding event_types.
      if (ev?.ceremony_type && ev?.venue_setting) {
        matchableEvent = {
          ceremony_type: ev.ceremony_type as string,
          secondary_ceremony_type:
            (ev.secondary_ceremony_type as string | null) ?? null,
          venue_setting: ev.venue_setting as string,
        };
      }
      // Iteration 0041 — event_type auto-apply. Carry the couple's primary
      // event_type forward so the marketplace can default-filter the
      // catalog to vendors who actually serve that event_type.
      if (ev?.event_type) {
        coupleEventType = ev.event_type as string;
      }
      // Task #45 — event_date + precision for the intersection filter.
      // event_date_precision column shipped via migration 20260603100000
      // with default 'year'; legacy rows pre-migration land on 'day'/'year'
      // per the backfill. Defensive null-check keeps anonymous/early-stage
      // events from short-circuiting the marketplace.
      if (ev?.event_date) {
        coupleEventDate = ev.event_date as string;
        const p = (ev as { event_date_precision?: string | null }).event_date_precision;
        if (p === 'year' || p === 'month' || p === 'day') {
          coupleEventDatePrecision = p;
        }
      }
    }
  }

  // Iteration 0041 — couple-side event_type auto-apply. When no
  // ?event_type= URL param is set AND the couple has a primary event with
  // a non-wedding event_type, default the filter to that event_type. The
  // couple lands on a marketplace scoped to their event. Wedding event_types
  // intentionally skip the auto-apply (every existing vendor is tagged
  // wedding, so auto-applying would be a no-op visually). Users who want
  // to browse all vendors can clear the filter via the empty-state CTA
  // (PR #184's "Browse all vendors" link drops the event_type from the URL).
  if (!filters.eventType && coupleEventType && coupleEventType !== 'wedding') {
    const knownEventType = eventTypeKeys.has(coupleEventType)
      ? (coupleEventType as EventTypeFilter)
      : null;
    if (knownEventType) {
      filters = { ...filters, eventType: knownEventType };
    }
  }

  // Religion-default-on (2026-05-20) → default-OFF (Task #42, 2026-05-22):
  // pre-pilot vendor inventory has sparse ceremony+venue cross-compat data,
  // so strict-AND default-on filtering produced zero results from the
  // dashboard Ceremony venue Search button. Toggle now requires explicit
  // ?match=1 opt-in. Anonymous visitors and couples without a ceremony_type
  // still see the unfiltered universe; couples who set their ceremony type
  // see all vendors by default and tick "Match my wedding" if they want to
  // narrow. Owner directive: surface the broadest inventory by default.
  const coupleFaith: CoupleFaith = matchableEvent
    ? mapCeremonyTypeToFaith(matchableEvent.ceremony_type)
    : null;

  // Catalog mode — landing view when no narrowing filter is set. Renders the
  // full 192-category taxonomy grouped by mega-column so couples see the full
  // breadth of services Setnayan covers, even before vendor pools fill in.
  // Replaces the bare empty-state that previously rendered when zero vendors
  // satisfied the publishing gate. Any filter (category, search, city,
  // verified-only, match, event_type) drops the user into vendor-grid mode
  // below so they can drill into a specific service.
  const isCatalogMode =
    !filters.category &&
    !filters.q &&
    !filters.city &&
    !filters.verifiedOnly &&
    !filters.matchEvent &&
    !filters.eventType;

  // Owner directive 2026-06-14 — "we just want a search bar". CatalogView always
  // leads with the search hero, but the curated browse catalog BELOW it (icon
  // strip + venue pickers + folder grids) renders only when the visit is an
  // explicit browse/context request: ?browse=1, a folder/tile deep-link, or a
  // dashboard planning-card entry (?from=plan). A bare /vendors visit gets the
  // search hero + popular chips only. Nothing is destroyed — the catalog is one
  // tap away via the hero's "Browse all categories" link.
  const browseMode =
    raw.browse === '1' ||
    raw.from === 'plan' ||
    filters.folder !== null ||
    filters.tile !== null;

  // Allow-list the notice key — anything else (typo, manual URL fiddling,
  // future deferred-feature key without copy) renders no banner instead of
  // a broken/empty card. Keeps the surface honest.
  const noticeKey =
    raw.notice && VENDORS_NOTICE_COPY[raw.notice] ? raw.notice : null;

  // Task #48 — derive the effective venue-default filter state for
  // catalog mode. The filter only "fires" (UX chips lit + facet drill-
  // ins pre-filtered) when ALL conditions hold: (a) host has an event
  // with a picked venue_setting, (b) ?venue=0 was NOT explicitly set.
  // Anonymous visitors AND hosts without a venue_setting yet treat the
  // toggle as a no-op so the catalog renders cleanly with the existing
  // facet chips. The actual SQL filter only attaches in vendor-grid
  // mode below — catalog mode is unfiltered by design (per Task #47).
  const hostVenueSetting: string | null = matchableEvent?.venue_setting ?? null;
  const venueFilterActive =
    hostVenueSetting !== null && filters.venueDefault === 'on';

  // SEO/GEO Bucket 6 · ItemList JSON-LD origin computed once per render.
  // Both return branches (catalog mode + non-catalog) inject the same JSON-LD
  // surface so /vendors emits the taxonomy hierarchy regardless of mode.
  const vendorsSiteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  const vendorsItemListJsonLd = buildVendorsItemListJsonLd(vendorsSiteUrl);

  if (isCatalogMode) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorsItemListJsonLd) }}
        />
        <CatalogView
          admin={admin}
          matchableEvent={matchableEvent}
          matchEvent={filters.matchEvent}
          coupleFaith={coupleFaith}
          venueAnchor={venueAnchor}
          venueAnchorName={venueAnchorName}
          coupleCeremonyType={matchableEvent?.ceremony_type ?? null}
          coupleEventType={coupleEventType}
          currentEventId={coupleEventId}
          isAuthenticated={user !== null}
          noticeKey={noticeKey}
          scopedFolder={filters.folder}
          hostVenueSetting={hostVenueSetting}
          venueFilterActive={venueFilterActive}
          venueFacet={filters.venueFacet}
          inDemoMode={inDemoMode}
          focusedMode={filters.focusedMode}
          faithFilter={filters.faithFilter}
          browseMode={browseMode}
        />
      </>
    );
  }

  // Build the base query. Visibility filter is the new authoritative gate
  // (Decision 6 / 2026-05-15): default shows both 'verified' AND 'coming_soon';
  // the "Verified only" toggle restricts to verified-bookable vendors. The
  // legacy `is_published` boolean is no longer queried here — public_visibility
  // is the source of truth for marketplace surfacing.
  const allowedVisibilities = filters.verifiedOnly
    ? (['verified'] as const)
    : PUBLIC_SURFACE_VISIBILITIES;

  // PR brief 2026-05-22 evening — demo vendor exclusion. Demo vendors
  // are pre-fetched + excluded from the main query unless demo mode is
  // on. We resolve the demo ID list once and use `.in()` / `.not()` to
  // either include or exclude. The vendor_market_stats view doesn't
  // surface is_demo, so the source of truth stays on vendor_profiles —
  // a defensive query that tolerates Agent 1's column not being on
  // main yet.
  const demoVendorIds = await fetchDemoVendorIds(admin);

  // Public marketplace requires a non-empty business_name. Coming-soon
  // vendors are intentionally surfaced (Decision 6 / 2026-05-15) — but
  // a row that hasn't even filled in its name renders as "Unnamed
  // vendor" which makes the whole marketplace look broken. Gate the
  // public surface on the minimum self-identification work; admins
  // can still see the row in /admin/vendors.
  // Iteration 0006 (2026-05-21) — read against vendor_market_stats so the
  // sort, ad-rank, and review aggregates resolve in one SQL roundtrip
  // instead of the old hydrate-2000-then-sort-in-JS dance.
  let query = admin
    .from('vendor_market_stats')
    .select(
      // Phase C sort-leak fix: `is_setnayan_service` is now SELECTED (it was
      // only used in .order() before) so the in-memory rating/review re-sort
      // below can preserve the first-party float precedence explicitly.
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,hq_latitude,hq_longitude,contact_email,public_visibility,created_at,avg_rating_overall,review_count,ad_rank,ad_tier,ad_sku_code,ad_radius_km,ad_expires_at,is_setnayan_service',
      { count: 'exact' },
    )
    .in('public_visibility', allowedVisibilities as readonly string[])
    .not('business_name', 'is', null)
    .neq('business_name', '');

  // Phase C searchability gate (vendor-tier-caps · FLAG-DARK). The matrix says
  // FREE = not marketplace-searchable, but a raw `.neq('tier_state','free')`
  // would EMPTY the live marketplace today (the lone real founder vendor + all
  // demo vendors are tier_state='free'). So it's behind VENDOR_TIER_SEARCH_GATE
  // (default OFF → this branch is skipped → query unchanged → prod identical).
  // Suppressed in demo mode so admins still see demo (free) vendors. Reads the
  // `tier_state` column the migration 20260929000000 adds to the view.
  if (isVendorSearchGateEnabled() && !inDemoMode) {
    query = query.neq('tier_state', 'free');
  }

  // PR brief 2026-05-22 evening — exclude demo vendor IDs unless an
  // admin has demo mode on. PostgREST's NOT IN syntax expects a
  // parenthesized comma-separated list. The narrowing cast through
  // unknown is for the type system: chained PostgREST query types get
  // deep enough that TS hits the recursion ceiling on
  // `query = query.not(...)`, so we widen once and continue. Behavior
  // is unchanged from the explicit chain — empty-list guard above
  // means we only call when there's at least one ID to exclude.
  if (!inDemoMode && demoVendorIds.length > 0) {
    type QueryShape = {
      not: (column: string, op: string, value: string) => typeof query;
    };
    query = (query as unknown as QueryShape).not(
      'vendor_profile_id',
      'in',
      `(${demoVendorIds.join(',')})`,
    );
  }

  if (filters.q.length > 0) {
    // Unified multi-field search — see applyMarketplaceTextSearch. Replaces the
    // old business_name-only ilike so a free-text query matches across vendor
    // name, tagline, city, and listed services, combinable across tokens.
    query = applyMarketplaceTextSearch(
      query as unknown as OrFilterable,
      filters.q,
    ) as unknown as typeof query;
  }
  // 10-parent model (2026-05-31) — tile-scoped grid. `?tile=<slug>` overlaps
  // the tile's canonical set, which ALREADY includes any cross-listed
  // canonicals (e.g. `accommodation` rolls into the Catering tile via
  // `secondary_tiles`, and the Filipiniana & Barongs cross-view pulls the
  // terno/barong canonicals). This replaces the old folder+category
  // catch-all expansion — one overlaps clause handles both the tile's own
  // canonicals and its cross-listings. Takes precedence over `?category=`.
  if (filters.tile) {
    const tileServices = (await getCanonicalBuckets()).byTile.get(filters.tile) ?? [];
    if (tileServices.length > 0) {
      query = query.overlaps('services', tileServices);
    }
  } else if (filters.category) {
    // Single canonical_service filter (taxonomy autocomplete + the
    // /vendors/categories canonical browser). `services` is a text[]; the
    // contains operator matches when the array includes the canonical key.
    // Custom service strings aren't indexed by canonical key, so a category
    // filter won't match vendors who only listed a custom service — correct
    // V1 behavior.
    query = query.contains('services', [filters.category]);
  }
  if (filters.eventType) {
    // Iteration 0041 — vendor_profiles.event_types[] gates which event_types
    // each vendor serves (default ['wedding'] for legacy / V1.1 vendors).
    // GIN-indexed by migration 20260521090000.
    query = query.contains('event_types', [filters.eventType]);
  }
  if (filters.city.length > 0) {
    query = query.ilike('location_city', `%${filters.city}%`);
  }

  // 0043 compatibility filter — only applies when the toggle is on AND the
  // couple has a matchable primary event. NULL/missing compatible_* columns
  // count as "open to all" so legacy vendors who pre-date the compatibility
  // tags aren't excluded; only vendors with explicit non-matching arrays
  // get filtered out.
  //
  // Task #42 (2026-05-22): venue_setting clause dropped from the filter
  // entirely. Faith alone is the right scope — couples often don't have
  // a venue picked yet, OR their venue_setting is flexible (a Catholic
  // ceremony can happen at a banquet hall OR garden OR heritage site).
  // Compounding both dimensions emptied the result set in pre-pilot
  // testing (owner's 2026-05-22 Ceremony-venue Search button repro).
  // Previously had a per-category opt-out for religious_venue + church_fees;
  // now the venue_setting filter never fires regardless of category.
  if (filters.matchEvent && matchableEvent) {
    // Admit vendors fit for the primary OR (for Mixed/interfaith weddings)
    // the secondary rite — additive, NULL-safe, only ADMITS more, never
    // excludes. Collapses to the single-ceremony clause when there's no
    // secondary. CLAUDE.md 2026-06-01 + 2026-06-02.
    const matchCeremonies = Array.from(
      new Set(
        [matchableEvent.ceremony_type, matchableEvent.secondary_ceremony_type]
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0),
      ),
    );
    query = query.or(
      [
        'compatible_ceremony_types.is.null',
        ...matchCeremonies.map((v) => `compatible_ceremony_types.cs.{${v}}`),
      ].join(','),
    );
  }

  // Task #48 (2026-05-22) — venue_setting default-on filter. Composes
  // independently with ?match=1 (religion). Fires when ALL hold: (a) the
  // host has a venue_setting picked on their primary event, (b) ?venue=0
  // was NOT set, (c) the request reads as Reception-anchored — either
  // explicit ?folder=reception, or the host already drilled into a venue-
  // typed canonical_service via the Reception facet chips. The OR clause
  // mirrors the religion-match safety valve: vendors with a NULL
  // compatible_venue_settings (legacy / pre-iteration-0043) stay visible
  // alongside vendors who explicitly tagged the host's setting. The DEFAULT
  // on the column is non-null per migration 20260521000000, so in practice
  // every modern vendor row has SOME array — the `.is.null` half covers
  // the test_seed_null backfill edge case + future schema additions.
  //
  // 2026-05-22 evening — `?venue=<facet_key>` explicit pick wins over the
  // host's default-on setting. Lets a host who picked Garden at event
  // creation still browse Beach-compatible florists via
  // `?folder=reception&venue=beach&category=florals`. Falls back to the
  // host's setting when no explicit facet is present.
  const effectiveVenueSetting = filters.venueFacet ?? hostVenueSetting;
  if (
    effectiveVenueSetting &&
    (filters.tile === 'reception' || filters.folder === 'venue') &&
    filters.venueDefault === 'on'
  ) {
    query = query.or(
      `compatible_venue_settings.is.null,compatible_venue_settings.cs.{${effectiveVenueSetting}}`,
    );
  }

  // Sort chain.
  //   1. is_setnayan_service DESC (owner directive 2026-05-22 PM) —
  //      first-party Setnayan canonicals (Papic, Panood, Pailaw,
  //      Patiktok, Pakanta, Setnayan AI, Animated Monogram,
  //      Save-the-Date Video, AI Highlights) float ABOVE everything else,
  //      including paid sponsors. Vendor's services[] is checked at view-compute
  //      time via the 10-canonical array in migration 20260607020000.
  //   2. ad_rank DESC (iteration 0006, 2026-05-21) — Sponsored Boost +
  //      Boosted Ads next, per iteration 0022 § 5b.
  //   3. User-chosen sort below.
  // All columns live on vendor_market_stats so PostgREST orders + paginates
  // in one query — no in-memory pass.
  query = query.order('is_setnayan_service', { ascending: false });
  query = query.order('ad_rank', { ascending: false });
  switch (filters.sort) {
    case 'highest_rated':
      query = query
        .order('avg_rating_overall', { ascending: false })
        .order('review_count', { ascending: false }); // tiebreak by volume
      break;
    case 'name_asc':
      query = query.order('business_name', { ascending: true });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'most_reviews':
    default:
      query = query
        .order('review_count', { ascending: false })
        .order('avg_rating_overall', { ascending: false });
      break;
  }

  const { data: rowsRaw, count: totalCount } = await query.range(
    (filters.page - 1) * PAGE_SIZE,
    filters.page * PAGE_SIZE - 1,
  );
  const rows = (rowsRaw ?? []) as VendorCardRow[];

  // PR brief 2026-05-22 evening — annotate demo rows with their
  // starting price + is_demo flag. Only when demo mode is on AND at
  // least one row matches a demo ID; otherwise zero extra work. Real
  // vendor cards never get `demo_starts_at_label` set; the 2026-05-16
  // hide-prices lock continues to apply to them. Annotation is purely
  // additive — fields are optional on VendorCardRow.
  if (inDemoMode && demoVendorIds.length > 0) {
    const demoIdSet = new Set(demoVendorIds);
    const demoRowIds = rows
      .filter((r) => demoIdSet.has(r.vendor_profile_id))
      .map((r) => r.vendor_profile_id);
    if (demoRowIds.length > 0) {
      const startingPrices = await fetchDemoStartingPrices(admin, demoRowIds);
      for (const row of rows) {
        if (demoIdSet.has(row.vendor_profile_id)) {
          row.is_demo = true;
          const startsAt = startingPrices.get(row.vendor_profile_id);
          row.demo_starts_at_label =
            startsAt && startsAt > 0 ? `from ${formatPhp(startsAt)}` : null;
        }
      }
    }
  }

  // Task #42 (2026-05-22) — when the filtered result set is empty AND the
  // strict filters (match-my-wedding, verified-only) are active, compute the
  // broadened-scope count so the empty state can offer a "Show all" CTA with
  // concrete inventory framing instead of a generic "no matches" dead-end.
  // Only runs on empty pages — zero overhead when results exist. Category,
  // city, q, and eventType context is preserved; only match + verified drop.
  let broadenedCount: number | null = null;
  // Task #48 — the venue default-on filter also counts as "strict" when
  // it's actively narrowing results. Hooking it into the broadened-scope
  // count means the empty-state can offer a "Show all settings" CTA with
  // the actual count of vendors that DO exist in the category without the
  // venue clause attached.
  //
  // 2026-05-22 evening — explicit ?venue=<facet> picks also count as strict
  // for the same reason (they narrow on compatible_venue_settings). When
  // the host has no own setting but the URL carries ?venue=garden, the
  // broadening flow still fires correctly.
  const venueFilterFiring =
    (venueFilterActive || filters.venueFacet !== null) &&
    (filters.tile === 'reception' || filters.folder === 'venue') &&
    filters.venueDefault === 'on';
  const hasStrictFilter =
    filters.matchEvent || filters.verifiedOnly || venueFilterFiring;
  if (rows.length === 0 && hasStrictFilter) {
    let broadened = admin
      .from('vendor_market_stats')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .in('public_visibility', PUBLIC_SURFACE_VISIBILITIES as readonly string[])
      .not('business_name', 'is', null)
      .neq('business_name', '');
    // Mirror the demo exclusion on the broadened count so the "Show
    // all" empty-state messaging doesn't promise demo inventory to
    // non-admin visitors. Same type-narrowing as the main query above.
    if (!inDemoMode && demoVendorIds.length > 0) {
      type BroadenedShape = {
        not: (column: string, op: string, value: string) => typeof broadened;
      };
      broadened = (broadened as unknown as BroadenedShape).not(
        'vendor_profile_id',
        'in',
        `(${demoVendorIds.join(',')})`,
      );
    }
    if (filters.q.length > 0) {
      // Same multi-field search as the main query so the broadened-count
      // empty-state framing stays consistent with what the search matched.
      broadened = applyMarketplaceTextSearch(
        broadened as unknown as OrFilterable,
        filters.q,
      ) as unknown as typeof broadened;
    }
    if (filters.category) {
      broadened = broadened.contains('services', [filters.category]);
    }
    if (filters.eventType) {
      broadened = broadened.contains('event_types', [filters.eventType]);
    }
    if (filters.city.length > 0) {
      broadened = broadened.ilike('location_city', `%${filters.city}%`);
    }
    const { count: bc } = await broadened;
    broadenedCount = bc ?? 0;
  }

  // Each card already carries its stats + active-ad columns on the view row,
  // so the render below reads them directly off `v` — no per-card Map lookup
  // and no second roundtrip.

  // Iteration 0019 § Gate + 2026-05-20 saved-to-picks — resolve the viewer's
  // follow set and saved-vendor set for each visible card. Both reads are
  // viewer-scoped and only need the IDs we just paginated, so they run in
  // parallel rather than the old sequential await chain.
  const visibleIds = rows.map((r) => r.vendor_profile_id);
  const [followedSet, savedSet] = await Promise.all([
    (async (): Promise<Set<string>> => {
      if (!user || visibleIds.length === 0) return new Set<string>();
      const { data: follows } = await supabase
        .from('vendor_follows')
        .select('vendor_profile_id')
        .eq('follower_user_id', user.id)
        .in('vendor_profile_id', visibleIds);
      return new Set((follows ?? []).map((f) => f.vendor_profile_id));
    })(),
    (async (): Promise<Set<string>> => {
      if (!user || !coupleEventId || visibleIds.length === 0) return new Set<string>();
      const { data: saved } = await supabase
        .from('event_vendors')
        .select('marketplace_vendor_id')
        .eq('event_id', coupleEventId)
        .in('marketplace_vendor_id', visibleIds);
      return new Set(
        (saved ?? [])
          .map((s) => s.marketplace_vendor_id)
          .filter((id): id is string => Boolean(id)),
      );
    })(),
  ]);

  // Task #45 (2026-05-22) — calendar intersection filter. When the host has
  // set event_date + precision AND has ≥1 confirmed vendor, drop candidate
  // vendors whose calendar has zero overlap with commonAvailability
  // (intersection of all confirmed vendors' available days inside the
  // precision window). Per owner lock: 0 confirmed vendors → no filter; ≤7
  // shared days → render selector banner; ∅ shared days → render conflict
  // banner with link to the dispute flow (0021 § 10).
  //
  // Uses the admin client because (a) the marketplace is a public surface
  // and (b) the vendor_calendar_blocks RLS is per-event-member-scope; the
  // admin client carries no viewer identity so the read is consistent for
  // anonymous-browser + coordinator-delegate scenarios alike.
  //
  // Order: SQL filters already narrowed `rows`. We post-filter against
  // commonAvailability so the page count math + banner copy stay
  // consistent with the page-of-vendors the host actually browses.
  type AvailabilityState =
    | { kind: 'none' }
    | {
        kind: 'active';
        lockedCount: number;
        availableDays: string[];
        windowLabel: string;
        precision: EventDatePrecision;
      };
  let availability: AvailabilityState = { kind: 'none' };
  let visible = rows;
  if (coupleEventId && coupleEventDate && coupleEventDatePrecision) {
    const window = computeCandidateWindow(coupleEventDate, coupleEventDatePrecision);
    if (window) {
      const { commonAvailability, lockedCount } = await getEventCommonAvailability(
        admin,
        coupleEventId,
        window.start,
        window.end,
      );
      if (lockedCount > 0) {
        const allowedIds = await filterVendorsByAvailabilityIntersection(
          admin,
          rows.map((r) => r.vendor_profile_id),
          commonAvailability,
          window.start,
          window.end,
        );
        visible = rows.filter((r) => allowedIds.has(r.vendor_profile_id));
        const sortedDays = [...commonAvailability].sort();
        availability = {
          kind: 'active',
          lockedCount,
          availableDays: sortedDays,
          windowLabel: formatEventDateWithPrecision(
            coupleEventDate,
            coupleEventDatePrecision,
          ).replace(/^Sometime in /, ''),
          precision: coupleEventDatePrecision,
        };
      }
    }
  }

  // Sort + ad-floating already happened SQL-side (see .order chain above),
  // so `rows` is already in render order. `totalCount` is the count: 'exact'
  // result from the view-backed query — accurate for the pagination footer.
  // The intersection filter narrows `visible` AFTER pagination: pages with
  // many filtered-out candidates may render short — acceptable at pilot
  // scale; V1.x folds the intersection into the SQL query so pagination
  // and filter compose properly.
  const totalPages = Math.max(1, Math.ceil((totalCount ?? rows.length) / PAGE_SIZE));

  // ---------------------------------------------------------------------
  // 2026-05-22 vendor-card quick-view enrichment.
  //
  // Three batched reads run in parallel against the IDs in `visible` so
  // the new VendorCard surface (badges + service hero photo + review
  // carousel) renders without going N+1 against the DB:
  //
  //   (a) `vendor_profiles.verification_state` — needed for the badge
  //       engine. Wasn't on `vendor_market_stats` pre-2026-05-22 so it
  //       lives as a targeted follow-up SELECT.
  //
  //   (b) `vendor_services` rows for each vendor — we pick the lowest
  //       `starting_price_php` per vendor (matches the "Starts at"
  //       framing in the brief) and resolve the first non-null
  //       `primary_photo_r2_key` for the hero photo.
  //
  //   (c) Completed-booking counts via `fetchCompletedBookingCounts`
  //       — drives the `most_booking` badge.
  //
  //   (d) Latest reviews per vendor via `fetchLatestReviewsByVendor`
  //       — drives the per-card carousel.
  //
  // All four fail-soft — empty maps when reads error so a partial DB
  // hiccup doesn't take down the marketplace. Cards just render
  // without their badges / carousel / price / photo until the next
  // page load.
  // ---------------------------------------------------------------------
  const visibleVendorIds = visible.map((v) => v.vendor_profile_id);
  const [verificationByVendorId, servicesByVendorId, bookingCounts, reviewsByVendorId] =
    await Promise.all([
      (async (): Promise<
        Map<
          string,
          {
            verification_state: string | null;
            name_revealed_at: string | null;
            screen_name: string | null;
            tier_state: string | null;
          }
        >
      > => {
        if (visibleVendorIds.length === 0) return new Map();
        /* V2.1 brief amendment #2 (2026-05-30): bundle name_revealed_at
           into the same fetch so the marketplace card resolves both
           the badge engine + the hybrid-anonymity placeholder in one
           batched read. The column ships pre-pilot via PR #662 /
           migration 20260530010000 · the optional row destructure
           below tolerates a pre-migration deploy where the column
           is absent (PostgREST returns 200 with the column missing
           silently) by defaulting to null = hidden, which is the
           conservative behavior.
           CLAUDE.md 2026-05-30 refinement row extends this batch with
           screen_name (Bark-format stored anonymized name from
           migration `20260714000000`). When present, surfaces render
           the stable Bark format ("Manila Wedding Photographer #4218")
           instead of computing taxonomy-and-city on every render. */
        /* Phase C tier gate (vendor-tier-caps) extends this batch with
           tier_state — the day-1 name reveal + the review-display gate both
           key off it. Same pre-migration-deploy resilience: optional row
           field, `?? null` → free → hidden + gated. */
        const { data, error } = await admin
          .from('vendor_profiles')
          .select(
            'vendor_profile_id, verification_state, name_revealed_at, screen_name, tier_state',
          )
          .in('vendor_profile_id', visibleVendorIds);
        if (error) {
          console.error('[vendors] verification_state fetch failed', error);
          return new Map();
        }
        const out = new Map<
          string,
          {
            verification_state: string | null;
            name_revealed_at: string | null;
            screen_name: string | null;
            tier_state: string | null;
          }
        >();
        for (const row of data ?? []) {
          const r = row as {
            vendor_profile_id: string;
            verification_state: string | null;
            name_revealed_at?: string | null;
            screen_name?: string | null;
            tier_state?: string | null;
          };
          out.set(r.vendor_profile_id, {
            verification_state: r.verification_state ?? null,
            name_revealed_at: r.name_revealed_at ?? null,
            screen_name: r.screen_name ?? null,
            tier_state: r.tier_state ?? null,
          });
        }
        return out;
      })(),
      (async (): Promise<
        Map<string, { startingPrice: number | null; photoR2Key: string | null }>
      > => {
        if (visibleVendorIds.length === 0) return new Map();
        const { data, error } = await admin
          .from('vendor_services')
          .select(
            'vendor_profile_id, starting_price_php, primary_photo_r2_key, is_active',
          )
          .in('vendor_profile_id', visibleVendorIds);
        if (error) {
          console.error('[vendors] vendor_services fetch failed', error);
          return new Map();
        }
        const out = new Map<
          string,
          { startingPrice: number | null; photoR2Key: string | null }
        >();
        for (const row of data ?? []) {
          const r = row as {
            vendor_profile_id: string;
            starting_price_php: number | null;
            primary_photo_r2_key: string | null;
            is_active: boolean | null;
          };
          // Skip inactive services — they shouldn't drive the
          // surfaced starting price.
          if (r.is_active === false) continue;
          const existing = out.get(r.vendor_profile_id);
          // Lowest starting price wins. Photo lookup picks the first
          // service with a non-null key (deterministic but not
          // strictly cheapest — that's intentional, the hero photo
          // doesn't need to match the cheapest service).
          const newPrice =
            r.starting_price_php !== null && r.starting_price_php > 0
              ? r.starting_price_php
              : null;
          const newPhoto =
            r.primary_photo_r2_key && r.primary_photo_r2_key.length > 0
              ? r.primary_photo_r2_key
              : null;
          if (!existing) {
            out.set(r.vendor_profile_id, {
              startingPrice: newPrice,
              photoR2Key: newPhoto,
            });
            continue;
          }
          const startingPrice =
            existing.startingPrice === null
              ? newPrice
              : newPrice === null
                ? existing.startingPrice
                : Math.min(existing.startingPrice, newPrice);
          const photoR2Key = existing.photoR2Key ?? newPhoto;
          out.set(r.vendor_profile_id, { startingPrice, photoR2Key });
        }
        return out;
      })(),
      fetchCompletedBookingCounts(admin, visibleVendorIds),
      fetchLatestReviewsByVendor(admin, visibleVendorIds),
    ]);

  // Enrich each visible row with the new optional fields. Real-vendor
  // cards stay price-less per the 2026-05-16 hide-prices lock UNLESS
  // demo mode is on (which already populates `demo_starts_at_label`
  // above) — passing `starting_price_php` only for demo rows preserves
  // that contract while letting the card's price line stay generic.
  // V1.1 candidate: surface `starting_price_php` for real vendors too
  // once the hide-prices lock is reconsidered (owner decision pending).
  for (const v of visible) {
    const meta = verificationByVendorId.get(v.vendor_profile_id) ?? null;
    v.verification_state = meta?.verification_state ?? null;
    /* V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity. NULL =
       business_name hidden in this card (Free + Verified pre-first-
       reply). Consumed by VendorCard via resolveVendorDisplayName. */
    v.name_revealed_at = meta?.name_revealed_at ?? null;
    /* CLAUDE.md 2026-05-30 refinement row · screen_name field. When
       present, VendorCard's resolveVendorDisplayName surfaces this
       Bark-format stable identifier instead of computing the legacy
       taxonomy-and-city placeholder on every render. */
    v.screen_name = meta?.screen_name ?? null;
    /* Phase C tier gate · drives the day-1 name reveal + the review-display
       gate (stars/count) on this card. `?? null` → free → hidden + gated. */
    v.tier_state = meta?.tier_state ?? null;
    const svc = servicesByVendorId.get(v.vendor_profile_id);
    v.primary_photo_url = svc?.photoR2Key
      ? r2PublicUrl(R2_BUCKETS.media, svc.photoR2Key)
      : null;
    // Only expose starting_price_php on demo cards in V1; real cards
    // keep the price line hidden per hide-prices lock.
    v.starting_price_php =
      v.is_demo === true && svc?.startingPrice ? svc.startingPrice : null;
  }

  // ── Phase C sort-leak fix (rating/review sorts) ─────────────────────────
  // The SQL query ordered `highest_rated` / `most_reviews` by the raw
  // avg_rating_overall / review_count on the vendor_market_stats view — BEFORE
  // tier_state was read in the enrichment loop above. That let a FREE vendor
  // with high (but tier-HIDDEN) stars sort to the top while the card displays
  // "new". Re-sort the page array in-memory using the GATED values (a vendor
  // whose tier can't count stars sorts as rating 0 / count 0), so the visible
  // order matches the visible numbers. This is a POST-PAGINATION re-sort —
  // acceptable for the founder-only marketplace; the fuller fix is a
  // tier-aware ORDER BY in a view that exposes tier_state (deferred). The
  // primary is_setnayan_service → ad_rank precedence is preserved (compared
  // first); only the rating/review tiebreak uses gated values. Array#sort is
  // stable in V8 so equal-key rows keep their SQL order.
  if (filters.sort === 'highest_rated' || filters.sort === 'most_reviews') {
    const gatedRatingOf = (v: VendorCardRow): number =>
      tierCaps(v.tier_state ?? null).reviewStarsCounted
        ? Number(v.avg_rating_overall ?? 0)
        : 0;
    const gatedReviewsOf = (v: VendorCardRow): number =>
      tierCaps(v.tier_state ?? null).reviewStarsCounted ? (v.review_count ?? 0) : 0;
    const setnayanRank = (v: VendorCardRow): number => (v.is_setnayan_service ? 1 : 0);
    visible = [...visible].sort((a, b) => {
      // 1. is_setnayan_service DESC (first-party float — unchanged).
      const setnayanDiff = setnayanRank(b) - setnayanRank(a);
      if (setnayanDiff !== 0) return setnayanDiff;
      // 2. ad_rank DESC (paid sponsors/boosts — unchanged).
      const adDiff = (b.ad_rank ?? 0) - (a.ad_rank ?? 0);
      if (adDiff !== 0) return adDiff;
      // 3. GATED rating / review sort.
      if (filters.sort === 'highest_rated') {
        const r = gatedRatingOf(b) - gatedRatingOf(a);
        if (r !== 0) return r;
        return gatedReviewsOf(b) - gatedReviewsOf(a); // volume tiebreak
      }
      const c = gatedReviewsOf(b) - gatedReviewsOf(a);
      if (c !== 0) return c;
      return gatedRatingOf(b) - gatedRatingOf(a);
    });
  }

  // Badge computation runs against the enriched `visible` set so
  // percentile thresholds reflect what's on this page.
  const badgesByVendorId = computeVendorBadges(
    visible.map((v) => ({
      vendor_profile_id: v.vendor_profile_id,
      verification_state: v.verification_state ?? null,
      created_at: v.created_at,
      avg_rating_overall: v.avg_rating_overall ?? 0,
      review_count: v.review_count ?? 0,
    })),
    bookingCounts,
  );

  return (
    <main className="min-h-dvh bg-cream">
      {/* SEO/GEO Bucket 6 · ItemList JSON-LD also emitted on non-catalog
          return so legacy single-page layouts continue to surface the
          12-folder taxonomy hierarchy for AI engines + Google extraction. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorsItemListJsonLd) }}
      />
      {/* Shared marketing top nav (same as every other public page, owner
          2026-06-14 "keep this top nav the same on Explore + For vendors").
          Rendered NON-sticky here because the marketplace search bar
          (StickyMarketplaceHeader) is itself `sm:sticky sm:top-0` — two
          sticky-top bars would stack/overlap on scroll. */}

      <NoticeBanner noticeKey={noticeKey} />

      {/* 2026-05-30 mobile pattern lock — `pb-36` on mobile gives the page
          content 144px of bottom clearance so the last visible items don't
          render behind the fixed bottom-pinned StickyMarketplaceHeader (which
          can stack up to ~140px tall with eyebrow + search row + contextual
          pill row + safe-area inset). On desktop (`sm:py-14`) the header is
          sticky-top so no bottom clearance needed — `sm:py-14` overrides
          mobile's pt-10 + pb-36 with a symmetric 56px both sides. Page-level
          max-w-6xl cap retired in PR #655 earlier same day per owner
          directive "let it maximize the full width". */}
      <section className="mx-auto w-full px-4 pt-10 pb-36 sm:px-6 sm:py-14 lg:px-8">

        {/* Focused-mode (owner directive 2026-05-22) — when ?from=plan is
            set, the host arrived from a dashboard planning card or
            locked-vendor follow-up and is already in "find a vendor for
            this category" flow. The MARKETPLACE eyebrow + headline +
            paragraph + "Browse all 192 categories" back-link + "SHOWING:"
            pill + full FilterBar (City / Sort / Verified-only / Match-my-
            wedding / Apply / Clear) all read as noise on top of the
            silently-applied folder / category. Hide them in focused-mode;
            direct visits render the full chrome unchanged. The folder /
            category / match / venue filters still narrow the underlying
            query — only the FILTER UI is hidden. */}
        {!filters.focusedMode ? (
          <>
            {/* 2026-05-30 Airbnb-vibe redesign — owner directive verbatim:
                "marketplace is doesnt feel user friendly. we want it to be
                easy to navigate and direct. the buttons being different
                sizes is also not appealing... vibe of shopee/zalora/airbnb"
                + "make sure it still follow the theme and understand how
                the overall look of the app works and keep it that way".

                Retired: italic-serif "Browse Filipino wedding vendors." H1
                + descriptive paragraph + "Browse all 192 categories" back-
                link + inline FilterBar (4-col labeled form). The big
                headline pushed the actual vendor catalog below the fold
                and the FilterBar's variable-width buttons broke uniformity.

                New: sticky search header (single 44pt pill row) + filter
                drawer (slide-up sheet on mobile / right-side panel on
                desktop). Theme preserved — Facebook palette via legacy
                bg-cream / text-ink / text-terracotta classes per the
                2026-05-22 brand pivot. The "Browse all 192 categories"
                back-link survives below as a brand-voice text link so the
                back affordance stays reachable without competing with the
                sticky search. */}
            <StickyMarketplaceHeader
              taxonomyOptions={TAXONOMY_OPTIONS}
              filters={{
                q: filters.q,
                city: filters.city,
                sort: filters.sort,
                verifiedOnly: filters.verifiedOnly,
                matchEvent: filters.matchEvent,
                eventType: filters.eventType,
                folder: filters.folder,
                venueDefault: filters.venueDefault,
                // 2026-05-30 PM — drives the applied-filter count badge in
                // vendor-grid mode too. Empty when no faith narrow active.
                faith: filters.faithFilter ? FAITH_KEY_TO_URL[filters.faithFilter] : '',
              }}
              drawer={{
                filters: {
                  q: filters.q,
                  category: filters.category,
                  city: filters.city,
                  sort: filters.sort,
                  verifiedOnly: filters.verifiedOnly,
                  matchEvent: filters.matchEvent,
                  eventType: filters.eventType,
                  folder: filters.folder,
                  venueDefault: filters.venueDefault,
                  focusedMode: filters.focusedMode,
                  // 2026-05-30 PM — drives the drawer's `<select name="faith">`
                  // defaultValue in vendor-grid mode. URL lowercase value
                  // ('catholic' etc.) OR empty for "All faiths" option.
                  faith: filters.faithFilter ? FAITH_KEY_TO_URL[filters.faithFilter] : '',
                },
                sortOptions: SORT_KEYS.map((k) => ({
                  value: k,
                  label: SORT_LABEL[k],
                })),
                // 2026-05-30 PM — vendor-grid mode lacks the catalog's
                // `schemas` + `vendorCounts` cross-folder count substrate
                // (those are CatalogView locals). Pass all 5 faith options
                // unconditionally — same simpler tradeoff used for Sort +
                // Verified-only (drawer doesn't pre-count whether results
                // exist for each value). Couples who pick a faith with zero
                // matches see the standard EmptyState.
                faithOptions: FAITH_KEYS_ORDER.map((k) => ({
                  value: FAITH_KEY_TO_URL[k],
                  label: FAITH_KEY_TO_LABEL[k],
                })),
                matchableEvent,
                hostVenueSetting,
                hostVenueLabel: hostVenueSetting
                  ? venueSettingLongLabel(hostVenueSetting)
                  : null,
                showVenueToggle:
                  (filters.tile === 'reception' || filters.folder === 'venue') &&
                  hostVenueSetting !== null,
                hasActiveFilters:
                  filters.q.length > 0 ||
                  filters.category !== null ||
                  filters.city.length > 0 ||
                  filters.sort !== 'most_reviews' ||
                  filters.verifiedOnly ||
                  filters.matchEvent ||
                  filters.venueDefault === 'off' ||
                  // 2026-05-30 PM — Clear button surfaces when faith narrow
                  // is active so couples can clear back to baseline without
                  // hunting for a sub-select option.
                  filters.faithFilter !== null,
              } as FilterDrawerProps}
            />

            {/* Compact context strip — back to catalog + current filter
                summary. Kept below the sticky header so it doesn't bloat
                the sticky chrome but stays reachable on every grid page. */}
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
              <Link
                href="/explore?match=0"
                className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline-offset-4 hover:underline"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
                Browse all 192 categories
              </Link>
              {filters.category ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Showing: {taxonomyLabel(filters.category)}
                </p>
              ) : filters.q ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Search: &ldquo;{filters.q}&rdquo;
                </p>
              ) : null}
            </div>
          </>
        ) : (
          /* Focused-mode replacement: a slim search form with only the
             search input. Submitting preserves folder + category + match
             + venue + from=plan via hidden inputs so the host stays inside
             focused-mode + their planning context. No labels / no
             eyebrow / no headline / no filter chrome. */
          <FocusedModeSearchForm filters={filters} />
        )}

        {/* Task #48 — venue default-on chip. Surfaced when the venue
            filter is firing on this query (Reception scope + host's
            default-on OR explicit ?venue=<facet>). Gives couples one-click
            "Show all settings" recovery if the narrowed pool is too small,
            without losing the rest of their filter state.
            2026-05-22 evening — also surfaces when ?venue=<facet> is
            an explicit pick (filter venueFacet wins over host's setting). */}
        {venueFilterFiring && (filters.venueFacet ?? hostVenueSetting) ? (
          <VenueFilterBanner
            settingKey={(filters.venueFacet ?? hostVenueSetting) as string}
            showAllHref={buildHref(filters, { venueDefault: 'off' })}
          />
        ) : null}

        {/* Task #45 — calendar intersection banner. Only renders when the
            host has confirmed vendors AND the precision window narrows the
            commonAvailability to ≤7 days OR empty. Above the grid so the
            host sees the constraint before scrolling candidate cards. */}
        {availability.kind === 'active' &&
          coupleEventId &&
          (availability.availableDays.length === 0 ||
            availability.availableDays.length <= 7) ? (
          <VendorsAvailabilityBanner
            eventId={coupleEventId}
            availableDays={availability.availableDays}
            lockedCount={availability.lockedCount}
            windowLabel={availability.windowLabel}
          />
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            filters={filters}
            broadenedCount={broadenedCount}
            eventTypeLabel={
              filters.eventType ? (eventTypeLabel.get(filters.eventType) ?? filters.eventType) : null
            }
          />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((v) => {
              const ad: ActiveAdLookup | null =
                v.ad_tier && v.ad_sku_code && v.ad_radius_km !== null && v.ad_expires_at
                  ? {
                      vendor_profile_id: v.vendor_profile_id,
                      tier: v.ad_tier,
                      radius_km: v.ad_radius_km,
                      sku_code: v.ad_sku_code as ActiveAdLookup['sku_code'],
                      expires_at: v.ad_expires_at,
                    }
                  : null;
              /* Phase C review-display gate (vendor-tier-caps · surface-layer
                 gate). Stars/count show only when reviewStarsCounted (Free =
                 hidden → card renders "new"); review comment bodies (the
                 carousel) show only when reviewCommentsViewable (Free +
                 Verified hidden, Pro/Ent shown). Gated here, NOT in the shared
                 review libs, so the vendor's own dashboard self-view stays
                 ungated. `?? null` → free → hidden. */
              const vCaps = tierCaps(v.tier_state ?? null);
              const gatedRating = vCaps.reviewStarsCounted
                ? Number(v.avg_rating_overall ?? 0)
                : 0;
              const gatedReviewCount = vCaps.reviewStarsCounted
                ? (v.review_count ?? 0)
                : 0;
              const gatedReviews = vCaps.reviewCommentsViewable
                ? (reviewsByVendorId.get(v.vendor_profile_id) ?? [])
                : [];
              return (
                <li key={v.vendor_profile_id}>
                  {/* 2026-05-22 quick-view redesign — VendorCard
                      replaces the legacy VendorMarketCard. Adds the
                      4-badge row + service hero photo + recent-reviews
                      carousel + "Service by Business" header line per
                      the owner directive (CLAUDE.md decision log). */}
                  <VendorCard
                    vendor={v}
                    rating={gatedRating}
                    reviewCount={gatedReviewCount}
                    isAuthenticated={user !== null}
                    isFollowing={followedSet.has(v.vendor_profile_id)}
                    isSaved={savedSet.has(v.vendor_profile_id)}
                    eventId={coupleEventId}
                    venueAnchor={venueAnchor}
                    ad={ad}
                    badges={badgesByVendorId.get(v.vendor_profile_id) ?? []}
                    reviews={gatedReviews}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          filters={filters}
          page={filters.page}
          totalPages={totalPages}
          total={totalCount ?? rows.length}
        />
      </section>
    </main>
  );
}

function buildHref(
  filters: {
    q: string;
    category: string | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType?: EventTypeFilter | null;
    folder?: WeddingFolder | null;
    tile?: WeddingTile | null;
    venueDefault?: 'on' | 'off';
    focusedMode?: boolean;
    faithFilter?: FaithKey | null;
  },
  patch: Partial<{
    q: string;
    category: string | null | '';
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: EventTypeFilter | null;
    folder: WeddingFolder | null;
    tile: WeddingTile | null;
    venueDefault: 'on' | 'off';
    focusedMode: boolean;
    faithFilter: FaithKey | null;
  }>,
): string {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.category) params.set('category', merged.category);
  if (merged.city) params.set('city', merged.city);
  if (merged.sort && merged.sort !== 'most_reviews') params.set('sort', merged.sort);
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));
  if (merged.verifiedOnly) params.set('verified', '1');
  if (merged.matchEvent) params.set('match', '1');
  if (merged.eventType) params.set('event_type', merged.eventType);
  if (merged.folder) params.set('folder', merged.folder);
  // 10-parent model — preserve tile scope across pagination + filter toggles.
  if (merged.tile) params.set('tile', WEDDING_TILE_SLUG[merged.tile]);
  // Task #48 — only emit ?venue=0 (explicit opt-out). The 'on' default is
  // implicit, so omitting the param keeps URLs short AND means new clicks
  // inherit the default-on behavior unless the user has explicitly toggled
  // off via the chip.
  if (merged.venueDefault === 'off') params.set('venue', '0');
  // Owner directive 2026-05-22 — preserve focused-mode across in-page
  // navigation. Pagination + EmptyState "Clear all filters" + every other
  // self-link on /vendors flows through buildHref, so emitting `from=plan`
  // here keeps the host inside the chrome-stripped layout on every
  // subsequent click. Direct visits never have focusedMode set, so this
  // is a no-op for them.
  if (merged.focusedMode) params.set('from', 'plan');
  // 2026-05-30 — Ceremony Faith pill. Emit ?faith=catholic etc. so the
  // contextual filter survives pagination + chip toggle + every other
  // self-link on /vendors. Absent means "All faiths" (no narrow applied).
  if (merged.faithFilter) {
    params.set('faith', FAITH_KEY_TO_URL[merged.faithFilter]);
  }
  const qs = params.toString();
  return qs.length > 0 ? `/explore?${qs}` : '/explore';
}

/**
 * Focused-mode search-only form (owner directive 2026-05-22).
 *
 * Renders when the host arrived from a dashboard planning card (?from=plan).
 * The full FilterBar — City + Sort by + Verified-only + Match-my-wedding +
 * Apply / Clear — is hidden; only the TaxonomySearch input survives so the
 * host can keep refining within their planning context.
 *
 * Hidden inputs carry every filter that's silently still applied
 * (folder, category, match, venue, eventType, verified, city, sort) +
 * the focused-mode flag itself, so submitting the form keeps the host
 * inside focused-mode AND preserves the planning context they came from.
 * Pagination + EmptyState's "Clear all filters" + every other self-link
 * already pass through `buildHref`, which emits `from=plan` whenever
 * filters.focusedMode is true (see above) — so the focused layout
 * survives every in-page click.
 */
function FocusedModeSearchForm({
  filters,
}: {
  filters: {
    q: string;
    category: string | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: EventTypeFilter | null;
    folder: WeddingFolder | null;
    venueDefault: 'on' | 'off';
    focusedMode: boolean;
  };
}) {
  return (
    <form method="get" action="/explore" className="space-y-2">
      <label className="block">
        <span className="sr-only">Search vendors</span>
        {/* Reuses the same TaxonomySearch client component as FilterBar.
            Picking a suggestion router-pushes to /vendors?category=…, so
            we pass focusedMode through the `preserve` prop so the
            client-side push keeps `from=plan` on the URL. */}
        <TaxonomySearch
          initialQuery={filters.q}
          options={TAXONOMY_OPTIONS}
          preserve={{
            city: filters.city,
            sort: filters.sort,
            verifiedOnly: filters.verifiedOnly,
            matchEvent: filters.matchEvent,
            eventType: filters.eventType,
            folder: filters.folder,
            from: filters.focusedMode ? 'plan' : null,
          }}
        />
      </label>

      {/* Hidden inputs — every filter that's still silently applied,
          plus the focused-mode flag, get carried through form submit.
          Submitting the form (Enter on free-text search) reloads
          /vendors?from=plan&folder=…&… so the layout stays focused and
          the planning context the host arrived with is preserved. */}
      {filters.category ? (
        <input type="hidden" name="category" value={filters.category} />
      ) : null}
      {filters.city ? (
        <input type="hidden" name="city" value={filters.city} />
      ) : null}
      {filters.sort !== 'most_reviews' ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}
      {filters.verifiedOnly ? (
        <input type="hidden" name="verified" value="1" />
      ) : null}
      {filters.matchEvent ? (
        <input type="hidden" name="match" value="1" />
      ) : null}
      {filters.eventType ? (
        <input type="hidden" name="event_type" value={filters.eventType} />
      ) : null}
      {filters.folder ? (
        <input type="hidden" name="folder" value={filters.folder} />
      ) : null}
      {filters.venueDefault === 'off' ? (
        <input type="hidden" name="venue" value="0" />
      ) : null}
      <input type="hidden" name="from" value="plan" />
    </form>
  );
}
function EmptyState({
  filters,
  broadenedCount,
  eventTypeLabel,
}: {
  filters: {
    q: string;
    category: string | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: EventTypeFilter | null;
    folder: WeddingFolder | null;
    venueDefault: 'on' | 'off';
    focusedMode: boolean;
  };
  broadenedCount: number | null;
  /** Couple-facing label for filters.eventType (DB vocab; null when unset). */
  eventTypeLabel: string | null;
}) {
  const hasFilter = !!(
    filters.q ||
    filters.category ||
    filters.city ||
    filters.verifiedOnly ||
    filters.matchEvent ||
    filters.eventType
  );

  // Task #42 (2026-05-22) — "Show all" CTA appears when strict filters
  // (match-my-wedding, verified-only) shrank the result to zero but the
  // broadened scope (same category/city/q/eventType) has inventory. Drops
  // only match + verified; keeps every other filter so the couple stays
  // anchored to the category they were searching.
  const hasStrictFilter = filters.matchEvent || filters.verifiedOnly;
  const showAllHref = buildHref(filters, {
    matchEvent: false,
    verifiedOnly: false,
    page: 1,
  });
  const showAllAvailable =
    hasStrictFilter && broadenedCount !== null && broadenedCount > 0;

  // Iteration 0041 — event-type-specific empty state. When the marketplace
  // is filtered to an event_type and zero vendors match, frame the empty
  // result as "Coming Soon — vendors being recruited" rather than a
  // generic "no matches". Avoids couples on a debut event seeing a silently
  // empty marketplace and assuming the platform is broken. Mirrors the
  // iteration 0043 faith-activation pattern (Coming Soon + future email
  // capture).
  if (filters.eventType && filters.eventType !== 'wedding') {
    const label = eventTypeLabel ?? filters.eventType;
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-terracotta/30 bg-terracotta/[0.04] p-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Coming soon
        </p>
        <p className="mt-3 text-base font-medium text-ink">
          {label} vendors are being recruited for Setnayan.
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
          Setnayan launches each event-type marketplace once enough verified
          vendors are onboarded. Wedding vendors are live now — other event
          types open as their vendor pools mature.
        </p>
        <EventTypeNotifyForm eventType={filters.eventType} label={label} />
        <Link
          href={filters.focusedMode ? '/explore?from=plan' : '/explore'}
          className="mt-4 inline-flex items-center text-sm font-medium text-terracotta underline-offset-4 hover:underline"
        >
          Or browse all vendors instead →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-ink/20 bg-cream p-10 text-center">
      <p className="text-base font-medium text-ink/75">
        {hasFilter
          ? 'No vendors match exactly.'
          : 'No vendors have published their Setnayan profile yet.'}
      </p>
      <p className="mt-1 text-sm text-ink/55">
        {hasFilter
          ? showAllAvailable
            ? `We have ${broadenedCount} vendor${broadenedCount === 1 ? '' : 's'} in this category — try Show all, or clear one filter to widen your search.`
            : 'Try widening your search or clearing one filter at a time.'
          : 'Check back soon — vendors are landing every week.'}
      </p>
      {hasFilter ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {showAllAvailable ? (
            <Link href={showAllHref} className="button-primary inline-flex h-10 px-4">
              Show all
            </Link>
          ) : null}
          {/* Preserve focused-mode when clearing — host stays in the
              chrome-stripped layout. Direct visits never set focusedMode
              so this is a no-op for them. */}
          <Link
            href={filters.focusedMode ? '/explore?from=plan' : '/explore'}
            className="button-secondary inline-flex h-10 px-4"
          >
            Clear all filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}


function Pagination({
  filters,
  page,
  totalPages,
  total,
}: {
  filters: {
    q: string;
    category: string | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: EventTypeFilter | null;
    folder: WeddingFolder | null;
    venueDefault: 'on' | 'off';
    focusedMode: boolean;
  };
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-between gap-2 text-sm text-ink/70"
    >
      <p>
        Page {page} of {totalPages} · {total} vendor{total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <PageLink
          href={page > 1 ? buildHref(filters, { page: page - 1 }) : null}
          label="Previous"
          icon="prev"
        />
        <PageLink
          href={page < totalPages ? buildHref(filters, { page: page + 1 }) : null}
          label="Next"
          icon="next"
        />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: 'prev' | 'next';
}) {
  const cls =
    'inline-flex h-10 items-center gap-1 rounded-md border border-ink/20 px-3 text-sm font-medium';
  if (!href) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-40`}>
        {icon === 'prev' ? <ChevronLeft className="h-4 w-4" /> : null}
        {label}
        {icon === 'next' ? <ChevronRight className="h-4 w-4" /> : null}
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} hover:border-ink/40`}>
      {icon === 'prev' ? <ChevronLeft className="h-4 w-4" /> : null}
      {label}
      {icon === 'next' ? <ChevronRight className="h-4 w-4" /> : null}
    </Link>
  );
}

// ─── Catalog mode ──────────────────────────────────────────────────────────
// Unfiltered landing view. Renders the full 192-category taxonomy grouped by
// the 12 PH-grounded wedding folders so couples see the breadth of services
// Setnayan covers even before vendor pools fill in. Per-tile vendor counts
// come from `fetchVendorCountsByService`; categories with zero vendors render
// in a "Recruiting" or "Coming soon" state per the live phase of the canonical
// service (see `lib/taxonomy.ts`).
//
// Folder #2 (Reception) is filter-only — backed by the venue_setting enum
// rather than canonical_services. Rendered as a special section with seven
// venue-type chips that drill into the marketplace filtered by setting.

type CatalogSchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
};

const CATALOG_PHASE_RANK: Record<TaxonomyPhase, number> = {
  'V1.1 base': 0,
  'V1.1.1': 1,
  'V1.1.2': 2,
  'V1.1.3': 3,
  'V1.1.4': 4,
  'V1.1.5': 5,
  'V1.1.6': 6,
  'V1.2': 7,
  'V1.3': 8,
  'V1.4': 9,
  'V1.5+': 10,
};

/**
 * 2026-05-30 — "Only show categories with vendors" hide-empty filter.
 *
 * Owner directive: the flat 17-tile Ceremony grid mixed live-phase tiles
 * (Catholic Priest, Civil Judge — RECRUITING, vendors can sign up today)
 * with future-phase placeholders (Born Again Pastor, Marriage License
 * Expediting, Apostille — COMING SOON, the canonical_service exists in
 * the spec but no signup surface is open yet). Couples don't need to see
 * the future-phase drawers — they're admin/spec-side scaffolding.
 *
 * Pragmatic interpretation of "only show categories with vendors":
 *   - populated (count.total > 0)   → SHOW
 *   - recruiting (live phase, 0 vendors)  → SHOW (vendor-acquisition surface)
 *   - setnayan (first-party service) → SHOW
 *   - future (V1.2 / V1.3 / V1.4 / V1.5+, no vendors yet)  → HIDE
 *
 * Phases automatically promote out of HIDE as they activate — when
 * V1.2 launches and the V1.2-tagged categories become live, the same
 * tiles will surface as "Recruiting" without further code changes.
 *
 * LIVE_PHASES kept in sync with the same constant in
 * apps/web/app/explore/_components/category-tile.tsx (where it governs
 * the Recruiting vs Coming Soon state pill). If you change one, change
 * both — the tile would render "Coming soon" while the grid showed it,
 * which would be confusing.
 */
const CATALOG_LIVE_PHASES: ReadonlySet<TaxonomyPhase> = new Set([
  'V1.1 base',
  'V1.1.1',
  'V1.1.2',
  'V1.1.3',
  'V1.1.4',
  'V1.1.5',
  'V1.1.6',
]);

// Reception facet definitions moved into apps/web/app/explore/_components/
// reception-venues-section.tsx as part of the 2026-05-22 evening "Pull V1.2
// venue directory forward" PR. The new <ReceptionVenuesSection> owns BOTH
// the chip filter bar AND the venue card grid; this file no longer needs
// the constant.

async function CatalogView({
  admin,
  matchableEvent,
  matchEvent,
  coupleFaith,
  venueAnchor,
  venueAnchorName,
  coupleCeremonyType,
  coupleEventType,
  currentEventId,
  isAuthenticated,
  noticeKey,
  scopedFolder,
  hostVenueSetting,
  venueFilterActive,
  venueFacet,
  inDemoMode,
  focusedMode,
  faithFilter,
  browseMode,
}: {
  admin: ReturnType<typeof createAdminClient>;
  matchableEvent: {
    ceremony_type: string;
    secondary_ceremony_type?: string | null;
    venue_setting: string;
  } | null;
  matchEvent: boolean;
  coupleFaith: CoupleFaith;
  venueAnchor: { lat: number; lng: number } | null;
  venueAnchorName: string | null;
  coupleCeremonyType: string | null;
  /** events.event_type — drives the tile-level multi-event applicability gate. */
  coupleEventType: string | null;
  currentEventId: string | null;
  /** Whether the viewer has a Setnayan session. Drives the header CTA
   *  ("Return to Dashboard" for couples, "Plan with Setnayan" for guests). */
  isAuthenticated: boolean;
  /** Allow-listed notice key from ?notice=… (Task #12). Null when absent or
   *  unknown. Surfaces a polite banner under the header explaining a
   *  redirected-from-deferred-feature landing. */
  noticeKey: string | null;
  /** Task #47 — when non-null, render only the named folder section. Hides
   *  the other 11 folders + the PairedVenuePanel (which surfaces ceremony
   *  venues regardless of viewport position; the dashboard Reception
   *  Search button previously landed users on Reception with the entire
   *  Ceremony folder + paired-venue church cards rendered directly above,
   *  reading as "the churches still showed in Reception"). Null when the
   *  user came in via the universal Browse path (top-nav, sitemap, direct
   *  visit) — full 12-folder catalog renders as before. */
  scopedFolder: WeddingFolder | null;
  /** Task #48 — host's events.venue_setting (snake_case enum). Null on
   *  anonymous browse OR for hosts who haven't picked one yet. Drives the
   *  VenueFilterBanner / VenuePickerHint surface in the Reception folder
   *  section, plus the per-facet "your setting" highlight on the chips. */
  hostVenueSetting: string | null;
  /** Task #48 — true when the venue default-on filter is currently
   *  active (host has a setting + ?venue is NOT 0). Drives the banner
   *  surface AND the auto-applied venue param on Reception facet drill-
   *  ins so the host stays scoped. */
  venueFilterActive: boolean;
  /** 2026-05-22 evening — explicit `?venue=<facet>` pick from the URL.
   *  Null when the URL uses the on/off toggle form. When set, the
   *  Reception folder's FacetFilterBar renders this chip as the active
   *  one + the card grid narrows to that facet's venue_type. */
  venueFacet: string | null;
  /** 2026-05-22 evening — admin demo mode. When true, the Reception card
   *  grid includes `is_demo=TRUE` venue_directory rows + each card
   *  surfaces a DEMO chip overlay on its hero photo. */
  inDemoMode: boolean;
  /** Owner directive 2026-05-22 — focused-mode chrome toggle. When TRUE
   *  (host arrived from a dashboard planning card via ?from=plan), the
   *  catalog MARKETPLACE eyebrow + headline + paragraph + CatalogFilterBar
   *  + ReligionBanner are all hidden. The FolderTabs + per-folder grid
   *  STILL render so the host can browse within their planning context.
   *  Direct visits to /vendors render the full chrome unchanged. */
  focusedMode: boolean;
  /** 2026-05-30 — explicit Ceremony faith narrow from the StickyMarketplaceHeader
   *  contextual pill. When set, filter tile rendering to faith === filter OR
   *  faith === undefined (no-faith tiles always cross-surface — civil judge,
   *  generic officiant, marriage license expediting, CFO seminar, apostille
   *  all stay regardless of faith pick). Null = no explicit narrow; the
   *  pre-existing religion-default-on (matchEvent + coupleFaith) takes
   *  precedence. */
  faithFilter: FaithKey | null;
  /** 2026-06-14 search-first — when false (a bare Explore landing) the curated
   *  browse catalog below the hero is suppressed; only the search hero + a
   *  "Browse all categories" link render. True for explicit browse/context
   *  visits (?browse=1 / folder / tile / from=plan). */
  browseMode: boolean;
}) {
  // Phase 2b·2 — read the taxonomy from the DB snapshot so admin renames /
  // re-orders show on the live marketplace catalog (fallback-safe: getTaxonomy
  // → lib/taxonomy.ts constant). Local shadows so every reference in
  // CatalogView resolves to the snapshot without per-site edits.
  // Casts restore the original constants' exact-key Record types (the snapshot
  // is keyed by string; it carries the same keys, seeded from the constant) so
  // every existing reference type-checks unchanged under noUncheckedIndexedAccess.
  const tax = await getTaxonomy();
  const TAXONOMY_MAP = tax.map;
  const WEDDING_FOLDER_ORDER = tax.folderOrder;
  const WEDDING_FOLDER_LABEL = tax.folderLabel as Record<WeddingFolder, string>;
  const WEDDING_FOLDER_SHORT_LABEL = tax.folderShortLabel as Record<WeddingFolder, string>;
  const WEDDING_FOLDER_SLUG = tax.folderSlug as Record<WeddingFolder, string>;
  const WEDDING_TILE_LABEL = tax.tileLabel as Record<WeddingTile, string>;
  const WEDDING_TILE_SLUG = tax.tileSlug as Record<WeddingTile, string>;
  const WEDDING_TILE_ORDER = tax.tileOrder;
  const WEDDING_TILES_BY_PARENT = tax.tilesByParent as Record<WeddingFolder, WeddingTile[]>;
  const TILE_PARENT = tax.tileParent as Record<WeddingTile, WeddingFolder>;
  // Single round-trip per page render — both reads are admin-scoped because
  // anonymous visitors hit this route and `vendor_profiles` is gated by RLS.
  // 2026-05-22 evening — also fetch the demo vendor ID list so the inline
  // FolderVendorsSection + the CategoryTile "Sample: …" preview line can
  // exclude demo vendors when the viewer isn't in demo mode (mirrors the
  // exclusion the vendor-grid query already applies).
  const [{ data: schemaRows }, vendorCounts, demoVendorIdsRaw] = await Promise.all([
    admin
      .from('canonical_service_schemas')
      .select('canonical_service, display_name_en, display_name_tl')
      .order('display_name_en', { ascending: true }),
    fetchVendorCountsByService(admin),
    inDemoMode ? Promise.resolve([] as string[]) : fetchDemoVendorIds(admin),
  ]);

  const schemas = (schemaRows ?? []) as CatalogSchemaRow[];
  const catalogExcludeVendorIds: ReadonlyArray<string> = inDemoMode
    ? []
    : demoVendorIdsRaw;

  // Popular-search chips for the hero = top categories by live vendor count
  // (owner directive 2026-06-14 — "Popular searches" under the bare search
  // bar). Falls back to the curated EXPLORE_HERO_CHIPS when no vendor has
  // stocked a category yet (pre-launch) so the chip row is never empty.
  const popularChips: ReadonlyArray<ExploreChip> = Array.from(
    vendorCounts.entries(),
  )
    .filter(([, c]) => c.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([key]) => ({
      label: taxonomyLabel(key),
      href: `/explore?category=${encodeURIComponent(key)}`,
    }));
  const heroChips = popularChips.length > 0 ? popularChips : EXPLORE_HERO_CHIPS;

  // Religion-default-on: when the couple has a faith (ceremony_type maps to
  // Catholic/Christian/INC/Muslim/Cultural), hide tiles tagged for OTHER
  // faiths. Untagged tiles always surface — they're the cross-faith base.
  // Civil couples (coupleFaith=null) keep all faith-tagged tiles hidden when
  // matchEvent is on. Anonymous visitors see everything.
  //
  // 2026-05-30 — explicit faithFilter (the Sticky header's Ceremony pill)
  // wins over the auto-derived coupleFaith. Resolution order:
  //   1. faithFilter set → use it (any visitor, signed-in or not)
  //   2. matchEvent ON + coupleFaith → fall back to auto-derived
  //   3. otherwise → no faith narrow (all tiles surface, modulo hide-empty)
  // The "untagged-tiles-always-surface" rule still holds across all
  // three branches (civil judge, generic officiant, marriage license,
  // CFO, apostille all stay regardless of pick).
  // SET-based rewrite (2026-06-11, design doc §3): the filter set is the
  // UNION of the couple's primary + secondary rites, so a Mixed/inter-faith
  // couple sees BOTH rites' specialist services (the scalar version read only
  // the primary). Civil maps to the first-class 'Civil' key — universal +
  // civil-officiant canonicals pass, religious-tagged ones don't (this makes
  // the code match the documented intent above). Wedding-guarded inside
  // buildCoupleFaithSet (defense-in-depth alongside the 20260521080000
  // wedding↔ceremony_type constraint). An explicit faithFilter pill still
  // overrides everything as a single-member set.
  const religionFilteringActive = matchEvent && matchableEvent !== null;
  const activeFaithSet: ReadonlySet<string> = faithFilter
    ? new Set([faithFilter])
    : religionFilteringActive && matchableEvent
      ? buildCoupleFaithSet({
          eventType: coupleEventType,
          ceremonyType: matchableEvent.ceremony_type,
          secondaryCeremonyType: matchableEvent.secondary_ceremony_type ?? null,
        })
      : new Set<string>();
  const passesReligionFilter = (meta: { faith?: WeddingFaithKey }): boolean =>
    passesFaithFilter(meta.faith ?? null, activeFaithSet);

  // 2026-05-30 — "Only show categories with vendors" hide-empty filter.
  // Future-phase tiles with zero vendors (V1.2 / V1.3 / V1.4 / V1.5+) drop
  // off the couple-facing browse — they're admin/spec-side scaffolding
  // until the phase activates. See CATALOG_LIVE_PHASES doc comment above
  // for the full ruleset + auto-promotion behavior as phases launch.
  const passesHideEmpty = (
    meta: { phase: TaxonomyPhase; setnayan?: boolean },
    count: VendorCount | null,
  ): boolean => {
    if (meta.setnayan) return true;
    if ((count?.total ?? 0) > 0) return true;
    return CATALOG_LIVE_PHASES.has(meta.phase);
  };

  // Bucket every schema row into its wedding folder. Rows whose canonical_service
  // is missing from TAXONOMY_MAP are dropped — same behaviour as the legacy
  // /vendors/categories page; the admin viewer surfaces drift separately.
  // 2026-05-22 evening — also collect the populated canonical_services so
  // we can batch-fetch top-3 vendor names per service in ONE round-trip,
  // populating the CategoryTile "Sample: A · B · C" preview line.
  // 2026-05-22 cross-listing — services with `secondary_folders` are pushed
  // into BOTH the primary folder and every secondary folder. The CategoryTile
  // for a secondary-folder placement reads `isSecondaryListing=true` so it
  // can surface a subtle "Primary folder · Planning" line letting couples
  // know the vendor's home category — per owner directive *"most hotels also
  // provide catering"*, hotels surface in catering search alongside dedicated
  // caterers.
  const populatedServices: string[] = [];
  const buckets = new Map<WeddingFolder, CategoryTileData[]>();
  for (const folder of WEDDING_FOLDER_ORDER) {
    buckets.set(folder, []);
  }
  // 10-parent model (2026-05-31) — build ONE card per TILE (a group of
  // canonicals), grouped under its parent. The same canonical KEYS still
  // back the vendor queries (vendors keep their services[] tags); a tile
  // just aggregates several canonicals into one shopping decision. Venue-
  // parent tiles (Reception, Ceremony) render via the venue pickers below,
  // not as category cards, so they're skipped here. Tiles with zero
  // canonicals (e.g. Editorial, no canonical yet) or whose canonicals are
  // all hidden / filtered out don't render.
  const tileCanonicalsForSamples = new Map<WeddingTile, string[]>();
  for (const tile of WEDDING_TILE_ORDER) {
    const parent = TILE_PARENT[tile];
    if (parent === 'venue') continue;
    // Multi-event applicability (Phase 1 wiring): a tile scoped to specific
    // event types drops out for non-matching events. NULL = universal
    // (fail-open) — today every tile is NULL, so weddings see no change;
    // this gate activates as admins scope tiles on /admin/taxonomy.
    if (!passesEventTypeFilter(tax.tileEventTypes[tile] ?? null, coupleEventType)) continue;
    const canonicals = (await getCanonicalBuckets()).byTile.get(tile) ?? [];
    if (canonicals.length === 0) continue;

    // 10-parent tile model (2026-05-31): a tile shows if ANY of its
    // canonicals passes the religion filter. The hide-empty rule that
    // suppressed future-phase placeholder CANONICALS in the old 196-row
    // model is intentionally NOT applied at tile granularity — all ~48
    // curated tiles are first-class V1 browse categories the owner wants
    // visible, even when their underlying canonicals are V1.2-phase (e.g.
    // Jewelleries, Grooming, Wellness, Outdoor, Fireworks, Orchestra). An
    // empty tile renders as "Recruiting" (vendor-acquisition surface), not
    // "Coming soon" — so the tile-level phase is pinned live below.
    const visible = canonicals
      .map((c) => ({ c, m: TAXONOMY_MAP[c], cnt: vendorCounts.get(c) ?? null }))
      .filter(
        (x): x is { c: string; m: TaxonomyEntry; cnt: VendorCount | null } =>
          x.m !== undefined && passesReligionFilter(x.m),
      );
    if (visible.length === 0) continue;

    // Aggregate count + facet flags across the surviving canonicals.
    let verified = 0;
    let comingSoon = 0;
    let anyPh = false;
    const faiths = new Set<string>();
    let hasFaithless = false;
    // Tile rolls up to its most-launched (lowest-rank) phase across its
    // surviving canonicals, so a tile with any live-phase service reads as
    // live/recruiting under the hide-empty filter (CATALOG_LIVE_PHASES).
    // `visible.length === 0` is guarded above, so visible[0] always exists.
    let bestPhase: TaxonomyPhase = visible[0]!.m.phase;
    for (const { c, m, cnt } of visible) {
      if (CATALOG_PHASE_RANK[m.phase] < CATALOG_PHASE_RANK[bestPhase]) {
        bestPhase = m.phase;
      }
      if (m.ph) anyPh = true;
      if (m.faith) faiths.add(m.faith);
      else hasFaithless = true;
      if (cnt) {
        verified += cnt.verified;
        comingSoon += cnt.coming_soon;
      }
      if ((cnt?.total ?? 0) > 0) populatedServices.push(c);
    }
    const total = verified + comingSoon;
    // Tile-level faith badge: only when the whole tile is one faith (no
    // faithless canonical + exactly one distinct faith). Mixed-faith tiles
    // (e.g. Bride's Attire = neutral + Muslim + INC variants) show no badge.
    const tileFaith =
      !hasFaithless && faiths.size === 1
        ? (Array.from(faiths)[0] as TaxonomyEntry['faith'])
        : undefined;
    // Synthesized tile-level meta. `setnayan` is intentionally FALSE —
    // tiles never carry a "Setnayan" label; first-party services surface as
    // an option inside the tile's grid (flagged on the canonical).
    const meta: TaxonomyEntry = {
      folder: parent,
      tile,
      phase: bestPhase,
      ...(tileFaith ? { faith: tileFaith } : {}),
      ...(anyPh ? { ph: true as const } : {}),
    };
    buckets.get(parent)?.push({
      // `canonicalService` holds the tile key for tile cards — used as the
      // React key + the sample-name lookup. The drill-in uses `tileSlug`.
      canonicalService: tile,
      tileSlug: WEDDING_TILE_SLUG[tile],
      displayNameEn: WEDDING_TILE_LABEL[tile],
      displayNameTl: null,
      meta,
      count: total > 0 ? { verified, coming_soon: comingSoon, total } : null,
    });
    tileCanonicalsForSamples.set(
      tile,
      visible.map((x) => x.c),
    );
  }

  // 2026-05-22 evening — fetch top-3 vendor names per populated
  // canonical_service in a single round-trip, then aggregate per tile.
  // Empty map (zero rows OR query error) → tiles fall back to their
  // existing copy without the preview line, so the catalog stays clean.
  const topVendorNamesByService = populatedServices.length > 0
    ? await fetchTopVendorNamesByService(admin, {
        services: populatedServices,
        perServiceLimit: 3,
        excludeVendorIds: catalogExcludeVendorIds,
      })
    : new Map<string, string[]>();

  // Stamp each tile card with up to 3 sample vendor names aggregated across
  // the tile's surviving canonicals (deduped, design order).
  for (const tiles of buckets.values()) {
    for (const card of tiles) {
      const cs = tileCanonicalsForSamples.get(card.canonicalService as WeddingTile);
      if (!cs) continue;
      const names: string[] = [];
      for (const c of cs) {
        for (const n of topVendorNamesByService.get(c) ?? []) {
          if (!names.includes(n)) names.push(n);
          if (names.length >= 3) break;
        }
        if (names.length >= 3) break;
      }
      if (names.length > 0) card.sampleVendorNames = names;
    }
  }

  // Sort each parent: populated tiles first; stable sort preserves the
  // curated WEDDING_TILE_ORDER within each tier (so the design order holds
  // for the sparse-data pilot rather than scrambling alphabetically).
  for (const tiles of buckets.values()) {
    tiles.sort((a, b) => {
      const aPop = (a.count?.total ?? 0) > 0 ? 0 : 1;
      const bPop = (b.count?.total ?? 0) > 0 ? 0 : 1;
      return aPop - bPop;
    });
  }

  // Count visible TILES across all parents (10-parent model). Reflects what
  // the couple actually sees after the religion + hide-empty filters. Venue's
  // 2 tiles (Reception, Ceremony) render via the venue pickers rather than
  // buckets, so add them explicitly.
  let totalCategories = WEDDING_TILES_BY_PARENT.venue.length;
  let totalLive = 0;
  for (const tiles of buckets.values()) {
    totalCategories += tiles.length;
    for (const c of tiles) if ((c.count?.total ?? 0) > 0) totalLive += 1;
  }
  void totalLive; // computed for parity; surfaced in future copy if needed

  // Tab strip — 10 parent chips. Venue's badge counts its 2 venue tiles
  // (Reception + Ceremony) since those render via the venue pickers, not
  // category buckets.
  const tabs: FolderTab[] = WEDDING_FOLDER_ORDER.map((folder) => ({
    folder,
    label: WEDDING_FOLDER_SHORT_LABEL[folder],
    slug: WEDDING_FOLDER_SLUG[folder],
    count:
      folder === 'venue'
        ? WEDDING_TILES_BY_PARENT.venue.length
        : buckets.get(folder)?.length ?? 0,
  }));

  // 2026-06-13 search-first reframe — the catalog landing's StickyMarketplaceHeader
  // (pinned search pill + FilterDrawer) is replaced by ExploreSearchHero (one
  // big universal search box + quick chips). The drawer's cross-folder Faith
  // option list + drawer-shape faith value that USED to be computed here are
  // gone with it. Faith filtering still lives in the FilterDrawer in vendor-grid
  // mode (the StickyMarketplaceHeader render path at the top of the file is
  // untouched); the public Explore LANDING simplifies to search-first per the
  // owner directive "ONE clean universal search box … keep it dead simple."

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          {isAuthenticated ? (
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

      <NoticeBanner noticeKey={noticeKey} />

      <section
        id="all"
        // 2026-06-13 — pb reduced from pb-36 to pb-16: the catalog landing's
        // fixed bottom-pinned StickyMarketplaceHeader was retired in favour of
        // the top ExploreSearchHero, so the mobile bottom-bar clearance is no
        // longer needed. sm:py-14 overrides on desktop. Page-level max-w-6xl
        // cap retired in PR #655.
        className="mx-auto w-full px-4 pt-6 pb-16 sm:px-6 sm:py-14 lg:px-8"
      >
        {/* Focused-mode (owner directive 2026-05-22) — when ?from=plan is
            set, the host arrived from a dashboard planning card. Strip
            the search hero; render the slim FocusedModeSearchForm instead.
            The FolderTabs and per-folder grid below STILL render so the
            host can browse within their planning context. Direct visits to
            /vendors render the full search-first hero. */}
        {!focusedMode ? (
          <>
            {/* 2026-06-13 search-first reframe — owner directive verbatim:
                "opens with ONE clean universal search box … simple, modern,
                clean, strategic … lead with search, simplify."

                Retired: the catalog landing's StickyMarketplaceHeader (pinned
                44pt search pill + FilterDrawer trigger, bottom-pinned on
                mobile). It now leads with ExploreSearchHero — one big centered
                universal search box (Clean-Editorial --m-* tokens) + a few
                quick-search chips. The same TaxonomySearch autocomplete backs
                it (its option list already spans the setnayan_* first-party
                services), and results land in the existing vendor-grid path.
                The rich category browse (IconTileFolderStrip + folder grids)
                still renders below as the breadth/"browse everything" surface.
                The vendor-grid StickyMarketplaceHeader (top of file) — with the
                full FilterDrawer — is untouched; landing-mode filters simplify
                to search-first. ReligionBanner stays below the hero so the
                per-event compatibility note still surfaces for couples with an
                in-progress event. */}
            <ExploreSearchHero
              taxonomyOptions={TAXONOMY_OPTIONS}
              scopedFolder={scopedFolder}
              preserve={{
                city: '',
                sort: 'most_reviews',
                verifiedOnly: false,
                matchEvent,
                eventType: null,
                folder: scopedFolder,
              }}
              chips={heroChips}
            />

            {religionFilteringActive ? (
              <ReligionBanner
                coupleFaith={coupleFaith}
                ceremonyType={matchableEvent!.ceremony_type}
              />
            ) : null}
          </>
        ) : (
          /* Focused-mode replacement: a slim search form with only the
             TaxonomySearch input. Submitting / suggestion-pick preserves
             folder + from=plan via hidden inputs + the TaxonomySearch
             preserve prop so the host stays in focused-mode. */
          <FocusedModeSearchForm
            filters={{
              q: '',
              category: null,
              city: '',
              sort: 'most_reviews',
              page: 1,
              verifiedOnly: false,
              matchEvent,
              eventType: null,
              folder: scopedFolder,
              venueDefault: 'on',
              focusedMode: true,
            }}
          />
        )}

        {/* 2026-06-14 search-first — owner "we just want a search bar". The
            curated browse catalog below the hero (icon strip + venue pickers +
            folder grids) renders only on an explicit browse/context visit
            (?browse=1 / folder / tile / from=plan); a bare Explore landing
            shows the hero + popular chips, with the catalog one tap away via
            the "Browse all categories" link in the else branch. */}
        {browseMode ? (
          <>
        {/* 2026-05-30 Airbnb-vibe redesign — IconTileFolderStrip replaces the
            chip-style FolderTabs. The 12 folders render as Lucide icon tiles
            (uniform 96-104px × 78px) with horizontal scroll snap on mobile.
            Behavior contract preserved verbatim from FolderTabs — same
            scopedFolder routing, same IntersectionObserver scroll-tracking
            on unscoped mode, same hash + sibling-param preservation on
            scoped mode. See _components/icon-tile-folder-strip.tsx WHY
            block. */}
        <IconTileFolderStrip
          tabs={tabs}
          totalCount={totalCategories}
          scopedFolder={scopedFolder}
        />

        {scopedFolder !== null ? (
          <ScopedFolderBanner folder={scopedFolder} />
        ) : null}

        {/* PairedVenuePanel surfaces ceremony venue cards (churches /
            mosques / civil registrars). It belongs to the Ceremony folder
            conceptually. When the catalog is scoped to a non-ceremony
            folder via ?folder=… (e.g. Reception), suppress it so the
            scoped view stays single-folder per the owner directive. */}
        {venueAnchor && (scopedFolder === null || scopedFolder === 'venue') ? (
          <PairedVenuePanel
            anchor={{
              lat: venueAnchor.lat,
              lng: venueAnchor.lng,
              name: venueAnchorName,
            }}
            coupleCeremonyType={coupleCeremonyType}
            currentEventId={currentEventId}
          />
        ) : null}

        {WEDDING_FOLDER_ORDER.map((folder) => {
          // Task #47 — when the catalog is scoped to a single parent, skip
          // every other parent section so couples landing on one parent
          // (e.g. Venue) don't also see the rest.
          if (scopedFolder !== null && folder !== scopedFolder) return null;

          // VENUE parent — Reception + Ceremony are venue_directory /
          // venue_setting backed, NOT category cards. Render the two venue
          // pickers (Ceremony venue panel + cards, Reception facet picker +
          // cards). Officiants auto-resolve from the ceremony venue (Card 04,
          // 2026-05-29); pre-marriage paperwork lives in the Setnayan AI
          // wizard. The PairedVenuePanel (church/mosque/civil cards near the
          // host's venue) renders above this loop. Sub-block ids match
          // WEDDING_TILE_SLUG so dashboard venue [Search] deep-links anchor
          // to the right picker (?folder=venue#reception / #ceremony-venue).
          if (folder === 'venue') {
            return (
              <section
                key={folder}
                id={WEDDING_FOLDER_SLUG.venue}
                className="scroll-mt-20 pt-8 sm:pt-10"
                aria-labelledby="venue-heading"
              >
                <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                  <h2
                    id="venue-heading"
                    className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
                  >
                    {WEDDING_FOLDER_LABEL.venue}
                  </h2>
                  <span className="font-mono text-xs text-ink/55">
                    Ceremony &amp; reception
                  </span>
                </header>

                <div className="mb-10 scroll-mt-24" id={WEDDING_TILE_SLUG.ceremony_venue}>
                  <h3 className="mb-3 text-base font-semibold tracking-tight text-ink">
                    {WEDDING_TILE_LABEL.ceremony_venue}
                  </h3>
                  <CeremonyVenuePanel />
                  <CeremonyVenuesSection
                    coupleCeremonyType={coupleCeremonyType}
                    venueAnchor={venueAnchor}
                    currentEventId={currentEventId}
                  />
                </div>

                <div className="scroll-mt-24" id={WEDDING_TILE_SLUG.reception}>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-tight text-ink">
                      {WEDDING_TILE_LABEL.reception}
                    </h3>
                    <span className="font-mono text-xs text-ink/55">
                      6 venue settings
                    </span>
                  </div>
                  <ReceptionVenuesSection
                    hostVenueSetting={hostVenueSetting}
                    venueFilterActive={venueFilterActive}
                    activeFacet={venueFacet}
                    venueAnchor={venueAnchor}
                    currentEventId={currentEventId}
                    isDemoMode={inDemoMode}
                  />
                </div>
              </section>
            );
          }

          const tiles = buckets.get(folder) ?? [];
          // Non-venue parents return null when they have zero visible tiles —
          // no placeholder content to show.
          if (tiles.length === 0) return null;
          const slug = WEDDING_FOLDER_SLUG[folder];
          return (
            <section
              key={folder}
              id={slug}
              className="scroll-mt-20 pt-8 sm:pt-10"
              aria-labelledby={`${slug}-heading`}
            >
              <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                <h2
                  id={`${slug}-heading`}
                  className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
                >
                  {WEDDING_FOLDER_LABEL[folder]}
                </h2>
                <span className="font-mono text-xs text-ink/55">
                  {tiles.length} {tiles.length === 1 ? 'category' : 'categories'}
                </span>
              </header>
              {/* Inline real-vendor preview cards from vendor_profiles
                  (parent-level top vendors). Renders above the tile grid so
                  couples see actual named businesses immediately. Empty
                  parents (zero signed-up vendors) skip the section. */}
              <FolderVendorsSection
                folder={folder}
                excludeVendorIds={catalogExcludeVendorIds}
                venueAnchor={venueAnchor}
                currentEventId={currentEventId}
                focusedMode={focusedMode}
              />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tiles.map((tile) => (
                  <li key={tile.canonicalService}>
                    <CategoryTile data={tile} focusedMode={focusedMode} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
          </>
        ) : (
          <div className="mt-12 text-center">
            <Link
              href="/explore?browse=1"
              className="inline-flex items-center rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
            >
              Browse all categories →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

// Inline ReceptionSection wrapper used to live here, rendering the 7-chip
// stub above ReceptionVenuesSection. Retired with the 2026-05-22 evening
// "Pull V1.2 venue directory forward" PR — the new ReceptionVenuesSection
// renders its own FacetFilterBar + venue cards in a single self-contained
// section, and the catalog loop in CatalogView invokes it directly inside
// a slim wrapper <section> with the folder heading. The chip grid is gone;
// the chip filter bar inside the section takes over its job AND filters
// the card grid live (vs the old chips which never filtered anything).
//
// VenueFilterBanner (below) is still in use by vendor-grid mode — it stays.
// VenuePickerHint was retired in the same pass (used only by the deleted
// ReceptionSection).

// Task #48 (2026-05-22) — venue_setting default-on banner. Surfaces in
// BOTH catalog mode (Reception folder section, when the host has a
// venue_setting picked) AND vendor-grid mode (whenever the URL is
// Reception-scoped with the filter firing). Mirrors the religion-match
// pattern from ReligionBanner — explains what the filter is, why it's
// firing, and gives a one-click escape ("Show all settings") that flips
// ?venue=0 without losing the rest of the URL state. Brand-voice copy
// stays in lockstep with VENUE_SETTING_LABEL so the host reads the same
// wording everywhere they encounter their picked setting.
function VenueFilterBanner({
  settingKey,
  showAllHref,
}: {
  settingKey: string;
  showAllHref: string;
}) {
  const longLabel = venueSettingLongLabel(settingKey);
  const shortLabel = venueSettingShortLabel(settingKey);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 px-4 py-3">
      <p className="text-sm text-ink/80">
        Showing vendors who work with{' '}
        <span className="font-medium text-terracotta-700">{shortLabel}</span>{' '}
        venues — your wedding&rsquo;s picked setting (
        <span className="font-mono text-xs text-ink/60">{longLabel}</span>).
      </p>
      <Link
        href={showAllHref}
        className="inline-flex shrink-0 items-center rounded-full border border-terracotta/30 bg-cream px-3 py-1 text-xs font-medium text-terracotta-700 hover:border-terracotta hover:bg-terracotta/10"
      >
        Show all venue settings
      </Link>
    </div>
  );
}

// VenuePickerHint (Task #48 catalog-mode nudge) used to live here but was
// retired with the 2026-05-22 evening "Pull V1.2 venue directory forward"
// PR — the new ReceptionVenuesSection renders real venue cards regardless
// of whether the host has a venue_setting picked, plus a dedicated empty-
// state when the filter narrows to 0 venues. The chip-grid nudge is no
// longer needed.

// Task #47 — scoped-folder banner. Renders when the catalog is showing
// only one of the 12 folders (driven by ?folder=… from the dashboard
// planning-group [Search] buttons). Tells the couple what they're looking
// at and gives them a one-click escape to the full universal catalog if
// they want to browse outside the locked scope. The FolderTabs strip
// above this banner is still active — a click on any other folder chip
// preserves scope (they want THAT folder); the "Browse all folders" link
// drops the scope entirely.
async function ScopedFolderBanner({ folder }: { folder: WeddingFolder }) {
  const tax = await getTaxonomy();
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-cream px-4 py-3">
      <p className="text-sm text-ink/80">
        Showing{' '}
        <span className="font-medium text-ink">
          {tax.folderLabel[folder] ?? folder}
        </span>{' '}
        only — the other 11 folders are hidden so you can focus.
      </p>
      <Link
        href="/explore"
        className="inline-flex shrink-0 items-center rounded-full border border-ink/20 bg-cream px-3 py-1 text-xs font-medium text-ink/75 hover:border-ink/40 hover:bg-ink/5"
      >
        Browse all folders
      </Link>
    </div>
  );
}

// Religion-default-on banner. Tells the couple that the catalog is filtered
// to their faith and offers a one-click escape to see everything.
function ReligionBanner({
  coupleFaith,
  ceremonyType,
}: {
  coupleFaith: CoupleFaith;
  ceremonyType: string;
}) {
  const faithLabel =
    coupleFaith ?? (ceremonyType === 'civil' ? 'civil (secular)' : ceremonyType);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 px-4 py-3">
      <p className="text-sm text-ink/80">
        Showing your{' '}
        <span className="font-medium text-terracotta-700">{faithLabel}</span>{' '}
        wedding — faith-specific tiles auto-filtered. Cross-faith services
        (photo, catering, attire) stay visible.
      </p>
      <Link
        href="/explore?match=0"
        className="inline-flex shrink-0 items-center rounded-full border border-terracotta/30 bg-cream px-3 py-1 text-xs font-medium text-terracotta-700 hover:border-terracotta hover:bg-terracotta/10"
      >
        Show all faiths
      </Link>
    </div>
  );
}

// Static info panel inside Ceremony folder. Tells the couple WHERE their
// ceremony will physically happen for each path: religious venue (off-platform
// parish booking), civil registrar (LGU government), or combined venue (cross-
// link to #2). Closes the V1 gap where ceremony venues aren't bookable in the
// marketplace yet.
// 2026-05-30 PM — FaithPillRow component RETIRED. Lived here from PRs
// #657 + #659 to render the inline faith narrow chips above every faith-
// bearing folder section. Owner directive *"why are these still showing.
// they should be embedded inside the filter"* moved faith into the
// FilterDrawer's `<select name="faith">` — see crossFolderFaithOptions
// wired into the StickyMarketplaceHeader render inside CatalogView. The
// drawer is the canonical home for global filters (City + Sort + Verified-
// only + Match-my-wedding + Show-all-venues + Faith) so couples have one
// edit surface for narrowing the catalog.

function CeremonyVenuePanel() {
  return (
    <div className="mb-4 rounded-2xl border border-terracotta/20 bg-terracotta/5 p-4 sm:p-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
        Where will your ceremony happen?
      </p>
      <ul className="space-y-2 text-sm text-ink/80">
        <li>
          <span className="font-medium text-ink">
            At your church / mosque / chapel
          </span>{' '}
          — book directly with the parish office. Setnayan helps you find the
          officiant + handle pre-marriage requirements below.
        </li>
        <li>
          <span className="font-medium text-ink">At the courthouse</span> — go
          to your LGU&rsquo;s Civil Registrar. Setnayan helps you find a Civil
          Judge / Mayor / JP + expedite your marriage license.
        </li>
        <li>
          <span className="font-medium text-ink">
            At your reception venue (combined)
          </span>{' '}
          — pick a garden / beach / destination / heritage / outdoor venue from{' '}
          <a
            href={`#${WEDDING_TILE_SLUG.reception}`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            Reception
          </a>{' '}
          that&rsquo;s tagged &ldquo;also hosts ceremony&rdquo;.
        </li>
      </ul>
    </div>
  );
}
