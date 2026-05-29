'use client';

/**
 * Concierge Active Wizard · VISUAL grid vendor-pick primitive.
 *
 * Iteration 0016 · 2026-05-24 owner directive: Card 02 Reception Venue
 * needs to be more visual — venue photos, Setnayan Statement if certified,
 * city, star rating, review count, search bar (hits the full vendor DB
 * on submit), and PAGINATION (3 cols × 5 rows = 15 per page) so the card
 * doesn't extend to 200+ entries.
 *
 * Co-exists with the legacy list-style VendorPickCard. Card 02 swaps to
 * this primitive first; other vendor-pick cards (03/04/05/07/08/10/12/13/
 * 18/19/22/23/24) stay on VendorPickCard until owner asks to migrate.
 *
 * UX shape:
 *   ┌──────────────────────────────────────┐
 *   │ [🔍 Search venues by name or city…]  │  ← submit hits server action
 *   ├──────────────────────────────────────┤
 *   │ ┌──────┐ ┌──────┐ ┌──────┐           │
 *   │ │photo │ │photo │ │photo │           │
 *   │ │ ✓ Setn.   ✓ Setn.    ✓ Setn.       │
 *   │ │ Name  │ │ Name  │ │ Name  │        │
 *   │ │ City  │ │ City  │ │ City  │        │
 *   │ │ ★4.8 (124)                          │
 *   │ │ [Lock]│ │ [Lock]│ │ [Lock]│        │
 *   │ └──────┘ └──────┘ └──────┘           │
 *   │  ...4 more rows (15/page)             │
 *   ├──────────────────────────────────────┤
 *   │ [← Prev]  Page 2 of 8  [Next →]      │
 *   ├──────────────────────────────────────┤
 *   │ [+ Booked elsewhere? Add custom]     │
 *   └──────────────────────────────────────┘
 *
 * Hard constraints per [[feedback_setnayan_concierge_wizard_ux]]:
 *   - NO LINKS inside the wizard card · all completion stays inline
 *   - Each [Lock] button submits to completeVendorPickFromMarketplace
 *     · server action calls revalidatePath which transitions the card
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · all copy is
 * curated brand voice · empty / loading / no-search-results states all
 * read as polite editorial copy.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react';
import {
  PH_REGIONS,
  TOP_DESTINATIONS,
  regionForCity,
} from '@/lib/regions';

const ALL_CITIES_SENTINEL = '__ALL__';
const ALL_REGIONS_SENTINEL = '__ALL__';

/**
 * 2026-05-24 owner directive: grid scales 1-5 columns based on viewport.
 * Rows are locked at 5. So page size = columnCount × 5:
 *   mobile (<sm)      → 1 col × 5 =  5
 *   sm  (>=640px)     → 2 col × 5 = 10
 *   md  (>=768px)     → 3 col × 5 = 15
 *   lg  (>=1024px)    → 4 col × 5 = 20
 *   xl  (>=1280px)    → 5 col × 5 = 25
 *
 * Breakpoints match Tailwind's default `sm/md/lg/xl` so the page-size
 * math always stays in sync with the visible column count. Width >=
 * matched first so xl wins over lg wins over md, etc.
 */
const COLUMN_BREAKPOINTS = [
  { query: '(min-width: 1280px)', columns: 5 },
  { query: '(min-width: 1024px)', columns: 4 },
  { query: '(min-width: 768px)', columns: 3 },
  { query: '(min-width: 640px)', columns: 2 },
] as const;
const ROWS_PER_PAGE = 5;
/** SSR-safe default · 3 cols × 5 rows = 15 (matches the prior fixed size
 *  so the initial render before hydration looks identical to V1). */
const DEFAULT_COLUMN_COUNT = 3;

function readColumnCount(): number {
  if (typeof window === 'undefined') return DEFAULT_COLUMN_COUNT;
  for (const bp of COLUMN_BREAKPOINTS) {
    if (window.matchMedia(bp.query).matches) return bp.columns;
  }
  return 1;
}

/** Haversine distance in km between two lat/lng pairs. Used by the
 *  distance-filter mode on Card 03 ceremony venue. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // mean Earth radius (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Distance filter step (km) for the +/- stepper. Owner-locked 2026-05-24:
 *  +15 km per increment so the host walks 10 → 25 → 40 → 55 → 70 km when
 *  widening from the default 10 km radius. Was 5 km briefly · changed to 15
 *  per the V1 wizard card refinement bundle lock (CLAUDE.md 2026-05-24 row
 *  "V1 wizard card refinement bundle" item 1 Ceremony Venue · item 12
 *  Accommodation). The decrease branch clamps to DISTANCE_MIN_KM so a single
 *  press from 10 lands at 5 (not -5) for hosts who want a tighter radius. */
const DISTANCE_STEP_KM = 15;
/** Hard floor / ceiling for the distance stepper. 5 km too narrow for
 *  most Filipino venue+church pairs · 100 km too wide for the spirit
 *  of "near my reception". These are couple-friendly bounds. */
const DISTANCE_MIN_KM = 5;
const DISTANCE_MAX_KM = 100;
import type { WizardTaskId } from '@/lib/wizard';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import { resolveVendorDisplayName } from '@/lib/vendors';
import {
  completeVendorPickFromMarketplace,
  completeVendorPickFromCustom,
  searchVendorRecommendations,
} from '../../wizard-actions';

/**
 * Hybrid-anonymity display-name resolver for a wizard vendor-pick row.
 *
 * Wraps `resolveVendorDisplayName` from lib/vendors.ts (the canonical
 * helper that all hybrid-anonymity surfaces — vendor-card.tsx,
 * /v/[slug], the marketplace, and this grid card — go through) with
 * the wizard-specific bits the helper needs:
 *
 *   • `primary_canonical_service` is sourced from
 *     `searchContext.canonicalServices[0]`. The grid card is always
 *     scoped to a specific category (Photography / Reception /
 *     Catering / etc.) so the canonical_service is unambiguous at
 *     this surface — no need to thread it via WizardVendorRec.
 *
 *   • `isPaidTier` is `false` because the wizard surface doesn't
 *     join vendor subscription state. Per the canonical migration
 *     header pragmatic note in 20260530010000, the placeholder still
 *     only renders while `name_revealed_at IS NULL` — once a Pro or
 *     Enterprise vendor sends any chat reply (their first day, in
 *     practice) the DB trigger stamps `name_revealed_at` and the
 *     real name surfaces here anyway.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-30 row "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED"
 *     § 1(d) + § 7(f).
 *   • [[project_setnayan_vendor_hybrid_anonymity]] memory rule.
 */
function vendorDisplayName(
  rec: WizardVendorRec,
  canonicalServices: ReadonlyArray<string>,
): string {
  return resolveVendorDisplayName({
    business_name: rec.business_name,
    name_revealed_at: rec.name_revealed_at,
    primary_canonical_service: canonicalServices[0] ?? null,
    location_city: rec.location_city,
  });
}

// PAGE_SIZE is dynamic per breakpoint · computed inside the component as
// `columnCount × ROWS_PER_PAGE`. The legacy fixed 15 was 3 cols × 5 rows;
// the new range is 5 (mobile) to 25 (xl desktop).

