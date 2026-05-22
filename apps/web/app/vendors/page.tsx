import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { Star, MapPin, ChevronLeft, ChevronRight, Navigation, Sparkles } from 'lucide-react';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { displayServiceLabel, formatPhp } from '@/lib/vendors';
import {
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
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
import { FolderTabs, type FolderTab } from './_components/mega-column-tabs';
import { PairedVenuePanel } from './_components/paired-venue-panel';
import { CeremonyVenuesSection } from './_components/ceremony-venues-section';
import { ReceptionVenuesSection } from './_components/reception-venues-section';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
  type TaxonomyPhase,
} from '@/lib/taxonomy';
import {
  fetchTopVendorNamesByService,
  fetchVendorCountsByService,
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

export const metadata = {
  title: 'Vendors — Setnayan',
  description:
    'Browse Filipino wedding vendors on Setnayan. Photographers, caterers, coordinators, florists, and more.',
};

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
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm text-ink/80">
          <span className="font-medium text-ink">{copy.title}</span>{' '}
          <span className="text-ink/70">{copy.body}</span>
        </p>
      </div>
    </div>
  );
}

// Iteration 0041 — multi-event support. Filter chip on `vendor_profiles.event_types[]`
// (migration 20260521090000). Mirrors the live `public.event_type` enum; keep in
// sync when new event_type values are added.
const ALLOWED_EVENT_TYPE_FILTERS = [
  'wedding',
  'gender_reveal',
  'debut',
  'birthday',
  'celebration',
  'travel',
  'corporate',
  'tournament',
  'christening',
] as const;
type EventTypeFilter = (typeof ALLOWED_EVENT_TYPE_FILTERS)[number];

// Couple-facing labels for the empty-state framing. Stays in sync with the
// `EVENT_TYPES` list in apps/web/app/dashboard/create-event/_components/event-type-picker.tsx.
const EVENT_TYPE_LABEL: Record<EventTypeFilter, string> = {
  wedding: 'Wedding',
  gender_reveal: 'Gender Reveal',
  debut: 'Debut',
  birthday: 'Birthday',
  celebration: 'Celebration',
  travel: 'Travel',
  corporate: 'Corporate',
  tournament: 'Tournament',
  christening: 'Christening',
};

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
   *  Absent / invalid → render all 12 folders (universal Browse). */
  folder: WeddingFolder | null;
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
  const eventType = (ALLOWED_EVENT_TYPE_FILTERS as readonly string[]).includes(raw.event_type ?? '')
    ? (raw.event_type as EventTypeFilter)
    : null;
  // Task #47 — catalog-mode folder scope. Validate against the canonical
  // 12-folder enum. Invalid / typo / null all fall back to unscoped.
  const rawFolder = (raw.folder ?? '').trim();
  const folder = (WEDDING_FOLDER_ORDER as readonly string[]).includes(rawFolder)
    ? (rawFolder as WeddingFolder)
    : null;
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
    venueDefault,
    venueFacet,
  };
}

/**
 * Fetch the list of vendor_profile_id values flagged `is_demo=TRUE`.
 * Used by the marketplace + the broadened empty-state count to exclude
 * demo vendors when demo mode is off, and to annotate cards with the
 * DEMO chip when demo mode is on.
 *
 * Defensive against Agent 1's `is_demo` column not yet being on main:
 * any PostgREST error containing "is_demo" is swallowed and an empty
 * array returned. Under that fallback the marketplace behaves exactly
 * like it did before this PR (no exclusion, no demo annotation).
 *
 * The list is expected to be small (handful for V1 dogfood). At pilot
 * scale this stays well under the URL-length limit for the subsequent
 * `.not('vendor_profile_id', 'in', '(...)')` predicate.
 */
