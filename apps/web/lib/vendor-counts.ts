import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

import {
  TAXONOMY_MAP,
  TILE_PARENT,
  FILIPINIANA_BARONG_CANONICALS,
  type WeddingFolder,
  type WeddingTile,
} from './taxonomy';
import { getTaxonomy, type TaxonomySnapshot } from './taxonomy-db';
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
 * The marketplace catalog renders all tiles regardless of whether any vendor
 * has stocked the category yet; this drives the per-tile "3 verified" vs
 * "Recruiting" copy. Returns an empty Map when zero vendors are eligible.
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
    // Soft-fail to an empty map so the catalog still renders every tile
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
 * Top vendor preview row used by FolderVendorsSection (inline real-vendor
 * cards in catalog mode) and the per-tile preview strips. Mirrors the
 * columns vendor_market_stats already exposes — no new query shape needed
 * beyond the FROM clause.
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
  // 2026-05-30 vendor hybrid-anonymity (CLAUDE.md amendment #2). The
  // `vendor_market_stats` view does NOT expose these — they're filled by a
  // secondary batched read against `vendor_profiles` inside
  // `topVendorsByServices`. Drives `resolveVendorDisplayName` in
  // FolderVendorsSection so Free + Verified vendors who haven't replied yet
  // render their stored screen_name ("Manila Wedding Photographer #4218");
  // paid + revealed + venue-exempt vendors render real business_name.
  screen_name: string | null;
  name_revealed_at: string | null;
};

/**
 * canonical_services for a PARENT (folder), excluding marketplaceHidden
 * canonicals (officiants / paperwork never get a vendor query). Honors
 * `secondary_tiles` cross-listing at the parent granularity — a canonical
 * whose secondary tile lives under a different parent surfaces there too
 * (PH reality: hotels/accommodation bundle catering, so they appear under
 * the Feast parent as well as Venue). Cached at module load.
 */
const CANONICAL_SERVICES_BY_FOLDER: Map<WeddingFolder, string[]> = (() => {
  const map = new Map<WeddingFolder, string[]>();
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    if (meta.marketplaceHidden) continue;
    const primaryArr = map.get(meta.folder) ?? [];
    primaryArr.push(canonical);
    map.set(meta.folder, primaryArr);
    if (meta.secondary_tiles) {
      for (const secondaryTile of meta.secondary_tiles) {
        const secondaryFolder = TILE_PARENT[secondaryTile];
        if (secondaryFolder === meta.folder) continue;
        const arr = map.get(secondaryFolder) ?? [];
        if (!arr.includes(canonical)) arr.push(canonical);
        map.set(secondaryFolder, arr);
      }
    }
  }
  return map;
})();

/**
 * canonical_services for a TILE, excluding marketplaceHidden canonicals.
 * Honors `secondary_tiles` cross-listing and the Filipiniana & Barongs
 * cross-view (the same terno/barong vendors as the four attire tiles,
 * surfaced via the tradition facet — categorized once, two discovery paths).
 * Cached at module load. Exported because the marketplace queries + counts
 * are tile-scoped in the 10-parent model.
 */
export const CANONICAL_SERVICES_BY_TILE: Map<WeddingTile, string[]> = (() => {
  const map = new Map<WeddingTile, string[]>();
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    if (meta.marketplaceHidden || !meta.tile) continue;
    const primaryArr = map.get(meta.tile) ?? [];
    primaryArr.push(canonical);
    map.set(meta.tile, primaryArr);
    if (meta.secondary_tiles) {
      for (const secondaryTile of meta.secondary_tiles) {
        if (secondaryTile === meta.tile) continue;
        const arr = map.get(secondaryTile) ?? [];
        if (!arr.includes(canonical)) arr.push(canonical);
        map.set(secondaryTile, arr);
      }
    }
  }
  // Filipiniana & Barongs cross-view (explicit list; same vendors as the
  // attire tiles). The canonicals keep their primary attire tile too.
  map.set('filipiniana_barongs', [...FILIPINIANA_BARONG_CANONICALS]);
  return map;
})();