type Props = {
  eventId: string;
  taskId: WizardTaskId;
  /** Top-N recommendations pre-fetched server-side. The grid renders
   *  these immediately; submitting the search bar replaces them via
   *  searchVendorRecommendations. */
  initialRecommendations: ReadonlyArray<WizardVendorRec>;
  /** Server-action args passed back when the host hits Search · we
   *  need the same compatibility filters so search results stay scoped
   *  to the event's ceremony_type + venue_setting + already-locked
   *  exclusions. */
  searchContext: {
    canonicalServices: ReadonlyArray<string>;
    ceremonyType: string | null;
    venueSetting: string | null;
    excludeVendorIds: ReadonlyArray<string>;
  };
  /** Per-card customization — drives search placeholder + custom-add
   *  toggle copy + empty-state line. Reception venue passes
   *  category='venue' which renders "venues" in copy; other cards can
   *  reuse this primitive with category='photographer' etc. */
  copy: {
    /** Plural noun for the entity being picked · 'venues' / 'caterers'. */
    pluralNoun: string;
    /** Toggle label for the custom-vendor disclosure. */
    customAddLabel: string;
    /** Hint shown when no recommendations exist for the event's filters. */
    emptyStateCopy: string;
  };
  /** OPTIONAL distance-from-reference filter mode. When present:
   *    · The city dropdown is HIDDEN (replaced by the +/- distance
   *      stepper)
   *    · Recommendations are filtered client-side by haversine distance
   *      from the reference point (typically the host's locked
   *      reception venue · supplied by the parent card)
   *    · Vendors without lat/lng pass through unfiltered (treated as
   *      "unknown location, don't hide")
   *  When absent (default), the legacy city dropdown stays the only
   *  location filter. Card 03 ceremony venue uses this; Card 02
   *  reception venue does not. */
  distanceFilter?: {
    referenceLat: number;
    referenceLng: number;
    /** Initial distance value the stepper renders with (10 km for
     *  Card 03 per 2026-05-24 owner directive). */
    initialKm: number;
    /** Reference label shown beside the stepper · "Reception Venue"
     *  for Card 03. */
    referenceLabel: string;
  };
  /** Marketplace vendor IDs that are CONFIRMED-BOOKED on the host's
   *  chosen wedding date · 2026-05-24 owner directive. Vendors in this
   *  set still appear in the grid (so the host knows they exist) but
   *  render at 30% opacity, lose their action buttons, and show a small
   *  "Booked on your date" chip in place of Compare/Lock. Parent fetches
   *  this set by querying event_vendors for confirmed bookings whose
   *  event.event_date matches the host's pick. Empty array = no
   *  availability filter applied (preview mode / no date locked yet). */
  bookedMarketplaceVendorIds?: ReadonlyArray<string>;
  /** OPTIONAL Region → City cascade filter · 2026-05-24 owner directive
   *  for Card 02 Reception Venue. When TRUE:
   *    · A top-destinations chip strip (8 chips · Metro Manila /
   *      Tagaytay / Cebu / Boracay / Bohol / Palawan / Baguio / Davao)
   *      renders ABOVE the dropdowns · clicking a chip jumps the
   *      picker straight to (region, city).
   *    · A Region dropdown renders WITH the existing City dropdown ·
   *      city options narrow to cities in the picked region (or all
   *      cities when region is "All regions").
   *    · Region filter applies to `hq_region` column on results ·
   *      vendors whose `hq_region` is NULL get the city → region
   *      fallback via `regionForCity(location_city)` so legacy rows
   *      not in the migration backfill still scope correctly.
   *    · URL state `?region=<code>&city=<name>` carries the picks
   *      across reloads + lets hosts share deep links.
   *  Mutually exclusive with `distanceFilter` (distance mode already
   *  replaces the city dropdown). Default FALSE keeps every other
   *  card unchanged · only Card 02 opts in today.
   */
  regionFilter?: boolean;
};

