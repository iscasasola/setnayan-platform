import type { SupabaseClient } from '@supabase/supabase-js';

import { TAXONOMY_MAP, type WeddingFolder } from './taxonomy';
import type { VendorPublicVisibility } from './vendor-visibility';

/**
 * Per-canonical_service vendor count, broken down by publishing state.
 * `total` is the sum of `verified` and `coming_soon` rows that pass the
 * marketplace publishing gate (non-empty business_name).
 */
export type VendorCount = {
  verified: number;
  coming_soon: number;
  total: number;
};

/**
 * Catalog-mode aggregate: for every canonical_service that has at least one
 * eligible vendor, how many vendors list it in their `services[]` array.
 *
 * The marketplace catalog renders 192 tiles regardless of whether any vendor
 * has stocked the category yet; this helper drives the per-tile "3 verified"
 * vs "Recruiting" copy. Returns an empty Map when zero vendors are eligible.
 *
 * One query, aggregated in process — `services[]` is denormalized so a single
 * vendor row contributes to multiple buckets. RLS-bypassed admin client is
 * required because the public marketplace is anonymous-read.
 */
export async function fetchVendorCountsByService(
  admin: SupabaseClient,
): Promise<Map<string, VendorCount>> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('services,public_visibility')
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '');

  if (error) {
    // Soft-fail to an empty map so the catalog still renders 192 tiles
    // labeled "Recruiting" — better UX than a 500 on the marketplace.
    return new Map();
  }

  const counts = new Map<string, VendorCount>();
  for (const row of (data ?? []) as Array<{
    services: string[] | null;
    public_visibility: VendorPublicVisibility;
  }>) {
    const services = row.services ?? [];
    for (const service of services) {
      const existing = counts.get(service) ?? { verified: 0, coming_soon: 0, total: 0 };
      if (row.public_visibility === 'verified') existing.verified += 1;
      else if (row.public_visibility === 'coming_soon') existing.coming_soon += 1;
      existing.total = existing.verified + existing.coming_soon;
      counts.set(service, existing);
    }
  }
  return counts;
}

/**
 * Top vendor preview row used by both:
 *   • FolderVendorsSection (inline real-vendor cards in catalog mode)
 *   • CategoryTile (subtle "Vendor A · Vendor B · …" preview strip below
 *     populated tiles — closes the gap surfaced 2026-05-22 where category
 *     tiles only showed an "X listed" count without naming any of the X).
 *
 * Mirrors the columns vendor_market_stats already exposes — no new query
 * shape needed beyond the FROM clause.
 */
export type VendorPreviewRow = {
  vendor_profile_id: string;
  business_name: string;
  business_slug: string | null;
  logo_url: string | null;
  tagline: string | null;
  services: string[];
  location_city: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  public_visibility: VendorPublicVisibility;
  avg_rating_overall: number | null;
  review_count: number;
  ad_rank: number | null;
  /**
   * Anonymity surface fields per CLAUDE.md 2026-05-30 refinement row
   * "V2.1 BRIEF AMENDMENT #2 LOCKED · vendor matrix · venue exception
   * locked". Filled by a secondary batched read against `vendor_profiles`
   * inside `findTopVendorsByFolder` — `vendor_market_stats` view doesn't
   * surface these columns. Drives `resolveVendorDisplayName` resolution
   * in FolderVendorsSection so Free + Verified vendors who haven't yet
   * replied to any couple render their stored screen_name (Bark format
   * "Manila Wedding Photographer #4218"); paid + revealed + venue-exempt
   * vendors render real business_name.
   *
   * `name_revealed_at` NULL = name hidden globally (Free + Verified pre-
   * first-reply). Non-NULL = name revealed globally per the
   * `reveal_vendor_name_on_chat` BEFORE INSERT trigger on chat_messages
   * (migration 20260530010000 from PR #662).
   *
   * `screen_name` NULL = pre-backfill vendor OR venue-exempt vendor where
   * the generator deliberately skipped (services overlap with
   * religious_venue + venue). Resolver falls back to the legacy computed
   * "service · city" placeholder when present and stays canonical
   * business_name for venues.
   */
  screen_name: string | null;
  name_revealed_at: string | null;
};

