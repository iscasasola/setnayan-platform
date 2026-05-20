import Link from 'next/link';
import { Star, MapPin, ChevronLeft, ChevronRight, Navigation } from 'lucide-react';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { displayServiceLabel } from '@/lib/vendors';
import {
  PUBLIC_SURFACE_VISIBILITIES,
  isBookable,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { fetchActiveAdLookups, type ActiveAdLookup } from '@/lib/vendor-ads';
import { fetchReviewStatsForMany, formatStarRating } from '@/lib/reviews';
import { EventTypeNotifyForm } from './_components/event-type-notify-form';
import { TaxonomySearch, type TaxonomyOption } from './_components/taxonomy-search';
import { CategoryTile, type CategoryTileData } from './_components/category-tile';
import { SaveVendorButton } from './_components/save-vendor-button';
import { FolderTabs, type FolderTab } from './_components/mega-column-tabs';
import { PairedVenuePanel } from './_components/paired-venue-panel';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
  type TaxonomyPhase,
} from '@/lib/taxonomy';
import { fetchVendorCountsByService } from '@/lib/vendor-counts';
import { fetchUserEvents } from '@/lib/events';
import { FollowGate } from '@/app/_components/follow-gate';

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
  }>;
};

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
  return { q, category, city, sort, page, verifiedOnly, matchEvent, eventType };
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
  let coupleEventId: string | null = null;
  let matchableEvent: { ceremony_type: string; venue_setting: string } | null = null;
  let coupleEventType: string | null = null;
  // 2026-05-21 — reception venue anchor (lat/lng) for the distance chip on
  // every vendor card. Populated by saveVendorToPicks when the couple saves
  // a category='venue' vendor with coords. NULL = no anchor → no chips.
  let venueAnchor: { lat: number; lng: number } | null = null;
  let venueAnchorName: string | null = null;
  if (user) {
    const userEvents = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = userEvents[0]?.event_id ?? null;
    if (coupleEventId) {
      const { data: ev } = await admin
        .from('events')
        .select(
          'ceremony_type, venue_setting, event_type, venue_latitude, venue_longitude, venue_name',
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

  // Religion-default-on (2026-05-20): when a couple has set their ceremony_type
  // and venue_setting, default the marketplace filter to ON so faith-
  // incompatible vendors + catalog tiles auto-hide. Couples toggle off via
  // ?match=0 (the "Show all faiths" pill). Anonymous visitors and couples
  // without a ceremony_type get the unfiltered universe by default.
  const coupleFaith: CoupleFaith = matchableEvent
    ? mapCeremonyTypeToFaith(matchableEvent.ceremony_type)
    : null;
  if (
    matchableEvent &&
    raw.match !== '0' &&
    raw.match !== 'off' &&
    !filters.matchEvent
  ) {
    filters = { ...filters, matchEvent: true };
  }

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
  // Public marketplace requires a non-empty business_name. Coming-soon
  // vendors are intentionally surfaced (Decision 6 / 2026-05-15) — but
  // a row that hasn't even filled in its name renders as "Unnamed
  // vendor" which makes the whole marketplace look broken. Gate the
  // public surface on the minimum self-identification work; admins
  // can still see the row in /admin/vendors.
  let query = admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,hq_latitude,hq_longitude,contact_email,public_visibility,created_at',
      { count: 'exact' },
    )
    .in('public_visibility', allowedVisibilities as readonly string[])
    .not('business_name', 'is', null)
    .neq('business_name', '');

  if (filters.q.length > 0) {
    query = query.ilike('business_name', `%${filters.q}%`);
  }
  if (filters.category) {
    // `services` is a text[] in the DB; the contains operator matches when
    // the array includes the canonical category key. Custom service strings
    // are not indexed by canonical key, so a category filter won't match
    // vendors who only listed a custom service — that's correct V1 behavior.
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
  if (filters.matchEvent && matchableEvent) {
    query = query
      .or(
        `compatible_ceremony_types.is.null,compatible_ceremony_types.cs.{${matchableEvent.ceremony_type}}`,
      )
      .or(
        `compatible_venue_settings.is.null,compatible_venue_settings.cs.{${matchableEvent.venue_setting}}`,
      );
  }

  // Sort: newest + name_asc are direct column sorts on the vendor_profiles
  // table. most_reviews + highest_rated need the stats view, so for those we
  // fall back to a two-stage fetch where we get a candidate page sorted by
  // newest first, then re-sort in-memory by their stats. This trades a tiny
  // sort cost for the simplicity of not having to PostgREST-join the view.
  if (filters.sort === 'name_asc') {
    query = query.order('business_name', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const range = filters.sort === 'most_reviews' || filters.sort === 'highest_rated'
    ? { from: 0, to: 2000 } // hydrate up to 2000 published rows for in-memory sort
    : {
        from: (filters.page - 1) * PAGE_SIZE,
        to: filters.page * PAGE_SIZE - 1,
      };

  const { data: rowsRaw, count: totalCount } = await query.range(range.from, range.to);
  const rows = (rowsRaw ?? []) as VendorCardRow[];

  const statsById = await fetchReviewStatsForMany(
    admin,
    rows.map((r) => r.vendor_profile_id),
  );

  // Iteration 0022 § 5b — pull each visible vendor's active Boosted Ads /
  // Sponsored Boost row so the card can render the right badge and so the
  // in-memory sort can prioritize boosted vendors. Sponsored > Boosted >
  // unboosted; within a tier larger radius wins, then expiry. Reads from
  // the `vendor_active_ads` view which collapses overlapping rows to the
  // single most-permissive active subscription per vendor.
  const adById = await fetchActiveAdLookups(
    admin,
    rows.map((r) => r.vendor_profile_id),
  );

  // Iteration 0019 § Gate — resolve the viewer's follow set so each card
  // renders a stateful FollowGate without N+1 queries. The viewer's auth +
  // primary event are already resolved above for the 0043 compatibility
  // filter; we reuse the same `user` + `supabase` here. Anonymous visitors
  // get every card as "not following".
  let followedSet = new Set<string>();
  if (user) {
    const ids = rows.map((r) => r.vendor_profile_id);
    if (ids.length > 0) {
      const { data: follows } = await supabase
        .from('vendor_follows')
        .select('vendor_profile_id')
        .eq('follower_user_id', user.id)
        .in('vendor_profile_id', ids);
      followedSet = new Set((follows ?? []).map((f) => f.vendor_profile_id));
    }
  }

  // 2026-05-20 — saved-to-picks set for the SaveVendorButton on each card.
  // RLS on event_vendors is couple-scoped so the SELECT is naturally bounded
  // to the viewer's own events. Joining via marketplace_vendor_id IN (visible
  // ids) keeps the read tight.
  let savedSet = new Set<string>();
  if (user && coupleEventId) {
    const ids = rows.map((r) => r.vendor_profile_id);
    if (ids.length > 0) {
      const { data: saved } = await supabase
        .from('event_vendors')
        .select('marketplace_vendor_id')
        .eq('event_id', coupleEventId)
        .in('marketplace_vendor_id', ids);
      savedSet = new Set(
        (saved ?? [])
          .map((s) => s.marketplace_vendor_id)
          .filter((id): id is string => Boolean(id)),
      );
    }
  }

  // Apply stats-based sort + pagination in-memory. Boosted/Sponsored
  // vendors always float to the top of the page (within each sort key) per
  // iteration 0022 § 5b — "Top-of-search ranking within radius · tiny
  // 'Sponsored' pill differentiator". Sponsored beats Boosted; both beat
  // unboosted.
  const adWeight = (vid: string): number => {
    const ad = adById.get(vid);
    if (!ad) return 0;
    if (ad.tier === 'sponsored') return 2;
    return 1;
  };
  let sorted = rows;
  if (filters.sort === 'most_reviews' || filters.sort === 'highest_rated') {
    sorted = [...rows].sort((a, b) => {
      const adA = adWeight(a.vendor_profile_id);
      const adB = adWeight(b.vendor_profile_id);
      if (adA !== adB) return adB - adA;
      const sa = statsById.get(a.vendor_profile_id);
      const sb = statsById.get(b.vendor_profile_id);
      const aCount = sa?.total_count ?? 0;
      const bCount = sb?.total_count ?? 0;
      const aRating = sa?.avg_rating_overall ?? 0;
      const bRating = sb?.avg_rating_overall ?? 0;
      if (filters.sort === 'highest_rated') {
        if (bRating !== aRating) return bRating - aRating;
        return bCount - aCount; // tiebreak by review count
      }
      // most_reviews
      if (bCount !== aCount) return bCount - aCount;
      return bRating - aRating;
    });
  } else {
    // For "newest" / "name_asc" — still float ads to the top of the page
    // (V1 behavior: the boost is the value prop, the underlying sort is
    // preserved as a secondary key).
    sorted = [...rows].sort((a, b) => {
      const adA = adWeight(a.vendor_profile_id);
      const adB = adWeight(b.vendor_profile_id);
      if (adA !== adB) return adB - adA;
      return 0; // preserve postgres-side order
    });
  }

  const slicedTotal = filters.sort === 'most_reviews' || filters.sort === 'highest_rated'
    ? sorted.length
    : (totalCount ?? sorted.length);
  const totalPages = Math.max(1, Math.ceil(slicedTotal / PAGE_SIZE));
  const visible = filters.sort === 'most_reviews' || filters.sort === 'highest_rated'
    ? sorted.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)
    : sorted;

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
              className="button-primary hidden h-10 px-5 text-sm sm:inline-flex"
            >
              Dashboard
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

        <FilterBar filters={filters} matchableEvent={matchableEvent} />

        {visible.length === 0 ? (
          <EmptyState filters={filters} />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((v) => {
              const s = statsById.get(v.vendor_profile_id);
              return (
                <li key={v.vendor_profile_id}>
                  <VendorMarketCard
                    vendor={v}
                    rating={s?.avg_rating_overall ?? 0}
                    reviewCount={s?.total_count ?? 0}
                    isAuthenticated={user !== null}
                    isFollowing={followedSet.has(v.vendor_profile_id)}
                    isSaved={savedSet.has(v.vendor_profile_id)}
                    eventId={coupleEventId}
                    venueAnchor={venueAnchor}
                    ad={adById.get(v.vendor_profile_id) ?? null}
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
          total={slicedTotal}
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
  },
  patch: Partial<{
    q: string;
    category: string | null | '';
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
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
  const qs = params.toString();
  return qs.length > 0 ? `/vendors?${qs}` : '/vendors';
}

function FilterBar({
  filters,
  matchableEvent,
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
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
}) {
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
              <span className="font-mono">{matchableEvent.ceremony_type}</span> ·{' '}
              <span className="font-mono">{matchableEvent.venue_setting.replace(/_/g, ' ')}</span>)
            </span>
          </span>
        </label>
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
}) {
  const hasFilter = !!(
    filters.q ||
    filters.category ||
    filters.city ||
    filters.verifiedOnly ||
    filters.matchEvent ||
    filters.eventType
  );

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
          ? 'No vendors match these filters.'
          : 'No vendors have published their Setnayan profile yet.'}
      </p>
      <p className="mt-1 text-sm text-ink/55">
        {hasFilter
          ? 'Try widening your search or clearing one filter at a time.'
          : 'Check back soon — vendors are landing every week.'}
      </p>
      {hasFilter ? (
        <Link href="/vendors" className="button-secondary mt-4 inline-flex h-10 px-4">
          Clear all filters
        </Link>
      ) : null}
    </div>
  );
}

function VendorMarketCard({
  vendor,
  rating,
  reviewCount,
  isAuthenticated,
  isFollowing,
  isSaved,
  eventId,
  venueAnchor,
  ad,
}: {
  vendor: VendorCardRow;
  rating: number;
  reviewCount: number;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isSaved: boolean;
  eventId: string | null;
  venueAnchor: { lat: number; lng: number } | null;
  ad: ActiveAdLookup | null;
}) {
  const primaryService = vendor.services[0] ?? null;
  const slug = vendor.business_slug ?? null;
  const href = slug ? `/v/${slug}` : `#`;
  const visibility = parseVisibility(vendor.public_visibility);
  const bookable = isBookable(visibility);
  // Coming-soon cards render with a muted appearance + badge, no booking
  // CTA (FollowGate hidden), read-only preview. Per 0006 § DIY-mode filter
  // popup + 0022 § 2.1c.
  const isComingSoon = visibility === 'coming_soon';
  // Iteration 0022 § 5b — gold "Featured Sponsor" pill for the 30km long-
  // commit tier; terracotta "Boosted" pill for the weekly 5/10/20km tier.
  const sponsoredAccent = ad?.tier === 'sponsored';
  const boostedAccent = ad?.tier === 'boosted';

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-2xl border bg-cream p-4 transition-shadow hover:shadow-md ${
        isComingSoon
          ? 'border-dashed border-ink/20 opacity-90'
          : sponsoredAccent
            ? 'border-amber-300 ring-1 ring-amber-200'
            : boostedAccent
              ? 'border-terracotta/30'
              : 'border-ink/10'
      }`}
    >
      <header className="flex items-center gap-3">
        <Logo logoUrl={vendor.logo_url} name={vendor.business_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-ink">
              {/* Empty business_name is filtered out at the query level,
                * so this fallback is purely defensive — keep it neutral
                * instead of "Unnamed vendor", which read as dev text. */}
              {vendor.business_name || 'Vendor'}
            </h2>
            {isComingSoon ? (
              <span className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                Coming soon
              </span>
            ) : null}
            {sponsoredAccent ? (
              <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-950">
                Featured Sponsor
              </span>
            ) : boostedAccent ? (
              <span className="shrink-0 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream">
                Boosted
              </span>
            ) : null}
          </div>
          {primaryService ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              {displayServiceLabel(primaryService)}
            </p>
          ) : null}
        </div>
      </header>

      {vendor.tagline ? (
        <p className="line-clamp-2 text-sm text-ink/65">{vendor.tagline}</p>
      ) : null}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/55">
        {vendor.location_city ? (
          <li className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
            {vendor.location_city}
          </li>
        ) : null}
        {(() => {
          // 2026-05-21 — distance from the couple's reception venue. Renders
          // only when BOTH ends have coords; otherwise the city pill alone
          // stays the geo-signal. Computation is haversine in-process, no
          // DB or external call per card.
          if (
            !venueAnchor ||
            vendor.hq_latitude === null ||
            vendor.hq_longitude === null
          ) {
            return null;
          }
          const km = haversineKm(
            venueAnchor.lat,
            venueAnchor.lng,
            Number(vendor.hq_latitude),
            Number(vendor.hq_longitude),
          );
          return (
            <li className="inline-flex items-center gap-1 text-terracotta">
              <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
              {formatDistanceKm(km)} from venue
            </li>
          );
        })()}
        <li className="inline-flex items-center gap-1">
          <Star
            className={`h-3.5 w-3.5 ${
              rating > 0 ? 'fill-amber-400 text-amber-500' : 'text-ink/25'
            }`}
            strokeWidth={1.75}
          />
          <span className="font-mono">
            {rating > 0 ? formatStarRating(rating) : 'new'}
          </span>
          <span className="text-ink/45">
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        </li>
      </ul>

      <div className="mt-auto space-y-2 pt-2">
        {bookable ? (
          <FollowGate
            vendorProfileId={vendor.vendor_profile_id}
            vendorName={vendor.business_name}
            vendorEmail={vendor.contact_email}
            isAuthenticated={isAuthenticated}
            initialFollowing={isFollowing}
            eventId={eventId}
            revalidatePath="/vendors"
            variant="card"
          />
        ) : (
          <p className="text-xs text-ink/55">
            Setnayan is verifying their setup.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* Save-to-picks (2026-05-20). Only surfaced for authenticated
              couples with at least one event; the button itself is the
              client component that does the heavy lifting. */}
          {bookable && isAuthenticated && eventId ? (
            <SaveVendorButton
              vendorProfileId={vendor.vendor_profile_id}
              initiallySaved={isSaved}
              canSave={true}
            />
          ) : null}
          {slug ? (
            <Link
              href={href}
              className="text-xs font-medium text-terracotta hover:underline"
            >
              View profile →
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Logo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || '?';
  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-terracotta/15 text-base font-semibold text-terracotta-700">
      {initials}
    </span>
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

// Reception folder facets — surfaced as chips that drill into the marketplace
// filtered by venue_setting via the existing `?city=` proxy until V1.2 ships
// dedicated venue routing. Combined-venue badge marks settings that also host
// the ceremony (garden, beach, destination, heritage, outdoor_tent).
const RECEPTION_VENUE_FACETS: ReadonlyArray<{
  key: string;
  label: string;
  combined: boolean;
}> = [
  { key: 'banquet_hall',    label: 'Hotel Ballroom / Banquet Hall', combined: false },
  { key: 'garden',          label: 'Garden Estate',                 combined: true },
  { key: 'beach',           label: 'Beach',                         combined: true },
  { key: 'destination',     label: 'Destination Resort',            combined: true },
  { key: 'heritage',        label: 'Heritage / Hacienda',           combined: true },
  { key: 'outdoor_tent',    label: 'Outdoor Tent',                  combined: true },
  { key: 'civil_registrar', label: "Civil Registrar's Office",      combined: false },
];

async function CatalogView({
  admin,
  matchableEvent,
  matchEvent,
  coupleFaith,
  venueAnchor,
  venueAnchorName,
  coupleCeremonyType,
}: {
  admin: ReturnType<typeof createAdminClient>;
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
  matchEvent: boolean;
  coupleFaith: CoupleFaith;
  venueAnchor: { lat: number; lng: number } | null;
  venueAnchorName: string | null;
  coupleCeremonyType: string | null;
}) {
  // Single round-trip per page render — both reads are admin-scoped because
  // anonymous visitors hit this route and `vendor_profiles` is gated by RLS.
  const [{ data: schemaRows }, vendorCounts] = await Promise.all([
    admin
      .from('canonical_service_schemas')
      .select('canonical_service, display_name_en, display_name_tl')
      .order('display_name_en', { ascending: true }),
    fetchVendorCountsByService(admin),
  ]);

  const schemas = (schemaRows ?? []) as CatalogSchemaRow[];

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
  const buckets = new Map<WeddingFolder, CategoryTileData[]>();
  for (const folder of WEDDING_FOLDER_ORDER) {
    buckets.set(folder, []);
  }
  for (const row of schemas) {
    const meta = TAXONOMY_MAP[row.canonical_service];
    if (!meta) continue;
    if (!passesReligionFilter(meta)) continue;
    buckets.get(meta.folder)?.push({
      canonicalService: row.canonical_service,
      displayNameEn: row.display_name_en,
      displayNameTl: row.display_name_tl,
      meta,
      count: vendorCounts.get(row.canonical_service) ?? null,
    });
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
  const tabs: FolderTab[] = WEDDING_FOLDER_ORDER.map((folder) => ({
    folder,
    label: WEDDING_FOLDER_SHORT_LABEL[folder],
    slug: WEDDING_FOLDER_SLUG[folder],
    count:
      folder === 'reception'
        ? RECEPTION_VENUE_FACETS.length
        : buckets.get(folder)?.length ?? 0,
  }));

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
          </Link>
          <Link
            href="/signup"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Plan with Setnayan
          </Link>
        </div>
      </header>

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

        <FolderTabs tabs={tabs} totalCount={totalCategories} />

        {venueAnchor ? (
          <PairedVenuePanel
            anchor={{
              lat: venueAnchor.lat,
              lng: venueAnchor.lng,
              name: venueAnchorName,
            }}
            coupleCeremonyType={coupleCeremonyType}
          />
        ) : null}

        {WEDDING_FOLDER_ORDER.map((folder) => {
          if (folder === 'reception') {
            return (
              <ReceptionSection key={folder} matchableEvent={matchableEvent} />
            );
          }
          const tiles = buckets.get(folder) ?? [];
          if (tiles.length === 0) return null;
          const slug = WEDDING_FOLDER_SLUG[folder];
          const isCeremony = folder === 'ceremony';
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
                  {tiles.length} categories
                </span>
              </header>
              {isCeremony ? <CeremonyVenuePanel /> : null}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tiles.map((tile) => (
                  <li key={tile.canonicalService}>
                    <CategoryTile data={tile} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </main>
  );
}

// Reception folder is filter-only — surfaces venue_setting facets without
// backing canonical_services. Drills into the marketplace via `?city=` until
// V1.2 ships a dedicated `/venues` route. The combined-venue badge marks
// settings that can also host the ceremony (garden, beach, destination,
// heritage, outdoor_tent).
function ReceptionSection({
  matchableEvent,
}: {
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;
}) {
  return (
    <section
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
          {RECEPTION_VENUE_FACETS.length} venue settings
        </span>
      </header>
      <p className="mb-4 max-w-prose text-sm text-ink/65">
        Where you celebrate after the ceremony. Settings marked{' '}
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-800">
          ⇄ also hosts ceremony
        </span>{' '}
        can do both back-to-back at the same location. Dedicated venue listings
        with day-rates ship in V1.2.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {RECEPTION_VENUE_FACETS.map((facet) => (
          <li key={facet.key}>
            <Link
              href={
                matchableEvent
                  ? `/vendors?match=1&category=&city=`
                  : '/vendors'
              }
              className="group flex h-full flex-col gap-2 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-ink group-hover:text-terracotta">
                  {facet.label}
                </h3>
                <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  V1.2
                </span>
              </div>
              {facet.combined ? (
                <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-800">
                  ⇄ also hosts ceremony
                </span>
              ) : null}
              <p className="mt-auto text-xs font-medium text-terracotta group-hover:underline">
                Notify me when venues open →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
              <span className="font-mono">{matchableEvent.ceremony_type}</span> ·{' '}
              <span className="font-mono">
                {matchableEvent.venue_setting.replace(/_/g, ' ')}
              </span>
              )
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
