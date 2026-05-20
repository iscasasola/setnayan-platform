import Link from 'next/link';
import { Star, Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  VENDOR_CATEGORIES,
  type VendorCategory,
  displayServiceLabel,
} from '@/lib/vendors';
import {
  PUBLIC_SURFACE_VISIBILITIES,
  isBookable,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { fetchActiveAdLookups, type ActiveAdLookup } from '@/lib/vendor-ads';
import { fetchReviewStatsForMany, formatStarRating } from '@/lib/reviews';
import { CategoryFilterChips } from '@/app/_components/category-filter-chips';
import { EventTypeNotifyForm } from './_components/event-type-notify-form';
import { fetchUserEvents } from '@/lib/events';
import { FollowGate } from '@/app/_components/follow-gate';

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
  contact_email: string | null;
  public_visibility: VendorPublicVisibility;
  created_at: string;
};

function parseFilters(
  raw: Awaited<Props['searchParams']>,
): {
  q: string;
  category: VendorCategory | null;
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
  const category = (VENDOR_CATEGORIES as readonly string[]).includes(raw.category ?? '')
    ? (raw.category as VendorCategory)
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
  if (user) {
    const userEvents = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = userEvents[0]?.event_id ?? null;
    if (coupleEventId) {
      const { data: ev } = await admin
        .from('events')
        .select('ceremony_type, venue_setting, event_type')
        .eq('event_id', coupleEventId)
        .maybeSingle();
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
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,public_visibility,created_at',
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
          <p className="text-sm text-ink/55">
            Looking for something specific?{' '}
            <Link
              href="/vendors/categories"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              Browse the full vendor taxonomy
            </Link>{' '}
            — 192 sub-categories across 5 mega-menu columns.
          </p>
        </div>

        <div className="mt-6">
          <CategoryFilterChips
            currentCategory={filters.category}
            context={{
              q: filters.q,
              city: filters.city,
              sort: filters.sort,
              verifiedOnly: filters.verifiedOnly,
              matchEvent: filters.matchEvent,
            }}
          />
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
                    eventId={coupleEventId}
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
    category: VendorCategory | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
  },
  patch: Partial<{
    q: string;
    category: VendorCategory | null | '';
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
    category: VendorCategory | null;
    city: string;
    sort: SortKey;
    page: number;
    verifiedOnly: boolean;
    matchEvent: boolean;
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
        <span className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            strokeWidth={1.75}
          />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Photographer, florist, name…"
            className="input-field pl-9"
          />
        </span>
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
    category: VendorCategory | null;
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
  eventId,
  ad,
}: {
  vendor: VendorCardRow;
  rating: number;
  reviewCount: number;
  isAuthenticated: boolean;
  isFollowing: boolean;
  eventId: string | null;
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
        {slug ? (
          <Link
            href={href}
            className="text-xs font-medium text-terracotta hover:underline"
          >
            View profile →
          </Link>
        ) : null}
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
    category: VendorCategory | null;
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