/**
 * Compute the inverse of TAXONOMY_MAP — folder → canonical_services list.
 * Cached at module load (192 entries × ~50 bytes = negligible). Used by
 * `findTopVendorsByFolder` to translate a folder request into a `.overlaps()`
 * predicate against the vendor's `services[]` array.
 *
 * 2026-05-22 cross-listing — honors `secondary_folders` on TaxonomyEntry
 * so a service registered under a primary folder ALSO surfaces under any
 * declared secondary folders. PH wedding reality: hotels (accommodation,
 * primary planning_logistics_travel) bundle catering, so they appear in
 * the catering folder's FolderVendorsSection inline vendor preview AND
 * the catering folder's vendor-grid query when a host scopes catalog
 * mode via `?folder=catering`. Owner directive: "most hotels also provide
 * catering." Map values stay deduplicated implicitly because a service
 * appears once per (primary OR secondary) folder.
 */
const CANONICAL_SERVICES_BY_FOLDER: Map<WeddingFolder, string[]> = (() => {
  const map = new Map<WeddingFolder, string[]>();
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    // Primary folder placement (unchanged 2026-05-20 behavior).
    const primaryArr = map.get(meta.folder) ?? [];
    primaryArr.push(canonical);
    map.set(meta.folder, primaryArr);
    // Secondary folder cross-listing (new 2026-05-22). Empty/undefined
    // secondary_folders is the common case — no behavior change for the
    // 191 services that don't declare cross-listing.
    if (meta.secondary_folders) {
      for (const secondary of meta.secondary_folders) {
        // Defensive: never duplicate-add to the same folder if a misconfigured
        // entry lists its own primary folder in secondary_folders.
        if (secondary === meta.folder) continue;
        const secondaryArr = map.get(secondary) ?? [];
        secondaryArr.push(canonical);
        map.set(secondary, secondaryArr);
      }
    }
  }
  return map;
})();

/**
 * Top N vendor_market_stats rows for a folder's canonical_services. Used to
 * surface real vendor cards inline in catalog mode for every folder that
 * has at least one signed-up vendor — closes the gap surfaced 2026-05-22
 * where 10 of the 12 folders showed only count-pill tiles without naming
 * any of the underlying vendors.
 *
 * Sort chain mirrors the vendor-grid sort (ad_rank → review_count → rating)
 * so the "Featured vendors" preview reads the same shape couples will see
 * when they click into the full folder grid. Excludes demo vendors unless
 * the caller passes `includeDemoIds`. Excludes coming_soon vendors with
 * empty business_name (same publishing gate as the main vendor list).
 *
 * Returns [] on any query error so the catalog stays clean rather than
 * partially-broken — the section render guards on empty array.
 */