// ── DB-backed buckets (Phase 2b) ──────────────────────────────────────────
// Same derivation as the two module-level IIFEs above, but from the live
// taxonomy snapshot (service_categories + canonical_service_taxonomy), so a
// vendor an admin re-maps to a different tile re-buckets WITHOUT a deploy. The
// IIFE constants above remain the synchronous fallback for the not-yet-flipped
// sync consumers (dashboard / actions / onboarding).
function deriveBuckets(tax: TaxonomySnapshot): {
  byFolder: Map<WeddingFolder, string[]>;
  byTile: Map<WeddingTile, string[]>;
} {
  const byFolder = new Map<WeddingFolder, string[]>();
  const byTile = new Map<WeddingTile, string[]>();
  for (const [canonical, meta] of Object.entries(tax.map)) {
    if (meta.marketplaceHidden) continue;
    const fArr = byFolder.get(meta.folder) ?? [];
    fArr.push(canonical);
    byFolder.set(meta.folder, fArr);
    if (meta.tile) {
      const tArr = byTile.get(meta.tile) ?? [];
      tArr.push(canonical);
      byTile.set(meta.tile, tArr);
    }
    if (meta.secondary_tiles) {
      for (const secondaryTile of meta.secondary_tiles) {
        if (secondaryTile !== meta.tile) {
          const arr = byTile.get(secondaryTile) ?? [];
          if (!arr.includes(canonical)) arr.push(canonical);
          byTile.set(secondaryTile, arr);
        }
        const secondaryFolder = tax.tileParent[secondaryTile];
        if (secondaryFolder && secondaryFolder !== meta.folder) {
          const arr = byFolder.get(secondaryFolder) ?? [];
          if (!arr.includes(canonical)) arr.push(canonical);
          byFolder.set(secondaryFolder, arr);
        }
      }
    }
  }
  // Filipiniana & Barongs cross-view (explicit list; same vendors as the attire tiles).
  byTile.set('filipiniana_barongs' as WeddingTile, [...FILIPINIANA_BARONG_CANONICALS]);
  return { byFolder, byTile };
}

/** Live canonical→folder / canonical→tile buckets from the DB snapshot (fallback-safe). Cached per request. */
export const getCanonicalBuckets = cache(async () => deriveBuckets(await getTaxonomy()));

/** All marketplace-visible canonicals for a parent (read-only accessor). */
export function canonicalServicesForFolder(folder: WeddingFolder): string[] {
  return CANONICAL_SERVICES_BY_FOLDER.get(folder) ?? [];
}

/** All marketplace-visible canonicals for a tile (read-only accessor). */
export function canonicalServicesForTile(tile: WeddingTile): string[] {
  return CANONICAL_SERVICES_BY_TILE.get(tile) ?? [];
}

/**
 * Roll a per-canonical count map (fetchVendorCountsByService) up to per-tile
 * totals. A vendor that lists multiple canonicals inside the same tile is
 * counted once per tile via a vendor-set would be ideal, but since we only
 * have aggregate per-canonical counts here we sum the canonicals — the
 * catalog copy ("N vendors") is a soft signal, not an exact distinct count.
 * For the Filipiniana cross-view the same vendors appear under their attire
 * tiles too; that double-surfacing is intentional (two discovery paths).
 */
export function rollUpCountsToTile(
  perCanonical: Map<string, VendorCount>,
): Map<WeddingTile, VendorCount> {
  const out = new Map<WeddingTile, VendorCount>();
  for (const [tile, canonicals] of CANONICAL_SERVICES_BY_TILE.entries()) {
    let verified = 0;
    let coming_soon = 0;
    for (const c of canonicals) {
      const v = perCanonical.get(c);
      if (!v) continue;
      verified += v.verified;
      coming_soon += v.coming_soon;
    }
    out.set(tile, { verified, coming_soon, total: verified + coming_soon });
  }
  return out;
}