export function VendorPickGridCard({
  eventId,
  taskId,
  initialRecommendations,
  searchContext,
  copy,
  distanceFilter,
  bookedMarketplaceVendorIds,
  regionFilter = false,
}: Props) {
  // URL state · 2026-05-24 owner directive. Region + city picks persist
  // across reloads + are shareable as deep-links. `useSearchParams` is a
  // client hook · the parent passes the same eventId server-side so the
  // URL state is purely a client-side UX layer (doesn't affect server-
  // rendered recs). Mutually exclusive with distanceFilter: when distance
  // mode is on, the city dropdown is replaced by the stepper and the
  // URL params for region/city stay dormant.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlRegion = searchParams?.get('region') ?? null;
  const urlCity = searchParams?.get('city') ?? null;
  // Stable Set lookup so each row renders O(1). Memoized once per render
  // pass · the parent passes a new array reference only when bookings
  // change, which is rare.
  const bookedSet = useMemo(
    () => new Set(bookedMarketplaceVendorIds ?? []),
    [bookedMarketplaceVendorIds],
  );
  /* ─────────────────────────────  state  ───────────────────────────── */

  // Live recommendation set · starts with the server-rendered top-N,
  // gets replaced by search-action results when the host submits a
  // query. The search bar updates this in place without a full RSC
  // re-render so the grid stays responsive on every keystroke (only
  // submit triggers a DB hit · pure UX-cost discipline).
  const [results, setResults] = useState<ReadonlyArray<WizardVendorRec>>(
    initialRecommendations,
  );
  // Search input current value · controlled. Active query (when set)
  // displays a chip + Clear button so the host can reset to the
  // recommendations without retyping.
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  // City filter · 2026-05-24 owner directive. Picks one location_city
  // from the current result set OR the ALL_CITIES_SENTINEL value to
  // clear. Combined with the search bar: search narrows by name/city/
  // tagline server-side, then the city filter narrows again client-side
  // to one specific city. Both can be active together.
  // NOTE · Card 03 ceremony venue uses the distance filter INSTEAD of
  // the city dropdown. When `distanceFilter` is set, the city UI is
  // hidden and this state stays at its default sentinel.
  // Initial value reads from URL `?city=` if regionFilter mode is on
  // so deep-links + reloads preserve the host's pick.
  const [selectedCity, setSelectedCity] = useState<string>(
    regionFilter && urlCity ? urlCity : ALL_CITIES_SENTINEL,
  );

  // Region filter · 2026-05-24 owner directive (Card 02 cascade). Only
  // active when regionFilter prop is TRUE. Initial value reads from URL
  // `?region=` so deep-links preserve the pick. PSGC codes (NCR / CAR /
  // I…XIII / BARMM / NIR) match `hq_region` on vendor_market_stats.
  const [selectedRegion, setSelectedRegion] = useState<string>(
    regionFilter && urlRegion ? urlRegion : ALL_REGIONS_SENTINEL,
  );

  // Distance-from-reference filter · only active when the parent passes
  // a `distanceFilter` prop (Card 03 ceremony venue, anchored at the
  // host's locked reception venue). Initial value comes from the prop
  // (15 km per 2026-05-24 owner directive). Stepper bumps by
  // DISTANCE_STEP_KM, clamped to [DISTANCE_MIN_KM, DISTANCE_MAX_KM].
  const [distanceKm, setDistanceKm] = useState<number>(
    distanceFilter?.initialKm ?? DISTANCE_MAX_KM,
  );

  // Pagination · client-side · resets to page 0 whenever results change.
  const [pageIndex, setPageIndex] = useState(0);

  // Compare flow · 2026-05-24 owner directive.
  //   browsing       → default grid · each card shows [Compare] + [Lock]
  //   picking_second → host picked vendor A, grid still visible, each
  //                    other card's compare button picks vendor B
  //   comparing      → side-by-side view of A vs B with Lock + Compare-
  //                    with-another on both sides
  // Until the host locks a vendor (via either side's Lock button), the
  // flow loops back from comparing → picking_second when they click
  // "Compare with another" on whichever side they want to keep.
  type CompareState =
    | { mode: 'browsing' }
    | { mode: 'picking_second'; vendorA: WizardVendorRec }
    | { mode: 'comparing'; vendorA: WizardVendorRec; vendorB: WizardVendorRec };
  const [compareState, setCompareState] = useState<CompareState>({
    mode: 'browsing',
  });

  // Responsive column count · matches Tailwind breakpoints so the
  // pageSize = columnCount × ROWS_PER_PAGE math stays in lockstep with
  // the visible grid. Window-width detection via matchMedia; resize
  // listener keeps things in sync as the host drags the window between
  // breakpoints. Starts at the SSR-safe default to avoid hydration
  // mismatch flash.
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMN_COUNT);
  useEffect(() => {
    function update() {
      setColumnCount(readColumnCount());
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const PAGE_SIZE_DYNAMIC = columnCount * ROWS_PER_PAGE;

  // Lock-vendor + custom-add state · same pattern as VendorPickCard so
  // host behavior is consistent across both primitives.
  const [showCustom, setShowCustom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingVendorId, setPendingVendorId] = useState<string | null>(null);
  const [, startLockTransition] = useTransition();

  // 2026-05-24 hotfix — owner reported Card 12 (Music + Entertainment)
  // compare-flow lock got stuck on "Locking…" with no error surface. Root
  // cause: the success branch of `handleLockMarketplace` never reset
  // `pendingVendorId` — it relied on the parent server component
  // re-rendering (via the action's `revalidatePath`) to unmount the whole
  // grid card. If revalidation lagged or silently failed (Vercel cold
  // start · edge cache miss · upstream JSONB write quirk · serverless
  // function timeout near 10s), the button stayed disabled forever and
  // the host had no way to retry except hard-refresh the page.
  //
  // `useRouter().refresh()` is the belt-and-suspenders force-re-fetch
  // that fires after every successful lock; pairing it with a `finally`
  // block on the transition (see handleLockMarketplace below) means the
  // button ALWAYS recovers regardless of how the action resolved. If
  // the parent does re-render cleanly, the component unmounts and the
  // setState in finally is a no-op; if it doesn't, the host sees a
  // working button again and can re-try or use Add Custom.
  const router = useRouter();

  /* ─────────────  city + region filter derivation  ────────────── */

  // Resolved region per vendor · 2026-05-24 cascade fallback. If the
  // migration backfilled hq_region we trust it (canonical). Otherwise
  // we derive from location_city using the same city → region map the
  // migration uses (`regionForCity`) · keeps legacy off-platform
  // vendors that pre-date the migration in the picker without forcing
  // a manual admin patch. Returns NULL when neither path resolves a
  // region (truly unknown · region filter treats them as "don't hide
  // when no region picked" / "hide when specific region picked").
  function resolveRegion(r: WizardVendorRec): string | null {
    if (r.hq_region) return r.hq_region;
    return regionForCity(r.location_city);
  }

  // Apply the region filter FIRST (when active) so the city dropdown
  // only surfaces cities in the picked region. When region is "All"
  // (default), every city in the current result set surfaces.
  const regionScopedResults = useMemo(() => {
    if (!regionFilter || selectedRegion === ALL_REGIONS_SENTINEL) {
      return results;
    }
    return results.filter((r) => resolveRegion(r) === selectedRegion);
  }, [results, selectedRegion, regionFilter]);

  // Unique, alphabetized city list pulled from the REGION-SCOPED result
  // set so the city dropdown narrows when a region is picked. Empty /
  // null cities are stripped so the picker only offers actual locations.
  // Cap at the result set's cities — we deliberately don't list every
  // PH city (would surface "no matches" empty states for cities with
  // no vendors, which is worse than just not offering the option).
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of regionScopedResults) {
      if (r.location_city && r.location_city.trim().length > 0) {
        set.add(r.location_city.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'en-PH'));
  }, [regionScopedResults]);

  // Apply EITHER the distance filter (Card 03 mode) OR the city filter
  // (Card 02 mode) · the two filters are mutually exclusive by design.
  // Vendors without lat/lng pass through the distance filter
  // (treated as "unknown location, don't hide") so we don't drop
  // off-platform vendors that lack hq coordinates. Downstream
  // pagination math operates on this filtered slice so page counts
  // adjust correctly.
  //
  // When regionFilter is on, the region filter already ran via
  // `regionScopedResults` above. The city filter then narrows further
  // (region → city cascade). When regionFilter is off (default), the
  // city filter applies directly to `results` matching V1 behavior.
  const filteredResults = useMemo(() => {
    if (distanceFilter) {
      const { referenceLat, referenceLng } = distanceFilter;
      return results.filter((r) => {
        if (r.hq_latitude == null || r.hq_longitude == null) return true;
        const km = haversineKm(
          referenceLat,
          referenceLng,
          r.hq_latitude,
          r.hq_longitude,
        );
        return km <= distanceKm;
      });
    }
    const base = regionFilter ? regionScopedResults : results;
    if (selectedCity === ALL_CITIES_SENTINEL) return base;
    return base.filter(
      (r) => (r.location_city ?? '').trim() === selectedCity,
    );
  }, [
    results,
    regionScopedResults,
    selectedCity,
    distanceFilter,
    distanceKm,
    regionFilter,
  ]);

  /** Nearest-fallback · owner-locked 2026-05-24 ("fallback to nearest with
   *  distance label"). Fires only when distanceFilter is active AND the
   *  current radius narrows results to zero. Surfaces the single closest
   *  vendor beyond the radius (computed from the unfiltered `results` set)
   *  so the host always sees a real option rather than a generic empty
   *  state — particularly important for couples in low-density regions
   *  where no church / accommodation falls within 10 km. The host can
   *  widen the stepper (now visible to them via the +15 km steps) or pick
   *  this closest match directly. Returns null in every other case so the
   *  city / search / generic empty-state copy paths render unchanged. */
  const nearestBeyondRadius = useMemo<{ rec: WizardVendorRec; km: number } | null>(() => {
    if (!distanceFilter) return null;
    if (filteredResults.length > 0) return null;
    const { referenceLat, referenceLng } = distanceFilter;
    let nearest: { rec: WizardVendorRec; km: number } | null = null;
    for (const r of results) {
      if (r.hq_latitude == null || r.hq_longitude == null) continue;
      const km = haversineKm(referenceLat, referenceLng, r.hq_latitude, r.hq_longitude);
      if (nearest === null || km < nearest.km) {
        nearest = { rec: r, km };
      }
    }
    return nearest;
  }, [distanceFilter, filteredResults, results]);

  /* ───────────  URL sync · region + city deep-links  ─────────── */

  // 2026-05-24 owner directive · `?region=NCR&city=Manila` carries the
  // host's picks across reloads + shareable links. Only fires when
  // regionFilter is on (Card 02). Uses replaceState (not router.replace)
  // so the URL update doesn't trigger a navigation / RSC refetch · purely
  // a client-side bookmark update. The router.replace path would cause
  // every filter tweak to re-run the server component, which costs the
  // search-debounce + freshness we get from client-only filtering.
  useEffect(() => {
    if (!regionFilter) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (selectedRegion === ALL_REGIONS_SENTINEL) {
      params.delete('region');
    } else {
      params.set('region', selectedRegion);
    }
    if (selectedCity === ALL_CITIES_SENTINEL) {
      params.delete('city');
    } else {
      params.set('city', selectedCity);
    }
    const queryString = params.toString();
    const nextUrl =
      queryString.length > 0 ? `${pathname}?${queryString}` : pathname;
    window.history.replaceState(null, '', nextUrl);
    // pathname is stable for the dashboard route · searchParams is a
    // reference type so we depend on its toString() implicitly via the
    // selected* state effects below. The state values are the source of
    // truth for filters · URL is a mirror.
  }, [
    regionFilter,
    selectedRegion,
    selectedCity,
    pathname,
    searchParams,
  ]);

  /* ───────────────────  pagination derivation  ────────────────────── */

  // PAGE_SIZE_DYNAMIC scales with viewport breakpoint (5/10/15/20/25).
  // When the column count changes mid-browse (resize), totalPages
  // recomputes and safePageIndex falls back into range so the host
  // never lands on an empty page.
  const totalPages = Math.max(
    1,
    Math.ceil(filteredResults.length / PAGE_SIZE_DYNAMIC),
  );
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = safePageIndex * PAGE_SIZE_DYNAMIC;
  const visible = useMemo(
    () => filteredResults.slice(pageStart, pageStart + PAGE_SIZE_DYNAMIC),
    [filteredResults, pageStart, PAGE_SIZE_DYNAMIC],
  );

  function handleCityChange(value: string) {
    setSelectedCity(value);
    setPageIndex(0); // reset to first page on filter change
  }

  /** Region change · resets the city pick to "All cities" within the new
   *  region because the previous city likely isn't in the new region's
   *  set. Also resets pagination so the host lands on page 1 of the
   *  newly-filtered results. */
  function handleRegionChange(value: string) {
    setSelectedRegion(value);
    setSelectedCity(ALL_CITIES_SENTINEL);
    setPageIndex(0);
  }

  /** Top-destination chip click · 2026-05-24 owner directive. Jumps the
   *  picker straight to (region, city) without forcing the host through
   *  the dropdown ladder. The most-common path for hosts who know they
   *  want "Tagaytay venues" or "Cebu venues" — one tap. */
  function handleTopDestinationClick(region: string, city: string) {
    setSelectedRegion(region);
    setSelectedCity(city);
    setPageIndex(0);
  }

  /* ─────────────────────  compare flow handlers  ───────────────────── */

  /** Host clicked [Compare] on a card. Enter picking-second mode with
   *  this vendor preserved. Grid stays visible so they can pick B. */
  function handleStartCompare(rec: WizardVendorRec) {
    setCompareState({ mode: 'picking_second', vendorA: rec });
    setErrorMessage(null);
  }

  /** Host clicked [Pick this for compare] on a card while in
   *  picking_second mode · vendor B is set, enter comparing mode. */
  function handlePickSecond(rec: WizardVendorRec) {
    if (compareState.mode !== 'picking_second') return;
    if (compareState.vendorA.vendor_profile_id === rec.vendor_profile_id) return;
    setCompareState({
      mode: 'comparing',
      vendorA: compareState.vendorA,
      vendorB: rec,
    });
  }

  /** Host clicked [Compare with another] inside the side-by-side
   *  comparison · keeps the chosen side as A and reopens the picker. */
  function handleKeepAndCompareAnother(keepSide: 'A' | 'B') {
    if (compareState.mode !== 'comparing') return;
    const newA =
      keepSide === 'A' ? compareState.vendorA : compareState.vendorB;
    setCompareState({ mode: 'picking_second', vendorA: newA });
  }

  /** Cancel the compare flow entirely · back to default grid. */
  function handleCancelCompare() {
    setCompareState({ mode: 'browsing' });
    setErrorMessage(null);
  }

  /* ───────────────────  search submit handler  ────────────────────── */

  function handleSearchSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const trimmed = searchInput.trim();
    setSearchError(null);
    startSearchTransition(async () => {
      try {
        const rows = await searchVendorRecommendations({
          eventId,
          canonicalServices: searchContext.canonicalServices,
          ceremonyType: searchContext.ceremonyType,
          venueSetting: searchContext.venueSetting,
          excludeVendorIds: searchContext.excludeVendorIds,
          query: trimmed,
          limit: 100,
        });
        setResults(rows);
        setActiveQuery(trimmed.length > 0 ? trimmed : null);
        setPageIndex(0);
        // Reset city filter on every new search so the picker's options
        // reflect the fresh result set. The host can re-pick a city after
        // the new grid renders. Region filter resets too (when active)
        // so a search-mid-pick doesn't strand the host on a region whose
        // results moved.
        setSelectedCity(ALL_CITIES_SENTINEL);
        if (regionFilter) setSelectedRegion(ALL_REGIONS_SENTINEL);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Search didn't come back — try again.";
        setSearchError(message);
      }
    });
  }

  function clearSearch() {
    setSearchInput('');
    setActiveQuery(null);
    setResults(initialRecommendations);
    setPageIndex(0);
    setSearchError(null);
    setSelectedCity(ALL_CITIES_SENTINEL);
    if (regionFilter) setSelectedRegion(ALL_REGIONS_SENTINEL);
  }

  /* ──────────────────────  lock handlers  ─────────────────────────── */

  function handleLockMarketplace(rec: WizardVendorRec) {
    setErrorMessage(null);
    setPendingVendorId(rec.vendor_profile_id);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    formData.set('marketplace_vendor_id', rec.vendor_profile_id);
    formData.set('vendor_name', rec.business_name);

    startLockTransition(async () => {
      try {
        await completeVendorPickFromMarketplace(formData);
        // 2026-05-24 hotfix · belt-and-suspenders force-re-render. The
        // server action already calls `revalidatePath('/dashboard/{id}')`
        // which SHOULD invalidate the route cache + trigger the parent
        // server component to refetch. But owner-reported Card 12
        // lock-stuck (band / live music compare flow) revealed that
        // revalidatePath sometimes doesn't fully propagate before the
        // transition ends — leaving the host staring at "Locking…" on
        // a button that succeeded server-side. Manually pinging
        // `router.refresh()` from the client guarantees the dashboard
        // page re-fetches even if revalidatePath lagged. Safe to call
        // both — the framework dedupes.
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock this pick. Try again or add manually below.";
        setErrorMessage(message);
      } finally {
        // Always reset the pending-state so the button is interactive
        // again regardless of outcome. If the action succeeded and the
        // parent re-render unmounts the card, this setState is a no-op
        // on a stale component (React warns but doesn't crash). If the
        // action failed OR the parent didn't re-render, the host sees
        // a working button again + the error chip below.
        setPendingVendorId(null);
      }
    });
  }

  /* ─────────────────────────  render  ──────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Search bar — submit on Enter or click · hits the full DB via
          searchVendorRecommendations(). Active-query chip shows when a
          search is in effect so the host can clear back to recs.
          Hidden during the side-by-side comparing mode so the panel
          owns the full surface; the picking_second mode keeps the
          search visible so the host can still hunt for a second
          vendor by name. */}
      {compareState.mode !== 'comparing' ? (
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
            strokeWidth={2}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${copy.pluralNoun} by name or city…`}
            maxLength={64}
            // Right padding bumped to pr-10 to reserve space for the
            // inline clear affordance below · prevents the input text
            // from sliding underneath the X icon when the box fills up.
            className="w-full rounded-lg border border-ink/15 bg-white py-2.5 pl-9 pr-10 text-sm placeholder-ink/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
          {/* Inline clear · 2026-05-24 owner directive: clear lives
              inside the search box, replacing the standalone "Clear"
              chip that used to sit below the input. Shows whenever
              there's something to clear (typed text OR a committed
              query). The button reads "Clear search" for screen readers
              while showing a small × glyph that fades to a tinted
              terracotta hover state · click clears typed text AND any
              committed activeQuery in one action. */}
          {(searchInput.length > 0 || activeQuery) ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              title="Clear search"
              className="group absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink/45 transition-colors hover:bg-terracotta/10 hover:text-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            >
              <X
                aria-hidden
                className="h-4 w-4"
                strokeWidth={2.25}
              />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>
      ) : null}

      {/* Distance-from-reference stepper · 2026-05-24 owner directive
          for Card 03 ceremony venue. Replaces the city dropdown when
          `distanceFilter` is set on the parent. Hidden during comparing
          mode (the side-by-side panel owns the surface). */}
      {compareState.mode !== 'comparing' && distanceFilter ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Distance from {distanceFilter.referenceLabel}
          </span>
          <div className="ml-auto inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDistanceKm((km) =>
                  Math.max(DISTANCE_MIN_KM, km - DISTANCE_STEP_KM),
                )
              }
              disabled={distanceKm <= DISTANCE_MIN_KM}
              aria-label={`Decrease distance by ${DISTANCE_STEP_KM} km`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink transition-colors hover:bg-terracotta/10 hover:border-terracotta/30 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden className="text-base font-medium">−</span>
            </button>
            <span className="min-w-[3.5rem] text-center text-sm font-semibold text-ink tabular-nums">
              {distanceKm} km
            </span>
            <button
              type="button"
              onClick={() =>
                setDistanceKm((km) =>
                  Math.min(DISTANCE_MAX_KM, km + DISTANCE_STEP_KM),
                )
              }
              disabled={distanceKm >= DISTANCE_MAX_KM}
              aria-label={`Increase distance by ${DISTANCE_STEP_KM} km`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink transition-colors hover:bg-terracotta/10 hover:border-terracotta/30 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden className="text-base font-medium">+</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Top destinations chip strip · 2026-05-24 owner directive for
          Card 02 Reception Venue. 8 one-tap chips for the most-searched
          PH wedding areas (Metro Manila · Tagaytay · Cebu · Boracay ·
          Bohol · Palawan · Baguio · Davao). Each chip jumps the picker
          straight to (region, city) bypassing the dropdown ladder.
          Only renders when regionFilter mode is on AND not in distance
          mode AND not in compare mode. */}
      {regionFilter && compareState.mode !== 'comparing' && !distanceFilter ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex w-full items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 sm:w-auto sm:mr-1 sm:self-center">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Top areas
          </span>
          {TOP_DESTINATIONS.map((dest) => {
            const isActive =
              selectedRegion === dest.region && selectedCity === dest.city;
            return (
              <button
                key={`${dest.region}:${dest.city}`}
                type="button"
                onClick={() =>
                  handleTopDestinationClick(dest.region, dest.city)
                }
                className={
                  isActive
                    ? 'inline-flex min-h-[32px] items-center rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-cream shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta/30'
                    : 'inline-flex min-h-[32px] items-center rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 hover:text-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30'
                }
              >
                {dest.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Region dropdown · 2026-05-24 owner directive for Card 02. Sits
          ABOVE the city dropdown · picking a region narrows the city
          dropdown to cities in that region. "All regions" sentinel
          clears the filter. Hidden in distance / compare modes — see
          the same conditions on the city dropdown below. */}
      {regionFilter && compareState.mode !== 'comparing' && !distanceFilter ? (
        <div className="flex items-center gap-2">
          <label
            htmlFor="vendor-grid-region-filter"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Region
          </label>
          <select
            id="vendor-grid-region-filter"
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="min-h-[36px] flex-1 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 sm:max-w-md"
          >
            <option value={ALL_REGIONS_SENTINEL}>
              All regions · {results.length}{' '}
              {results.length === 1 ? 'result' : 'results'}
            </option>
            {PH_REGIONS.map((region) => {
              const regionCount = results.filter(
                (r) => resolveRegion(r) === region.code,
              ).length;
              if (regionCount === 0) return null;
              return (
                <option key={region.code} value={region.code}>
                  {region.name} · {regionCount}
                </option>
              );
            })}
          </select>
          {selectedRegion !== ALL_REGIONS_SENTINEL ? (
            <button
              type="button"
              onClick={() => handleRegionChange(ALL_REGIONS_SENTINEL)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta transition-colors hover:text-terracotta-700"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {/* City filter · derived from the current result set so the
          dropdown only offers cities with actual vendors. Native
          <select> works on both mobile (OS-native picker sheet) and
          desktop (dropdown) per the responsive-by-default rule. Hidden
          when result set has 0 or 1 cities — nothing to filter. Also
          hidden during full comparing mode AND when distanceFilter is
          active (the two filters are mutually exclusive · Card 03 uses
          the stepper above).
          When regionFilter is on, cityOptions narrows to cities in the
          picked region (handled by regionScopedResults derivation
          above), so this dropdown becomes the second tier of the
          cascade. */}
      {compareState.mode !== 'comparing' && !distanceFilter && cityOptions.length > 1 ? (
        <div className="flex items-center gap-2">
          <label
            htmlFor="vendor-grid-city-filter"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            City
          </label>
          <select
            id="vendor-grid-city-filter"
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="min-h-[36px] flex-1 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 sm:max-w-xs"
          >
            <option value={ALL_CITIES_SENTINEL}>
              All cities · {regionScopedResults.length}{' '}
              {regionScopedResults.length === 1 ? 'result' : 'results'}
            </option>
            {cityOptions.map((city) => {
              // Count vendors per city WITHIN the region-scoped slice so
              // the per-option count reflects the cascade. When region is
              // "All", regionScopedResults === results so this matches V1.
              const cityCount = regionScopedResults.filter(
                (r) => (r.location_city ?? '').trim() === city,
              ).length;
              return (
                <option key={city} value={city}>
                  {city} · {cityCount}
                </option>
              );
            })}
          </select>
          {selectedCity !== ALL_CITIES_SENTINEL ? (
            <button
              type="button"
              onClick={() => handleCityChange(ALL_CITIES_SENTINEL)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta transition-colors hover:text-terracotta-700"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Active-search chip · shows the query + match count as context.
          The Clear affordance now lives inside the search input itself
          (the X icon · 2026-05-24 owner directive), so the chip is
          purely informational. */}
      {activeQuery ? (
        <div className="rounded-lg bg-cream/60 px-3 py-2 text-xs text-ink/70">
          Showing matches for{' '}
          <strong className="font-medium text-ink">{activeQuery}</strong>
          {' · '}
          {results.length} {results.length === 1 ? 'match' : 'matches'}
        </div>
      ) : null}

      {searchError ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {searchError}
        </p>
      ) : null}

      {/* Comparing-mode side-by-side panel · replaces the grid + controls
          when the host has picked both A and B. Each side has its own
          [Lock this pick] + [Compare with another]. Per 2026-05-24 owner
          directive. */}
      {compareState.mode === 'comparing' ? (
        <CompareSideBySide
          vendorA={compareState.vendorA}
          vendorB={compareState.vendorB}
          /* V2.1 amendment #2 · hybrid-anonymity. CompareSideBySide
             renders each vendor's display name + photo initial — both
             need to resolve against the canonical category so a hidden
             business_name surfaces as the taxonomy + city placeholder
             instead. */
          canonicalServices={searchContext.canonicalServices}
          isPendingId={pendingVendorId}
          onLock={(rec) => handleLockMarketplace(rec)}
          onKeepAndCompareAnother={handleKeepAndCompareAnother}
          onCancel={handleCancelCompare}
        />
      ) : null}

      {/* Picking-second banner · grid stays visible below so the host can
          pick a vendor B. Indicates the vendor A they're comparing
          against + a Cancel CTA. */}
      {compareState.mode === 'picking_second' ? (
        <div className="flex items-center gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80">
          <ArrowLeftRight
            aria-hidden
            className="h-4 w-4 flex-shrink-0 text-terracotta"
            strokeWidth={2}
          />
          <span className="flex-1">
            Pick a second one to compare with{' '}
            <strong className="font-medium text-ink">
              {/* Hybrid-anonymity (V2.1 brief amendment #2 · 2026-05-30):
                  render the same display label the card itself shows so
                  the picking-second banner doesn't leak a hidden
                  business_name. See lib/vendors.ts ·
                  resolveVendorDisplayName. */}
              {vendorDisplayName(compareState.vendorA, searchContext.canonicalServices)}
            </strong>
            . Tap <strong className="font-medium text-ink">Pick to compare</strong> on any card below.
          </span>
          <button
            type="button"
            onClick={handleCancelCompare}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta transition-colors hover:text-terracotta-700"
          >
            <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
            Cancel
          </button>
        </div>
      ) : null}

      {/* Grid · adaptive 1-5 cols based on viewport, 5 rows per page.
          PAGE_SIZE_DYNAMIC = columnCount × 5. Cards have constant photo
          aspect ratio so each row stays even-height. Hidden when in
          full comparing mode (side-by-side already replaces it). */}
      {compareState.mode !== 'comparing' && visible.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((rec) => {
            const isVendorA =
              compareState.mode === 'picking_second' &&
              compareState.vendorA.vendor_profile_id === rec.vendor_profile_id;
            const isBooked = bookedSet.has(rec.vendor_profile_id);
            return (
              <VendorGridCardRow
                key={rec.vendor_profile_id}
                rec={rec}
                /* V2.1 amendment #2 · hybrid-anonymity. Threading the
                   canonical category set so the row's display name +
                   photo initial fallback both resolve against the
                   right taxonomy when the vendor's business_name is
                   hidden (Free + Verified pre-first-reply). */
                canonicalServices={searchContext.canonicalServices}
                isPending={pendingVendorId === rec.vendor_profile_id}
                compareMode={compareState.mode}
                isVendorA={isVendorA}
                isBooked={isBooked}
                onLock={() => handleLockMarketplace(rec)}
                onStartCompare={() => handleStartCompare(rec)}
                onPickAsSecond={() => handlePickSecond(rec)}
              />
            );
          })}
        </ul>
      ) : compareState.mode === 'comparing' ? null : distanceFilter && filteredResults.length === 0 && results.length > 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-center text-sm leading-relaxed text-ink/70">
          No {copy.pluralNoun} within{' '}
          <strong className="font-medium text-ink">{distanceKm} km</strong> of your{' '}
          {distanceFilter.referenceLabel.toLowerCase()}. Try widening the distance
          — or add yours below.
        </p>
      ) : regionFilter && selectedRegion !== ALL_REGIONS_SENTINEL && filteredResults.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-center text-sm leading-relaxed text-ink/70">
          No {copy.pluralNoun} in{' '}
          <strong className="font-medium text-ink">
            {PH_REGIONS.find((r) => r.code === selectedRegion)?.name.split(
              ' · ',
            )[0] ?? selectedRegion}
          </strong>{' '}
          {selectedCity !== ALL_CITIES_SENTINEL ? (
            <>
              ·{' '}
              <strong className="font-medium text-ink">{selectedCity}</strong>{' '}
            </>
          ) : null}
          right now. Try another region or city — or add yours below.
        </p>
      ) : selectedCity !== ALL_CITIES_SENTINEL ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-center text-sm leading-relaxed text-ink/70">
          No {copy.pluralNoun} in <strong className="font-medium text-ink">{selectedCity}</strong>{' '}
          right now. Try another city — or add yours below.
        </p>
      ) : activeQuery ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-center text-sm leading-relaxed text-ink/70">
          No {copy.pluralNoun} matched <strong className="font-medium text-ink">{activeQuery}</strong>.
          Try a different name or area — or add yours below.
        </p>
      ) : nearestBeyondRadius && distanceFilter ? (
        /* Nearest-fallback · owner-locked 2026-05-24 ("fallback to nearest
         *  with distance label"). When the distance filter narrows results
         *  to zero, surface the single closest match beyond the radius so
         *  the host sees a real option rather than a generic empty state.
         *  Cream-toned card with terracotta accent · matches the brand
         *  voice of the "Closest match" framing the spec calls out. */
        <div className="rounded-xl border border-terracotta/30 bg-cream/60 px-5 py-5 text-sm leading-relaxed text-ink/75">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta-700">
            Closest match
          </p>
          <p className="mt-2 font-display text-lg italic text-ink">
            {/* Hybrid-anonymity (V2.1 brief amendment #2 · 2026-05-30):
                same display label the host would see if the row were
                in the grid · doesn't leak a hidden business_name. */}
            {vendorDisplayName(nearestBeyondRadius.rec, searchContext.canonicalServices)}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {nearestBeyondRadius.km.toFixed(1)} km from your {distanceFilter.referenceLabel.toLowerCase()} — beyond your current {distanceKm} km radius.
          </p>
          <p className="mt-3 text-xs text-ink/55">
            No {copy.pluralNoun} within {distanceKm} km of your {distanceFilter.referenceLabel.toLowerCase()}. Widen the radius above with the +{DISTANCE_STEP_KM} km stepper to see more — or add your own match below.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-sm leading-relaxed text-ink/70">
          {copy.emptyStateCopy}
        </p>
      )}

      {/* Pagination · only when more than 1 page. Page 1 of N display.
          Buttons stay 44px tap targets for thumb-zone reach. Hidden
          during comparing mode — the side-by-side panel owns the
          surface there. */}
      {compareState.mode !== 'comparing' && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-cream/40 px-3 py-2">
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePageIndex === 0}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Prev
          </button>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Page {safePageIndex + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePageIndex >= totalPages - 1}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Custom-vendor disclosure — same pattern + same server action
          as VendorPickCard so manual entry stays consistent. */}
      <div className="border-t border-ink/10 pt-4">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {copy.customAddLabel}
          </button>
        ) : (
          <CustomVendorForm
            eventId={eventId}
            taskId={taskId}
            onCancel={() => setShowCustom(false)}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Tile photo · branches on presentation_pattern + services_preview count.
 *
 * 2026-05-24 V1.1 multi-photo tile per CLAUDE.md decision-log row
 * "Vendor presentation pattern locked" + 02_Specifications/
 * Vendor_Taxonomy_V1_Master.md § 10.
 *
 *   Pattern A (creations) + services_preview.length >= 2:
 *     2×2 collage of up to 4 service photos · couples see the vendor's
 *     portfolio range at a glance (stylist · photographer · cake · attire
 *     · band · etc.). When there are 2-3 photos available, fills the
 *     remaining cells with the brand-monogram initial fallback.
 *
 *   Pattern B (locked) OR Pattern A with < 2 photos OR null pattern:
 *     Single-hero photo (existing V1 behavior) · photoUrl resolves via
 *     primary_photo_url → logo_url → initial fallback.
 *
 * Used twice in this file · once in the main grid tile (BlockRow) and
 * once in the CompareSide panel. Sizes prop tunes responsive image
 * srcset per call-site.
 * ──────────────────────────────────────────────────────────────────── */

function TilePhoto({
  rec,
  sizes,
  initialSizeClass,
  displayLabel,
  children,
}: {
  rec: WizardVendorRec;
  sizes: string;
  initialSizeClass: string;
  /** Resolved hybrid-anonymity display label (V2.1 amendment #2 ·
   *  2026-05-30) · drives the initial-letter photo fallback so a
   *  vendor with a hidden business_name doesn't leak the first
   *  letter via the placeholder tile. */
  displayLabel?: string;
  /** Overlays (Verified badge, etc.) positioned absolute against the
   *  tile container. */
  children?: React.ReactNode;
}) {
  // Photo initial fallback: prefer the explicitly-resolved display
  // label (post hybrid-anonymity) when caller supplied one, falling
  // back to the raw business_name for any caller that hasn't been
  // migrated yet. Both paths land on a real first character because
  // `resolveVendorDisplayName` guarantees a non-empty string.
  const initial = (displayLabel ?? rec.business_name).charAt(0).toUpperCase();
  const isCreations =
    rec.presentation_pattern === 'creations' &&
    rec.services_preview.length >= 2;

  if (isCreations) {
    // 2×2 collage · up to 4 photos. Fill remaining cells (if 2-3 photos)
    // with the initial-letter fallback so the 4-cell grid always looks
    // intentional. CSS grid · no JS, no third-party libs.
    const photos = rec.services_preview.slice(0, 4);
    return (
      <div className="relative aspect-[4/3] w-full bg-terracotta/8">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
          {Array.from({ length: 4 }).map((_, idx) => {
            const photo = photos[idx];
            return (
              <div
                key={idx}
                className="relative overflow-hidden bg-terracotta/8"
              >
                {photo ? (
                  <Image
                    src={photo.photo_url}
                    alt=""
                    fill
                    sizes={sizes}
                    className="object-cover"
                  />
                ) : (
                  <span
                    className={`absolute inset-0 flex items-center justify-center font-display italic text-terracotta/40 ${initialSizeClass}`}
                  >
                    {initial}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {children}
      </div>
    );
  }

  // Pattern B / fallback · single-hero (existing V1 behavior).
  const photoUrl = rec.primary_photo_url ?? rec.logo_url ?? null;
  return (
    <div className="relative aspect-[4/3] w-full bg-terracotta/8">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center font-display italic text-terracotta/40 ${initialSizeClass}`}
        >
          {initial}
        </span>
      )}
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Single grid card · photo + Setnayan Statement (if verified) + name +
 * city + star/reviews + Lock button.
 *
 * Photo source ladder:
 *   1. primary_photo_url (vendor_services.primary_photo_r2_key resolved)
 *   2. logo_url (vendor_profiles.logo_url)
 *   3. monogram initial on tinted background
 * ──────────────────────────────────────────────────────────────────── */