export async function findTopVendorsByFolder(
  admin: SupabaseClient,
  args: {
    folder: WeddingFolder;
    /** Cap on rows returned. Default 9 — fits 3 columns × 3 rows on desktop. */
    limit?: number;
    /** When provided, EXCLUDES these vendor_profile_ids (demo-mode off). */
    excludeVendorIds?: ReadonlyArray<string>;
    /** When provided, RESTRICTS to these visibilities. Default both. */
    visibilities?: ReadonlyArray<VendorPublicVisibility>;
  },
): Promise<VendorPreviewRow[]> {
  const limit = args.limit ?? 9;
  const visibilities = args.visibilities ?? ['verified', 'coming_soon'];
  const folderServices = CANONICAL_SERVICES_BY_FOLDER.get(args.folder) ?? [];
  if (folderServices.length === 0) return [];

  let query = admin
    .from('vendor_market_stats')
    .select(
      'vendor_profile_id,business_name,business_slug,logo_url,tagline,services,location_city,hq_latitude,hq_longitude,public_visibility,avg_rating_overall,review_count,ad_rank',
    )
    .in('public_visibility', visibilities as readonly string[])
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .overlaps('services', folderServices);

  if (args.excludeVendorIds && args.excludeVendorIds.length > 0) {
    // PostgREST NOT IN with parenthesised comma list — same shape the
    // vendor-grid query uses for demo exclusion at vendors/page.tsx:740.
    // Cast via `unknown` to a narrowed shape to dodge the TS recursion
    // ceiling on chained PostgREST query types (mirrors the broadened-
    // count pattern at vendors/page.tsx:928-937).
    type NotShape = {
      not: (column: string, op: string, value: string) => typeof query;
    };
    query = (query as unknown as NotShape).not(
      'vendor_profile_id',
      'in',
      `(${args.excludeVendorIds.join(',')})`,
    );
  }

  // Sort: ad_rank first (Boosted Ads + Sponsored Boost float to top), then
  // review_count (social proof), then rating, then most-recent. Mirrors the
  // vendor-grid default sort so the inline preview reads consistently.
  query = query
    .order('ad_rank', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .order('avg_rating_overall', { ascending: false, nullsFirst: false })
    .limit(limit);

  const { data, error } = await query;
  if (error || !data) return [];

  const baseRows = data as Omit<VendorPreviewRow, 'screen_name' | 'name_revealed_at'>[];

  // Secondary batched read against `vendor_profiles` for the two
  // anonymity-surface fields `vendor_market_stats` doesn't expose.
  // Mirrors the same pattern in `wizard-recommendations.ts` (PR #677) +
  // `apps/web/app/vendors/page.tsx` enrichment loop — one extra IN-lookup
  // keyed on the page-size'd vendor_profile_id list keeps round-trip
  // count bounded at 2 instead of N+1. Fail-soft: on lookup error every
  // row keeps a NULL anonymity pair · resolver gracefully degrades to
  // the legacy "service · city" placeholder for hidden vendors and to
  // business_name for paid + revealed + venue-exempt vendors.
  const vendorIds = baseRows.map((r) => r.vendor_profile_id);
  if (vendorIds.length === 0) return [];

  const { data: anonymityRows, error: anonymityErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, screen_name, name_revealed_at')
    .in('vendor_profile_id', vendorIds);

  const anonymityByVendor = new Map<
    string,
    { screen_name: string | null; name_revealed_at: string | null }
  >();
  if (!anonymityErr && anonymityRows) {
    for (const row of anonymityRows as Array<{
      vendor_profile_id: string;
      screen_name?: string | null;
      name_revealed_at?: string | null;
    }>) {
      anonymityByVendor.set(row.vendor_profile_id, {
        screen_name: row.screen_name ?? null,
        name_revealed_at: row.name_revealed_at ?? null,
      });
    }
  }

  return baseRows.map((row) => {
    const meta = anonymityByVendor.get(row.vendor_profile_id);
    return {
      ...row,
      screen_name: meta?.screen_name ?? null,
      name_revealed_at: meta?.name_revealed_at ?? null,
    } as VendorPreviewRow;
  });
}

/**
 * Top-3 vendor names per canonical_service, used by the CategoryTile
 * "Sample: A · B · C" preview line surfaced 2026-05-22. Single round-trip
 * for the full visible service set so the catalog page stays at one query
 * for previews regardless of how many services render.
 *
 * Returns a Map keyed on canonical_service → array of business_names
 * (deduplicated, ordered same as findTopVendorsByFolder).
 */
export async function fetchTopVendorNamesByService(
  admin: SupabaseClient,
  args: {
    services: ReadonlyArray<string>;
    /** Cap per service. Default 3 — fits one inline line of preview text. */
    perServiceLimit?: number;
    excludeVendorIds?: ReadonlyArray<string>;
  },
): Promise<Map<string, string[]>> {
  const perServiceLimit = args.perServiceLimit ?? 3;
  if (args.services.length === 0) return new Map();

  let query = admin
    .from('vendor_market_stats')
    .select(
      'business_name,services,ad_rank,review_count,avg_rating_overall,vendor_profile_id',
    )
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .overlaps('services', args.services as readonly string[]);

  if (args.excludeVendorIds && args.excludeVendorIds.length > 0) {
    type NotShape = {
      not: (column: string, op: string, value: string) => typeof query;
    };
    query = (query as unknown as NotShape).not(
      'vendor_profile_id',
      'in',
      `(${args.excludeVendorIds.join(',')})`,
    );
  }

  query = query
    .order('ad_rank', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .order('avg_rating_overall', { ascending: false, nullsFirst: false });

  const { data, error } = await query;
  if (error || !data) return new Map();

  const requested = new Set(args.services);
  const byService = new Map<string, string[]>();
  for (const row of data as Array<{
    business_name: string;
    services: string[] | null;
  }>) {
    const vendorServices = row.services ?? [];
    for (const service of vendorServices) {
      if (!requested.has(service)) continue;
      const arr = byService.get(service) ?? [];
      if (arr.length >= perServiceLimit) continue;
      if (arr.includes(row.business_name)) continue;
      arr.push(row.business_name);
      byService.set(service, arr);
    }
  }
  return byService;
}