async function fetchDemoVendorIds(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('is_demo', true);
    if (error) {
      if (/is_demo/i.test(error.message)) return [];
      // Other errors get logged but don't break the marketplace
      // render — opening the door for prod even on partial outage.
      console.warn('[demo-mode] fetchDemoVendorIds failed:', error.message);
      return [];
    }
    return (data ?? []).map((row) => row.vendor_profile_id as string);
  } catch {
    return [];
  }
}

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
  let matchableEvent: { ceremony_type: string; venue_setting: string } | null = null;
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
          'ceremony_type, venue_setting, event_type, venue_latitude, venue_longitude, venue_name, event_date, event_date_precision',
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
    const knownEventType = (ALLOWED_EVENT_TYPE_FILTERS as readonly string[]).includes(coupleEventType)
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

  if (isCatalogMode) {
    return (
      <CatalogView
        admin={admin}
        matchableEvent={matchableEvent}
        matchEvent={filters.matchEvent}
        coupleFaith={coupleFaith}
        venueAnchor={venueAnchor}
        venueAnchorName={venueAnchorName}
        coupleCeremonyType={matchableEvent?.ceremony_type ?? null}
        currentEventId={coupleEventId}
        isAuthenticated={user !== null}
        noticeKey={noticeKey}
        scopedFolder={filters.folder}
        hostVenueSetting={hostVenueSetting}
        venueFilterActive={venueFilterActive}
        venueFacet={filters.venueFacet}
        inDemoMode={inDemoMode}
      />
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
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,hq_latitude,hq_longitude,contact_email,public_visibility,created_at,avg_rating_overall,review_count,ad_rank,ad_tier,ad_sku_code,ad_radius_km,ad_expires_at',
      { count: 'exact' },
    )
    .in('public_visibility', allowedVisibilities as readonly string[])
    .not('business_name', 'is', null)
    .neq('business_name', '');

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
    query = query.ilike('business_name', `%${filters.q}%`);
  }
  if (filters.category) {
    // `services` is a text[] in the DB; the contains operator matches when
    // the array includes the canonical category key. Custom service strings
    // are not indexed by canonical key, so a category filter won't match
    // vendors who only listed a custom service — that's correct V1 behavior.
    //
    // 2026-05-22 cross-listing — when (a) the host arrived via a planning-
    // card [Search] button (filters.folder is set), AND (b) the picked
    // category is a generic catch-all that matches the folder (e.g.
    // ?folder=catering&category=catering), ALSO include vendors whose
    // services[] holds any service cross-listed into this folder via
    // `secondary_folders`. The owner-locked example: hotels (services[]
    // contains 'accommodation', which has `secondary_folders: ['catering']`)
    // surface in catering search alongside dedicated caterers.
    //
    // We only expand when filters.category EXACTLY equals filters.folder
    // because that's the "generic folder catch-all" pattern the dashboard
    // planning cards emit (subcategoryHint='catering' for the Catering
    // card). Specific drill-ins like `?category=halal_catering` don't get
    // the expansion — those couples picked a narrow service for a reason.
    const isGenericFolderCatchall =
      filters.folder !== null && filters.category === filters.folder;
    if (isGenericFolderCatchall) {
      const crossListed = Object.entries(TAXONOMY_MAP)
        .filter(([, meta]) =>
          meta.secondary_folders?.includes(filters.folder as WeddingFolder),
        )
        .map(([key]) => key);
      const services = [filters.category, ...crossListed];
      query = query.overlaps('services', services);
    } else {
      query = query.contains('services', [filters.category]);
    }
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
    query = query.or(
      `compatible_ceremony_types.is.null,compatible_ceremony_types.cs.{${matchableEvent.ceremony_type}}`,
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
    filters.folder === 'reception' &&
    filters.venueDefault === 'on'
  ) {
    query = query.or(
      `compatible_venue_settings.is.null,compatible_venue_settings.cs.{${effectiveVenueSetting}}`,
    );
  }

  // Sort chain (iteration 0006, 2026-05-21): always float Sponsored Boost +
  // Boosted Ads to the top per iteration 0022 § 5b, then apply the user's
  // chosen sort. All columns live on vendor_market_stats so PostgREST orders
  // and paginates in one query — no in-memory pass.
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
    filters.folder === 'reception' &&
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
      broadened = broadened.ilike('business_name', `%${filters.q}%`);
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
      (async (): Promise<Map<string, string>> => {
        if (visibleVendorIds.length === 0) return new Map();
        const { data, error } = await admin
          .from('vendor_profiles')
          .select('vendor_profile_id, verification_state')
          .in('vendor_profile_id', visibleVendorIds);
        if (error) {
          console.error('[vendors] verification_state fetch failed', error);
          return new Map();
        }
        const out = new Map<string, string>();
        for (const row of data ?? []) {
          const r = row as { vendor_profile_id: string; verification_state: string | null };
          if (r.verification_state) out.set(r.vendor_profile_id, r.verification_state);
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
    v.verification_state = verificationByVendorId.get(v.vendor_profile_id) ?? null;
    const svc = servicesByVendorId.get(v.vendor_profile_id);
    v.primary_photo_url = svc?.photoR2Key
      ? r2PublicUrl(R2_BUCKETS.media, svc.photoR2Key)
      : null;
    // Only expose starting_price_php on demo cards in V1; real cards
    // keep the price line hidden per hide-prices lock.
    v.starting_price_php =
      v.is_demo === true && svc?.startingPrice ? svc.startingPrice : null;
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
      {/* Inline marketplace header. Auth-aware CTA swap (2026-05-20): when
          a signed-in user clicks "Marketplace" from the dashboard outer
          header, we route the right-side CTA back to /dashboard instead of
          pushing them at /signup — without this the page reads as
          "logged out" even though the session cookie is still alive. The
          `user` variable above is fetched server-side via the same
          createClient() used for the catalog filter; no extra roundtrip. */}
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
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

      <NoticeBanner noticeKey={noticeKey} />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Marketplace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Browse Filipino wedding vendors.
          </h1>
          <p className="max-w-prose text-base text-ink/65">
            Verified vendors who took the time to set up a Setnayan profile. Star ratings
            come from couples who&rsquo;ve actually paid for the service.
          </p>
        </div>

        {/* Vendor-grid mode is reached only when a narrowing filter is set
          * (category, search, city, verified, match). The mega-column
          * catalog view above is unfiltered. A back-affordance is the
          * primary way to return to the 192-category catalog. */}
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
          <Link
            href="/vendors?match=0"
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

        <FilterBar
          filters={filters}
          matchableEvent={matchableEvent}
          hostVenueSetting={hostVenueSetting}
        />

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
          <EmptyState filters={filters} broadenedCount={broadenedCount} />
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
              return (
                <li key={v.vendor_profile_id}>
                  {/* 2026-05-22 quick-view redesign — VendorCard
                      replaces the legacy VendorMarketCard. Adds the
                      4-badge row + service hero photo + recent-reviews
                      carousel + "Service by Business" header line per
                      the owner directive (CLAUDE.md decision log). */}
                  <VendorCard
                    vendor={v}
                    rating={Number(v.avg_rating_overall ?? 0)}
                    reviewCount={v.review_count ?? 0}
                    isAuthenticated={user !== null}
                    isFollowing={followedSet.has(v.vendor_profile_id)}
                    isSaved={savedSet.has(v.vendor_profile_id)}
                    eventId={coupleEventId}
                    venueAnchor={venueAnchor}
                    ad={ad}
                    badges={badgesByVendorId.get(v.vendor_profile_id) ?? []}
                    reviews={reviewsByVendorId.get(v.vendor_profile_id) ?? []}
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
    venueDefault?: 'on' | 'off';
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
    venueDefault: 'on' | 'off';
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
  // Task #48 — only emit ?venue=0 (explicit opt-out). The 'on' default is
  // implicit, so omitting the param keeps URLs short AND means new clicks
  // inherit the default-on behavior unless the user has explicitly toggled
  // off via the chip.
  if (merged.venueDefault === 'off') params.set('venue', '0');
  const qs = params.toString();
  return qs.length > 0 ? `/vendors?${qs}` : '/vendors';
}

function FilterBar({
  filters,
  matchableEvent,
  hostVenueSetting,
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
  };
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
  /** Task #48 — host's events.venue_setting (snake_case enum). Surfaces
   *  the Venue toggle only when the marketplace is Reception-scoped AND
   *  the host has set a venue_setting. Null on anonymous browse or for
   *  hosts who haven't picked one yet. */
  hostVenueSetting: string | null;
}) {
  // Task #48 — venue toggle is contextual: only meaningful when the URL
  // is Reception-scoped. Outside that scope the toggle would surprise
  // couples ("why is there a 'Garden venues only' switch on a Photography
  // search?"), so hide it. The catalog-mode banner above the FilterBar
  // already explains the filter in its proper context.
  const showVenueToggle =
    filters.folder === 'reception' && hostVenueSetting !== null;
  const venueLongLabel = hostVenueSetting
    ? venueSettingLongLabel(hostVenueSetting)
    : null;
  return (
    <form
      method="get"
      action="/vendors"
      className="mt-4 grid gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-1 lg:col-span-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Search
        </span>
        {/* TaxonomySearch is a client component that shows the 192-item
          * autocomplete on type. Picking a suggestion router-pushes to a
          * `?category=<canonical_service>` URL (bypassing this form).
          * Typing free text + clicking "Apply filters" still submits the
          * form normally, hitting the existing business_name ilike. */}
        <TaxonomySearch
          initialQuery={filters.q}
          options={TAXONOMY_OPTIONS}
          preserve={{
            city: filters.city,
            sort: filters.sort,
            verifiedOnly: filters.verifiedOnly,
            matchEvent: filters.matchEvent,
            eventType: filters.eventType,
          }}
        />
      </label>

      {/* Category is now controlled by the chip bar above. Carry the
          current selection through this form so submitting q/city/sort
          doesn't accidentally clear the active category chip. */}
      <input type="hidden" name="category" value={filters.category ?? ''} />

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          City
        </span>
        <input
          type="text"
          name="city"
          defaultValue={filters.city}
          placeholder="Manila, Cebu…"
          className="input-field"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Sort by
        </span>
        <select name="sort" defaultValue={filters.sort} className="input-field">
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-ink/75 lg:col-span-4">
        <input
          type="checkbox"
          name="verified"
          value="1"
          defaultChecked={filters.verifiedOnly}
          className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
        />
        <span>
          <span className="font-medium">Verified only</span>
          <span className="ml-2 text-ink/55">
            (hide vendors who haven&rsquo;t completed verification)
          </span>
        </span>
      </label>

      {matchableEvent ? (
        <label className="flex items-center gap-2 text-sm text-ink/75 lg:col-span-4">
          <input
            type="checkbox"
            name="match"
            value="1"
            defaultChecked={filters.matchEvent}
            className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
          />
          <span>
            <span className="font-medium">Match my wedding</span>
            <span className="ml-2 text-ink/55">
              (only show vendors compatible with{' '}
              <span className="font-mono">{matchableEvent.ceremony_type}</span>{' '}
              ceremonies)
            </span>
          </span>
        </label>
      ) : null}

      {/* Task #48 — venue_setting toggle, Reception-scoped. The default-on
          behavior means parseFilters reads "absent param" as 'on'. We can't
          rely on the standard checked/unchecked checkbox pattern here
          because an unchecked HTML checkbox doesn't submit any value
          (parseFilters would see no param → default-on → toggle never
          worked). Instead we use an inverted "Show all settings" checkbox
          that's UNCHECKED when the filter is firing (default state); when
          the host checks it to broaden the search, the form submits
          ?venue=0 explicitly. Re-unchecking drops the param so the host
          returns to default-on. */}
      {showVenueToggle ? (
        <label className="flex items-center gap-2 text-sm text-ink/75 lg:col-span-4">
          <input
            type="checkbox"
            name="venue"
            value="0"
            defaultChecked={filters.venueDefault === 'off'}
            className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
          />
          <span>
            <span className="font-medium">Show all venue settings</span>
            <span className="ml-2 text-ink/55">
              (uncheck to focus on{' '}
              <span className="font-medium text-ink/75">{venueLongLabel}</span>{' '}
              — your wedding&rsquo;s picked setting)
            </span>
          </span>
        </label>
      ) : null}

      {/* Preserve folder scope (Task #47) on form submit so toggling other
          filters doesn't drop the host back into the unscoped catalog. */}
      {filters.folder ? (
        <input type="hidden" name="folder" value={filters.folder} />
      ) : null}

      <div className="flex items-end gap-2 lg:col-span-4">
        <button type="submit" className="button-primary h-11 px-5">
          Apply filters
        </button>
        {filters.q ||
        filters.category ||
        filters.city ||
        filters.sort !== 'most_reviews' ||
        filters.verifiedOnly ? (
          <Link href="/vendors" className="button-secondary h-11 px-5">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function EmptyState({
  filters,
  broadenedCount,
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
  };
  broadenedCount: number | null;
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
    const label = EVENT_TYPE_LABEL[filters.eventType];
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
          href="/vendors"
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
          <Link href="/vendors" className="button-secondary inline-flex h-10 px-4">
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

// Reception facet definitions moved into apps/web/app/vendors/_components/
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
  currentEventId,
  isAuthenticated,
  noticeKey,
  scopedFolder,
  hostVenueSetting,
  venueFilterActive,
  venueFacet,
  inDemoMode,
}: {
  admin: ReturnType<typeof createAdminClient>;
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
  matchEvent: boolean;
  coupleFaith: CoupleFaith;
  venueAnchor: { lat: number; lng: number } | null;
  venueAnchorName: string | null;
  coupleCeremonyType: string | null;
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
}) {
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

  // Religion-default-on: when the couple has a faith (ceremony_type maps to
  // Catholic/Christian/INC/Muslim/Cultural), hide tiles tagged for OTHER
  // faiths. Untagged tiles always surface — they're the cross-faith base.
  // Civil couples (coupleFaith=null) keep all faith-tagged tiles hidden when
  // matchEvent is on. Anonymous visitors see everything.
  const religionFilteringActive = matchEvent && matchableEvent !== null;
  const passesReligionFilter = (
    meta: { faith?: 'Catholic' | 'Christian' | 'INC' | 'Muslim' | 'Cultural' },
  ): boolean => {
    if (!religionFilteringActive) return true;
    if (!meta.faith) return true;
    return meta.faith === coupleFaith;
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
  for (const row of schemas) {
    const meta = TAXONOMY_MAP[row.canonical_service];
    if (!meta) continue;
    if (!passesReligionFilter(meta)) continue;
    const count = vendorCounts.get(row.canonical_service) ?? null;
    if ((count?.total ?? 0) > 0) {
      populatedServices.push(row.canonical_service);
    }
    // Primary folder placement (unchanged).
    buckets.get(meta.folder)?.push({
      canonicalService: row.canonical_service,
      displayNameEn: row.display_name_en,
      displayNameTl: row.display_name_tl,
      meta,
      count,
    });
    // Secondary folder cross-listings (new 2026-05-22). Same tile data,
    // flagged with `primaryFolderHint` so the CategoryTile renders a
    // muted "Primary folder · Planning" line under the count pill — gives
    // couples the context "this vendor's home is the Planning folder but
    // they also do catering." Empty for the 191 services without
    // `secondary_folders` declared, so 0 behavior change for them.
    if (meta.secondary_folders) {
      for (const secondary of meta.secondary_folders) {
        if (secondary === meta.folder) continue;
        buckets.get(secondary)?.push({
          canonicalService: row.canonical_service,
          displayNameEn: row.display_name_en,
          displayNameTl: row.display_name_tl,
          meta,
          count,
          primaryFolderHint: meta.folder,
        });
      }
    }
  }

  // 2026-05-22 evening — fetch top-3 vendor names per populated
  // canonical_service in a single round-trip. The CategoryTile reads from
  // this map to render the "Sample: Manila Marriott · Solaire · Conrad"
  // preview line under the count pill. Empty map (zero rows OR query
  // error) → tiles fall back to their existing copy without the preview
  // line, so the catalog stays clean regardless.
  const topVendorNamesByService = populatedServices.length > 0
    ? await fetchTopVendorNamesByService(admin, {
        services: populatedServices,
        perServiceLimit: 3,
        excludeVendorIds: catalogExcludeVendorIds,
      })
    : new Map<string, string[]>();

  // Stamp each tile's data with the resolved sample names so CategoryTile
  // doesn't need a side-channel prop. populatedServices guarantee covers
  // the keys we look up here.
  for (const tiles of buckets.values()) {
    for (const tile of tiles) {
      const names = topVendorNamesByService.get(tile.canonicalService);
      if (names && names.length > 0) {
        tile.sampleVendorNames = names;
      }
    }
  }

  // Sort each folder: populated first (highest total), then live-phase
  // recruiting, then future-phase. Inside each tier, alphabetical.
  for (const tiles of buckets.values()) {
    tiles.sort((a, b) => {
      const aTotal = a.count?.total ?? 0;
      const bTotal = b.count?.total ?? 0;
      if (aTotal !== bTotal) return bTotal - aTotal;
      const aRank = CATALOG_PHASE_RANK[a.meta.phase] ?? 99;
      const bRank = CATALOG_PHASE_RANK[b.meta.phase] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return a.displayNameEn.localeCompare(b.displayNameEn);
    });
  }

  // Count visible categories AFTER the religion filter. Tabs and the
  // "X categories" copy reflect what the couple actually sees, not the
  // unfiltered 192.
  const totalCategories = schemas.filter((r) => {
    const meta = TAXONOMY_MAP[r.canonical_service];
    return meta !== undefined && passesReligionFilter(meta);
  }).length;
  const totalLive = schemas.filter((r) => {
    const meta = TAXONOMY_MAP[r.canonical_service];
    if (!meta || !passesReligionFilter(meta)) return false;
    return (vendorCounts.get(r.canonical_service)?.total ?? 0) > 0;
  }).length;

  // Tab strip — 12 chips. Reception (zero canonical_services) gets the count
  // of its venue facets instead of zero so the chip badge reads accurately.
  // 6 reception-side venue settings: banquet_hall · garden · beach ·
  // destination · heritage · outdoor_tent. (civil_registrar is ceremony-only.)
  const RECEPTION_FACET_COUNT = 6;
  const tabs: FolderTab[] = WEDDING_FOLDER_ORDER.map((folder) => ({
    folder,
    label: WEDDING_FOLDER_SHORT_LABEL[folder],
    slug: WEDDING_FOLDER_SLUG[folder],
    count:
      folder === 'reception'
        ? RECEPTION_FACET_COUNT
        : buckets.get(folder)?.length ?? 0,
  }));

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
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
        className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      >
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Marketplace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Browse Filipino wedding vendors.
          </h1>
          <p className="max-w-prose text-base text-ink/65">
            Every service Setnayan covers — {totalCategories} categories
            organized around the Filipino wedding journey.{' '}
            {totalLive > 0 ? (
              <>
                <span className="font-medium text-ink">{totalLive}</span> have
                verified vendors today; the rest are recruiting now or rolling
                out by phase. Tap any tile to drill in.
              </>
            ) : (
              <>
                Setnayan is in soft launch — vendor pools are filling in by
                category each week. Tap a tile to see who&rsquo;s onboarded
                already or get notified when a category opens.
              </>
            )}
          </p>
        </div>

        {religionFilteringActive ? (
          <ReligionBanner
            coupleFaith={coupleFaith}
            ceremonyType={matchableEvent!.ceremony_type}
          />
        ) : null}

        <CatalogFilterBar matchableEvent={matchableEvent} />

        <FolderTabs
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
        {venueAnchor && (scopedFolder === null || scopedFolder === 'ceremony') ? (
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
          // Task #47 — when the catalog is scoped to a single folder, skip
          // every other folder section so couples landing on Reception
          // don't also see the entire Ceremony folder + its venue cards.
          if (scopedFolder !== null && folder !== scopedFolder) return null;
          if (folder === 'reception') {
            // 2026-05-22 evening upgrade — ReceptionVenuesSection now owns
            // BOTH the chip filter bar AND the venue card grid. The old
            // inline ReceptionSection wrapper that rendered the 7-chip
            // stub above ReceptionVenuesSection was retired with this PR.
            return (
              <section
                key={folder}
                id={WEDDING_FOLDER_SLUG.reception}
                className="scroll-mt-20 pt-8 sm:pt-10"
                aria-labelledby="reception-heading"
              >
                <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                  <h2
                    id="reception-heading"
                    className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
                  >
                    {WEDDING_FOLDER_LABEL.reception}
                  </h2>
                  <span className="font-mono text-xs text-ink/55">
                    6 venue settings
                  </span>
                </header>
                <ReceptionVenuesSection
                  hostVenueSetting={hostVenueSetting}
                  venueFilterActive={venueFilterActive}
                  activeFacet={venueFacet}
                  venueAnchor={venueAnchor}
                  currentEventId={currentEventId}
                  isDemoMode={inDemoMode}
                />
              </section>
            );
          }
          const tiles = buckets.get(folder) ?? [];
          const isCeremony = folder === 'ceremony';
          // Ceremony ALWAYS renders (placeholder venues + anchor for dashboard
          // Search deep-links per planning-groups.tsx searchHref). Other folders
          // return null when empty — no placeholder content to show, anchor
          // unused.
          if (tiles.length === 0 && !isCeremony) return null;
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
                {tiles.length > 0 ? (
                  <span className="font-mono text-xs text-ink/55">
                    {tiles.length} categories
                  </span>
                ) : null}
              </header>
              {isCeremony ? (
                <>
                  <CeremonyVenuePanel />
                  <CeremonyVenuesSection
                    coupleCeremonyType={coupleCeremonyType}
                    venueAnchor={venueAnchor}
                    currentEventId={currentEventId}
                  />
                </>
              ) : null}
              {/* 2026-05-22 evening — inline real-vendor cards from
                    vendor_profiles. Mirrors the structural role
                    CeremonyVenuesSection plays for venue_directory in
                    Ceremony, and what ReceptionVenuesSection plays in
                    Reception. Renders above the category tile grid so
                    couples see actual named businesses for the folder
                    immediately, instead of only "X listed" count pills.
                    Empty folders (zero signed-up vendors) skip the
                    section entirely. */}
              <FolderVendorsSection
                folder={folder}
                excludeVendorIds={catalogExcludeVendorIds}
                venueAnchor={venueAnchor}
                currentEventId={currentEventId}
              />
              {tiles.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tiles.map((tile) => (
                    <li key={tile.canonicalService}>
                      <CategoryTile data={tile} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
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
function ScopedFolderBanner({ folder }: { folder: WeddingFolder }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-cream px-4 py-3">
      <p className="text-sm text-ink/80">
        Showing{' '}
        <span className="font-medium text-ink">
          {WEDDING_FOLDER_LABEL[folder]}
        </span>{' '}
        only — the other 11 folders are hidden so you can focus.
      </p>
      <Link
        href="/vendors"
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
        href="/vendors?match=0"
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
            href={`#${WEDDING_FOLDER_SLUG.reception}`}
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

// Slim filter form for catalog mode — only the inputs that make sense pre-
// drill-in. Picking a search suggestion or submitting the form router-pushes
// into vendor-grid mode for the matching category.
function CatalogFilterBar({
  matchableEvent,
}: {
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
}) {
  return (
    <form
      method="get"
      action="/vendors"
      className="mt-6 grid gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <label className="flex flex-col gap-1 lg:col-span-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Search any of 192 categories
        </span>
        <TaxonomySearch
          initialQuery=""
          options={TAXONOMY_OPTIONS}
          preserve={{
            city: '',
            sort: 'most_reviews',
            verifiedOnly: false,
            matchEvent: false,
            eventType: null,
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          City (optional)
        </span>
        <input
          type="text"
          name="city"
          placeholder="Manila, Cebu…"
          className="input-field"
        />
      </label>

      {matchableEvent ? (
        <label className="flex items-center gap-2 text-sm text-ink/75 lg:col-span-3">
          <input
            type="checkbox"
            name="match"
            value="1"
            className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
          />
          <span>
            <span className="font-medium">Match my wedding</span>
            <span className="ml-2 text-ink/55">
              (compatible with{' '}
              <span className="font-mono">{matchableEvent.ceremony_type}</span>{' '}
              ceremonies)
            </span>
          </span>
        </label>
      ) : null}

      <div className="lg:col-span-3">
        <button type="submit" className="button-primary px-5">
          Apply filters
        </button>
      </div>
    </form>
  );
}