function VendorGridCardRow({
  rec,
  canonicalServices,
  isPending,
  compareMode,
  isVendorA,
  isBooked,
  onLock,
  onStartCompare,
  onPickAsSecond,
}: {
  rec: WizardVendorRec;
  /** Canonical category set for the parent wizard card · drives the
   *  hybrid-anonymity placeholder taxonomy when rec.business_name is
   *  hidden (V2.1 brief amendment #2 · 2026-05-30). */
  canonicalServices: ReadonlyArray<string>;
  isPending: boolean;
  /** 'browsing' = default · 'picking_second' = host has chosen A and
   *  is picking B · 'comparing' is never passed here (the side-by-side
   *  panel replaces the grid). */
  compareMode: 'browsing' | 'picking_second' | 'comparing';
  /** TRUE when this row IS vendor A (host already picked it). Renders
   *  a "Selected" pill on the photo + disables both action buttons. */
  isVendorA: boolean;
  /** TRUE when this vendor is CONFIRMED-BOOKED on the host's chosen
   *  wedding date · 2026-05-24 owner directive. The whole card renders
   *  at 30% opacity, no action buttons, "Booked on your date" chip in
   *  place of Compare/Lock. The host still SEES the vendor (so they
   *  know they exist + can plan around them) but can't try to lock
   *  someone who can't take the booking. */
  isBooked: boolean;
  onLock: () => void;
  onStartCompare: () => void;
  onPickAsSecond: () => void;
}) {
  const ratingDisplay =
    rec.avg_rating_overall && rec.avg_rating_overall > 0
      ? rec.avg_rating_overall.toFixed(1)
      : null;
  const reviewCount = rec.review_count ?? 0;
  const isCertified = rec.verification_state === 'verified';

  // V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity display
  // label. Resolves to either the real business_name (when revealed
  // post first-chat-reply OR for paid tiers) OR the taxonomy + city
  // placeholder (Free + Verified pre-first-reply). Single helper
  // call so the line + the photo initial fallback below stay in lock-step.
  const displayLabel = vendorDisplayName(rec, canonicalServices);

  // 30% opacity + non-interactive when booked (2026-05-24 owner directive).
  // Owner-A highlight wins over booked styling — the host is mid-flow on
  // the comparison and shouldn't see their picked-A vendor dimmed even if
  // the schedule shows booked elsewhere (which would be incoherent UX).
  const liClass = isVendorA
    ? 'group flex flex-col overflow-hidden rounded-xl border-2 border-terracotta bg-cream shadow-md transition-shadow'
    : isBooked
      ? 'group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm opacity-30'
      : 'group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm transition-shadow hover:shadow-md';

  return (
    <li className={liClass} aria-disabled={isBooked || undefined}>
      {/* Photo · 4:3 aspect so each row stays even-height. Verified +
          owner-A badges overlay via <TilePhoto>'s children prop.
          Pattern A vendors with 2+ service photos render as 2×2 collage;
          Pattern B + fallback render single-hero (V1 behavior). */}
      <TilePhoto
        rec={rec}
        /* Hybrid-anonymity: photo initial-letter fallback uses the
           display label's first character so hidden vendors render
           e.g. "M" for "Manila Wedding Photographer" instead of
           leaking the first letter of the real business_name. */
        displayLabel={displayLabel}
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
        initialSizeClass="text-5xl"
      >
        {isCertified ? (
          <span
            title="Documents reviewed and approved by Setnayan."
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cream shadow-sm backdrop-blur-sm"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="h-3 w-3 fill-current"
            >
              <path d="M10.28 3.22a.75.75 0 010 1.06L5.06 9.5a.75.75 0 01-1.06 0L1.72 7.22a.75.75 0 011.06-1.06l1.75 1.75 4.69-4.69a.75.75 0 011.06 0z" />
            </svg>
            Setnayan Verified
          </span>
        ) : null}
        {isVendorA ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-terracotta/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cream shadow-sm backdrop-blur-sm">
            <ArrowLeftRight
              aria-hidden
              className="h-3 w-3"
              strokeWidth={2.5}
            />
            Comparing
          </span>
        ) : null}
      </TilePhoto>

      {/* Body · name + city + rating + Compare/Lock CTAs. */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-1 text-sm font-semibold leading-tight text-ink sm:text-base">
          {displayLabel}
        </p>

        {/* Setnayan Statement · only when verified · short brand-voice
            line that explains what the verification means. */}
        {isCertified ? (
          <p className="text-[11px] leading-snug text-emerald-800/85">
            Documents reviewed by Setnayan.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
          {rec.location_city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="h-3 w-3" strokeWidth={2} />
              {rec.location_city}
            </span>
          ) : null}
          {ratingDisplay ? (
            <span className="inline-flex items-center gap-1">
              <Star
                aria-hidden
                className="h-3 w-3 fill-current text-amber-500"
                strokeWidth={1.5}
              />
              <strong className="font-medium text-ink/85">{ratingDisplay}</strong>
              <span className="text-ink/45">
                ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </span>
          ) : (
            <span className="text-ink/40">No reviews yet</span>
          )}
        </div>

        {/* Action row · Compare on left, Lock on right (owner directive
            2026-05-24). Picking-second mode swaps Compare for "Pick to
            compare" (this card becomes the candidate B) and disables
            Lock so the host can't accidentally bail out of the compare
            flow mid-pick. Vendor-A's own card has BOTH disabled with
            a "Selected" badge instead. Booked vendors (vendor confirmed
            elsewhere on the same wedding date) render a "Booked on your
            date" chip with no actions — see isBooked branch first. */}
        <div className="mt-auto flex items-stretch gap-2">
          {isBooked ? (
            <span className="flex w-full items-center justify-center rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/65 sm:text-sm">
              Booked on your date
            </span>
          ) : isVendorA ? (
            <span className="flex w-full items-center justify-center rounded-lg border border-terracotta/40 bg-cream px-3 py-2 text-xs font-medium text-terracotta sm:text-sm">
              Selected for compare
            </span>
          ) : compareMode === 'picking_second' ? (
            <button
              type="button"
              onClick={onPickAsSecond}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-mulberry px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream sm:text-sm"
            >
              <ArrowLeftRight
                aria-hidden
                className="h-3.5 w-3.5"
                strokeWidth={2}
              />
              Pick to compare
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartCompare}
                disabled={isPending}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-terracotta/40 bg-white px-3 py-2 text-xs font-semibold text-terracotta transition-colors hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                <ArrowLeftRight
                  aria-hidden
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                />
                Compare
              </button>
              <button
                type="button"
                onClick={onLock}
                disabled={isPending}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-mulberry px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                {isPending ? (
                  'Locking…'
                ) : (
                  <>
                    <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Lock
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Side-by-side comparison panel · replaces the grid when the host has
 * picked both A and B. Each side has its own [Lock this pick] +
 * [Compare with another]. "Compare with another" keeps that side as the
 * new A and the picker loops back to picking_second mode.
 *
 * Layout:
 *   - Mobile: stack vertically (A on top, B below, divider between)
 *   - Desktop: 2-col side-by-side
 * ──────────────────────────────────────────────────────────────────── */

function CompareSideBySide({
  vendorA,
  vendorB,
  canonicalServices,
  isPendingId,
  onLock,
  onKeepAndCompareAnother,
  onCancel,
}: {
  vendorA: WizardVendorRec;
  vendorB: WizardVendorRec;
  /** Canonical category set · drives the hybrid-anonymity placeholder
   *  taxonomy when either vendor's business_name is hidden (V2.1
   *  amendment #2 · 2026-05-30). */
  canonicalServices: ReadonlyArray<string>;
  isPendingId: string | null;
  onLock: (rec: WizardVendorRec) => void;
  onKeepAndCompareAnother: (keepSide: 'A' | 'B') => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Header strip · "Side-by-side" label + Cancel CTA. */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3">
        <span className="inline-flex items-center gap-2 text-sm text-ink/80">
          <ArrowLeftRight
            aria-hidden
            className="h-4 w-4 text-terracotta"
            strokeWidth={2}
          />
          <strong className="font-medium text-ink">Side-by-side compare</strong>
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta transition-colors hover:text-terracotta-700"
        >
          <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
          Back to all
        </button>
      </div>

      {/* Side-by-side cards · stacks on mobile, 2-col on sm+. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CompareSide
          rec={vendorA}
          canonicalServices={canonicalServices}
          isPending={isPendingId === vendorA.vendor_profile_id}
          onLock={() => onLock(vendorA)}
          onCompareAnother={() => onKeepAndCompareAnother('A')}
        />
        <CompareSide
          rec={vendorB}
          canonicalServices={canonicalServices}
          isPending={isPendingId === vendorB.vendor_profile_id}
          onLock={() => onLock(vendorB)}
          onCompareAnother={() => onKeepAndCompareAnother('B')}
        />
      </div>
    </div>
  );
}

function CompareSide({
  rec,
  canonicalServices,
  isPending,
  onLock,
  onCompareAnother,
}: {
  rec: WizardVendorRec;
  /** Canonical category set · drives the hybrid-anonymity placeholder
   *  taxonomy (V2.1 amendment #2 · 2026-05-30). */
  canonicalServices: ReadonlyArray<string>;
  isPending: boolean;
  onLock: () => void;
  onCompareAnother: () => void;
}) {
  const ratingDisplay =
    rec.avg_rating_overall && rec.avg_rating_overall > 0
      ? rec.avg_rating_overall.toFixed(1)
      : null;
  const reviewCount = rec.review_count ?? 0;
  const isCertified = rec.verification_state === 'verified';
  // V2.1 amendment #2 · hybrid-anonymity. Resolves to real
  // business_name once revealed (post first vendor reply) or to the
  // taxonomy + city placeholder while hidden.
  const displayLabel = vendorDisplayName(rec, canonicalServices);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
      <TilePhoto
        rec={rec}
        displayLabel={displayLabel}
        sizes="(min-width: 640px) 45vw, 100vw"
        initialSizeClass="text-6xl"
      >
        {isCertified ? (
          <span
            title="Documents reviewed and approved by Setnayan."
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cream shadow-sm backdrop-blur-sm"
          >
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 fill-current">
              <path d="M10.28 3.22a.75.75 0 010 1.06L5.06 9.5a.75.75 0 01-1.06 0L1.72 7.22a.75.75 0 011.06-1.06l1.75 1.75 4.69-4.69a.75.75 0 011.06 0z" />
            </svg>
            Setnayan Verified
          </span>
        ) : null}
      </TilePhoto>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h4 className="font-display text-lg italic leading-tight text-ink sm:text-xl">
          {displayLabel}
        </h4>

        {isCertified ? (
          <p className="text-[11px] leading-snug text-emerald-800/85">
            Documents reviewed by Setnayan.
          </p>
        ) : null}

        {rec.tagline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink/70">
            {rec.tagline}
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-1.5 pt-1 text-xs">
          {rec.location_city ? (
            <div className="flex items-center gap-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                City
              </dt>
              <dd className="inline-flex items-center gap-1 text-ink/80">
                <MapPin aria-hidden className="h-3 w-3" strokeWidth={2} />
                {rec.location_city}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
              Rating
            </dt>
            <dd className="inline-flex items-center gap-1 text-ink/80">
              {ratingDisplay ? (
                <>
                  <Star
                    aria-hidden
                    className="h-3 w-3 fill-current text-amber-500"
                    strokeWidth={1.5}
                  />
                  <strong className="font-medium text-ink">{ratingDisplay}</strong>
                  <span className="text-ink/55">
                    ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </>
              ) : (
                <span className="text-ink/45">No reviews yet</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onLock}
            disabled={isPending}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-mulberry px-3 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              'Locking…'
            ) : (
              <>
                <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Lock this pick
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCompareAnother}
            disabled={isPending}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-terracotta/40 bg-white px-3 py-2 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowLeftRight
              aria-hidden
              className="h-3.5 w-3.5"
              strokeWidth={2}
            />
            Compare with another
          </button>
        </div>
      </div>
    </article>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Inline custom vendor form · copy-equivalent to the one in
 * vendor-pick-card.tsx. Kept here (vs imported) so the grid primitive
 * is self-contained and easy to evolve independently.
 * ──────────────────────────────────────────────────────────────────── */

function CustomVendorForm({
  eventId,
  taskId,
  onCancel,
  onError,
}: {
  eventId: string;
  taskId: WizardTaskId;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [vendorName, setVendorName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  // Same belt-and-suspenders pattern as the marketplace-lock handler
  // (see handleLockMarketplace comment up top) — `router.refresh()` after
  // a successful custom-vendor lock guarantees the dashboard page
  // re-fetches even if revalidatePath in the action lagged. Without this,
  // the host who adds a custom vendor sees the form spinning instead of
  // the wizard advancing to the next card.
  const router = useRouter();

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (vendorName.trim().length === 0) {
      onError('Vendor name is required.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    formData.set('vendor_name', vendorName);
    if (contactPhone.trim()) formData.set('contact_phone', contactPhone);
    if (contactEmail.trim()) formData.set('contact_email', contactEmail);

    startTransition(async () => {
      try {
        await completeVendorPickFromCustom(formData);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your vendor. Try again.";
        onError(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-cream/60 p-4">
      <div>
        <label
          htmlFor="grid-custom-vendor-name"
          className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Vendor name <span className="text-rose-700">*</span>
        </label>
        <input
          id="grid-custom-vendor-name"
          type="text"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          required
          maxLength={128}
          placeholder="e.g. Casa Manila Garden Pavilion"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="grid-custom-vendor-phone"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Phone (optional)
          </label>
          <input
            id="grid-custom-vendor-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0917…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div>
          <label
            htmlFor="grid-custom-vendor-email"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Email (optional)
          </label>
          <input
            id="grid-custom-vendor-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {isPending ? 'Locking…' : 'Lock this vendor'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-sm text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