/**
 * Shared query: top N vendor_market_stats rows whose `services[]` overlap a
 * canonical set. Sort chain mirrors the vendor-grid default (ad_rank →
 * review_count → rating → recency) so previews read consistently with the
 * full grid. Returns [] on any query error so the catalog stays clean.
 */
async function topVendorsByServices(
  admin: SupabaseClient,
  services: string[],
  opts: {
    limit: number;
    excludeVendorIds?: ReadonlyArray<string>;
    visibilities: ReadonlyArray<VendorPublicVisibility>;
  },
): Promise<VendorPreviewRow[]> {
  if (services.length === 0) return [];

  let query = admin
    .from('vendor_market_stats')
    .select(
      'vendor_profile_id,business_name,business_slug,logo_url,tagline,services,location_city,hq_latitude,hq_longitude,public_visibility,avg_rating_overall,review_count,ad_rank',
    )
    .in('public_visibility', opts.visibilities as readonly string[])
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .overlaps('services', services);

  if (opts.excludeVendorIds && opts.excludeVendorIds.length > 0) {
    // PostgREST NOT IN with parenthesised comma list — same shape the
    // vendor-grid query uses for demo exclusion. Cast via `unknown` to a
    // narrowed shape to dodge the TS recursion ceiling on chained PostgREST
    // query types.
    type NotShape = {
      not: (column: string, op: string, value: string) => typeof query;
    };
    query = (query as unknown as NotShape).not(
      'vendor_profile_id',
      'in',
      `(${opts.excludeVendorIds.join(',')})`,
    );
  }

  query = query
    .order('ad_rank', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .order('avg_rating_overall', { ascending: false, nullsFirst: false })
    .limit(opts.limit);

  const { data, error } = await query;
  if (error || !data) return [];

  const baseRows = data as Omit<
    VendorPreviewRow,
    'screen_name' | 'name_revealed_at'
  >[];

  // Secondary batched read against `vendor_profiles` for the two
  // anonymity-surface fields `vendor_market_stats` doesn't expose (one
  // extra IN-lookup keeps round-trips bounded at 2, not N+1). Fail-soft:
  // on lookup error every row keeps a NULL anonymity pair — the resolver
  // degrades to the legacy "service · city" placeholder for hidden vendors
  // and to business_name for paid + revealed + venue-exempt vendors.
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
 * Top N vendors for a PARENT's canonical_services. Drives the per-parent
 * "Top X vendors right now" preview strip in catalog mode.
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
  const { byFolder } = await getCanonicalBuckets();
  return topVendorsByServices(admin, byFolder.get(args.folder) ?? [], {
    limit: args.limit ?? 9,
    excludeVendorIds: args.excludeVendorIds,
    visibilities: args.visibilities ?? ['verified', 'coming_soon'],
  });
}

/**
 * Top N vendors for a TILE's canonical_services. Drives the per-tile inline
 * vendor preview + the tile-scoped vendor grid (`?tile=`).
 */
export async function findTopVendorsByTile(
  admin: SupabaseClient,
  args: {
    tile: WeddingTile;
    limit?: number;
    excludeVendorIds?: ReadonlyArray<string>;
    visibilities?: ReadonlyArray<VendorPublicVisibility>;
  },
): Promise<VendorPreviewRow[]> {
  const { byTile } = await getCanonicalBuckets();
  return topVendorsByServices(admin, byTile.get(args.tile) ?? [], {
    limit: args.limit ?? 9,
    excludeVendorIds: args.excludeVendorIds,
    visibilities: args.visibilities ?? ['verified', 'coming_soon'],
  });
}

/**
 * Top-N vendor names per canonical_service, used by the CategoryTile
 * "Sample: A · B · C" preview line. Single round-trip for the full visible
 * service set so the catalog page stays at one query for previews.
 *
 * Returns a Map keyed on canonical_service → array of business_names.
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
