/**
 * region-source — the SINGLE canonical resolver for the Philippines region
 * taxonomy. Every region consumer in the app should read through this module
 * instead of hand-maintaining its own spelling table.
 *
 * WHY THIS EXISTS (owner-approved 2026-06-19, REGIONS canonical-source QA fix)
 * ---------------------------------------------------------------------------
 * Four incompatible region vocabularies had drifted across the app, so the
 * same wedding could be spelled four different ways and the lookups silently
 * disagreed:
 *   V1 onboarding hyphen slugs   (events.region · onboarding-shell / actions)  'c-visayas','n-mindanao','cagayan','abroad'
 *   V2 match-criteria underscore (lib/match-criteria.ts REGION_OPTIONS)        'central_visayas','northern_mindanao','outside_ph'
 *   V3 PSGC codes                (vendor_profiles.hq_region · lib/regions.ts)  'VII','X','NCR','BARMM'
 *   V4 wedding-cities rk         (_data/wedding-cities.ts)                     'cagayan-valley'
 *   + burn bands hand-maintained over three of those in lib/v2/region-token-burn.ts.
 *
 * The canonical key is the V1 onboarding hyphen slug (it's what actually lands
 * in events.region). `resolveRegion()` accepts ANY of the four vocabularies —
 * the canonical slug, the underscore variant, the PSGC code, 'cagayan-valley',
 * 'outside_ph', etc. — and returns the one canonical row.
 *
 * CANONICAL SOURCE = public.regions (added by 20270128395443_regions_canonical_source).
 * FALLBACK = the STATIC table below, derived from the same seed the migration
 * uses (which was itself lifted from lib/regions.ts PH_REGIONS, match-criteria
 * REGION_OPTIONS, region-token-burn BURN_BAND_REGIONS, and wedding-cities
 * REGION_CENTROID). The resolver is therefore ALWAYS usable, even when the DB
 * table is absent or empty — it behaves identically to the pre-fix consts.
 *
 * SYNCHRONOUS BY DESIGN. Existing consumers resolve regions inside sync
 * `.filter()`/`.map()` callbacks and inside client-component render, so the
 * resolution API (`resolveRegion`, `regionLabel`, …) is synchronous and reads
 * an in-memory cache. The cache starts as the static table; a server caller can
 * refresh it from public.regions via `hydrateRegionsFromRows()`, fallback-safe
 * (any error / empty / malformed input leaves the static table in place — never
 * throws, never empties the cache). Pure resolution; no writes.
 *
 * NOT `server-only`, and references NO server module: match-criteria.ts derives
 * REGION_OPTIONS from `allRegions()` and is bundled into client components
 * (details-form, summary-ai-toggle), so the synchronous resolver + static table
 * must be client-safe. DB hydration is dependency-injected: the server caller
 * fetches the rows and passes them to `hydrateRegionsFromRows()`, so this module
 * never imports `@/lib/supabase/server` / `next/headers`.
 */

export type CanonicalRegion = {
  /** Canonical slug = the V1 onboarding hyphen slug ('c-visayas'). */
  slug: string;
  /** PSGC code ('VII'); null for the non-scopable 'abroad' row. */
  psgc_code: string | null;
  /** Short friendly label ('Central Visayas'). */
  display_label: string;
  /** Long picker descriptor ('VII · Central Visayas (Cebu, Bohol, …)'). */
  descriptor: string | null;
  /** Every other spelling that resolves here (lower-cased): underscore variant,
   *  'cagayan-valley', the PSGC code itself, 'outside_ph', etc. */
  aliases: string[];
  /** Inquiry-burn band 1/2/3 (= ₱100/₱200/₱300). */
  burn_band: 1 | 2 | 3;
  /** Fallback centroid coords (null for 'abroad'). */
  centroid_lat: number | null;
  centroid_lon: number | null;
  /** Display order: NCR first, PSGC numeric, BARMM+NIR last, abroad last. */
  sort_order: number;
  /** FALSE for 'abroad' (no region scope / show full pool). */
  is_scopable: boolean;
};

/**
 * STATIC fallback table — one row per region, mirroring the migration's seed
 * VALUES verbatim (canonical slug · psgc · label · descriptor · aliases · band
 * · lat · lon · sort · scopable). This is the source of truth until/unless the
 * DB hydrates over it, and the guarantee that the resolver never breaks when
 * public.regions is absent or empty.
 *
 * `aliases` are stored lower-cased; `resolveRegion()` also matches on the
 * canonical slug and the lower-cased PSGC code, so the array only needs the
 * spellings NOT already covered by those two.
 */
const STATIC_REGIONS: readonly CanonicalRegion[] = [
  { slug: 'ncr', psgc_code: 'NCR', display_label: 'Metro Manila', descriptor: 'NCR · Metro Manila', aliases: ['ncr'], burn_band: 3, centroid_lat: 14.58, centroid_lon: 121.0, sort_order: 1, is_scopable: true },
  { slug: 'car', psgc_code: 'CAR', display_label: 'Cordillera (CAR)', descriptor: 'CAR · Cordillera (Baguio, La Trinidad, Sagada, Banaue)', aliases: ['car'], burn_band: 2, centroid_lat: 16.9, centroid_lon: 120.9, sort_order: 2, is_scopable: true },
  { slug: 'ilocos', psgc_code: 'I', display_label: 'Ilocos Region', descriptor: 'I · Ilocos Region (Vigan, Laoag, Dagupan)', aliases: ['i', 'ilocos'], burn_band: 2, centroid_lat: 17.4, centroid_lon: 120.5, sort_order: 3, is_scopable: true },
  { slug: 'cagayan', psgc_code: 'II', display_label: 'Cagayan Valley', descriptor: 'II · Cagayan Valley (Tuguegarao, Santiago)', aliases: ['ii', 'cagayan_valley', 'cagayan-valley'], burn_band: 2, centroid_lat: 17.3, centroid_lon: 121.8, sort_order: 4, is_scopable: true },
  { slug: 'c-luzon', psgc_code: 'III', display_label: 'Central Luzon', descriptor: 'III · Central Luzon (Pampanga, Bulacan, Tarlac, Subic)', aliases: ['iii', 'central_luzon'], burn_band: 3, centroid_lat: 15.3, centroid_lon: 120.6, sort_order: 5, is_scopable: true },
  { slug: 'calabarzon', psgc_code: 'IV-A', display_label: 'CALABARZON', descriptor: 'IV-A · CALABARZON (Tagaytay, Cavite, Laguna, Batangas, Rizal, Quezon)', aliases: ['iv-a', 'calabarzon'], burn_band: 3, centroid_lat: 14.2, centroid_lon: 121.3, sort_order: 6, is_scopable: true },
  { slug: 'mimaropa', psgc_code: 'IV-B', display_label: 'MIMAROPA', descriptor: 'IV-B · MIMAROPA (Palawan, Coron, El Nido, Mindoro)', aliases: ['iv-b', 'mimaropa'], burn_band: 2, centroid_lat: 12.0, centroid_lon: 120.8, sort_order: 7, is_scopable: true },
  { slug: 'bicol', psgc_code: 'V', display_label: 'Bicol Region', descriptor: 'V · Bicol (Legazpi, Naga, Sorsogon)', aliases: ['v', 'bicol'], burn_band: 1, centroid_lat: 13.4, centroid_lon: 123.4, sort_order: 8, is_scopable: true },
  { slug: 'w-visayas', psgc_code: 'VI', display_label: 'Western Visayas', descriptor: 'VI · Western Visayas (Iloilo, Bacolod, Boracay, Aklan)', aliases: ['vi', 'western_visayas'], burn_band: 2, centroid_lat: 10.9, centroid_lon: 122.6, sort_order: 9, is_scopable: true },
  { slug: 'c-visayas', psgc_code: 'VII', display_label: 'Central Visayas', descriptor: 'VII · Central Visayas (Cebu, Bohol, Panglao, Dumaguete)', aliases: ['vii', 'central_visayas'], burn_band: 2, centroid_lat: 10.0, centroid_lon: 123.6, sort_order: 10, is_scopable: true },
  { slug: 'e-visayas', psgc_code: 'VIII', display_label: 'Eastern Visayas', descriptor: 'VIII · Eastern Visayas (Tacloban, Ormoc)', aliases: ['viii', 'eastern_visayas'], burn_band: 1, centroid_lat: 11.4, centroid_lon: 124.9, sort_order: 11, is_scopable: true },
  { slug: 'zamboanga', psgc_code: 'IX', display_label: 'Zamboanga Peninsula', descriptor: 'IX · Zamboanga Peninsula (Zamboanga, Dipolog)', aliases: ['ix', 'zamboanga'], burn_band: 1, centroid_lat: 7.8, centroid_lon: 122.5, sort_order: 12, is_scopable: true },
  { slug: 'n-mindanao', psgc_code: 'X', display_label: 'Northern Mindanao', descriptor: 'X · Northern Mindanao (Cagayan de Oro, Iligan, Malaybalay)', aliases: ['x', 'northern_mindanao'], burn_band: 2, centroid_lat: 8.3, centroid_lon: 124.7, sort_order: 13, is_scopable: true },
  { slug: 'davao', psgc_code: 'XI', display_label: 'Davao Region', descriptor: 'XI · Davao Region (Davao City, Tagum, Digos)', aliases: ['xi', 'davao'], burn_band: 2, centroid_lat: 7.1, centroid_lon: 125.6, sort_order: 14, is_scopable: true },
  { slug: 'soccsksargen', psgc_code: 'XII', display_label: 'SOCCSKSARGEN', descriptor: 'XII · SOCCSKSARGEN (General Santos, Koronadal, Cotabato City)', aliases: ['xii', 'soccsksargen'], burn_band: 1, centroid_lat: 6.3, centroid_lon: 124.8, sort_order: 15, is_scopable: true },
  { slug: 'caraga', psgc_code: 'XIII', display_label: 'Caraga', descriptor: 'XIII · Caraga (Butuan, Surigao)', aliases: ['xiii', 'caraga'], burn_band: 1, centroid_lat: 9.2, centroid_lon: 125.8, sort_order: 16, is_scopable: true },
  { slug: 'barmm', psgc_code: 'BARMM', display_label: 'Bangsamoro (BARMM)', descriptor: 'BARMM · Bangsamoro (Marawi, Cotabato, Sulu, Tawi-Tawi)', aliases: ['barmm'], burn_band: 1, centroid_lat: 6.5, centroid_lon: 122.0, sort_order: 17, is_scopable: true },
  { slug: 'nir', psgc_code: 'NIR', display_label: 'Negros Island Region', descriptor: 'NIR · Negros Island Region (Bacolod, Dumaguete)', aliases: ['nir'], burn_band: 2, centroid_lat: 10.0, centroid_lon: 123.0, sort_order: 18, is_scopable: true },
  { slug: 'abroad', psgc_code: null, display_label: 'Outside the Philippines', descriptor: 'Outside the PH', aliases: ['abroad', 'outside_ph'], burn_band: 1, centroid_lat: null, centroid_lon: null, sort_order: 99, is_scopable: false },
] as const;

// ── in-memory cache ─────────────────────────────────────────────────────────
// Starts as the static table; hydrateRegionsFromDb() can refresh it. The
// derived lookup maps are rebuilt whenever the cache is swapped. Every read API
// is synchronous over these.
let _regions: readonly CanonicalRegion[] = STATIC_REGIONS;
let _bySlug = new Map<string, CanonicalRegion>();
let _byAlias = new Map<string, CanonicalRegion>();
let _byPsgc = new Map<string, CanonicalRegion>();

/** Rebuild the derived lookup maps from `_regions`. */
function rebuildIndexes(): void {
  const bySlug = new Map<string, CanonicalRegion>();
  const byAlias = new Map<string, CanonicalRegion>();
  const byPsgc = new Map<string, CanonicalRegion>();
  for (const r of _regions) {
    bySlug.set(r.slug.toLowerCase(), r);
    if (r.psgc_code) byPsgc.set(r.psgc_code.toLowerCase(), r);
    // alias index also carries the canonical slug + lower-cased PSGC so a single
    // map covers every spelling.
    byAlias.set(r.slug.toLowerCase(), r);
    if (r.psgc_code) byAlias.set(r.psgc_code.toLowerCase(), r);
    for (const a of r.aliases) byAlias.set(a.toLowerCase(), r);
  }
  _bySlug = bySlug;
  _byAlias = byAlias;
  _byPsgc = byPsgc;
}
rebuildIndexes();

/**
 * Resolve ANY of the four region vocabularies to its canonical row. Accepts the
 * canonical hyphen slug, the underscore variant, the PSGC code, 'cagayan-valley',
 * 'outside_ph', etc. Case- and whitespace-insensitive. Returns null for
 * null/empty/unknown input. NEVER throws.
 */
export function resolveRegion(spelling: string | null | undefined): CanonicalRegion | null {
  if (!spelling) return null;
  const key = spelling.trim().toLowerCase();
  if (key.length === 0) return null;
  return _byAlias.get(key) ?? null;
}

/** Canonical row by canonical slug (case-insensitive), or null. */
export function regionBySlug(slug: string | null | undefined): CanonicalRegion | null {
  if (!slug) return null;
  return _bySlug.get(slug.trim().toLowerCase()) ?? null;
}

/** Canonical row by PSGC code (case-insensitive), or null. */
export function regionByPsgc(psgc: string | null | undefined): CanonicalRegion | null {
  if (!psgc) return null;
  return _byPsgc.get(psgc.trim().toLowerCase()) ?? null;
}

/** All canonical regions, sorted by sort_order (NCR first, abroad last). */
export function allRegions(): readonly CanonicalRegion[] {
  return [..._regions].sort((a, b) => a.sort_order - b.sort_order);
}

/** Short display label for a region spelling ('Central Visayas'), or null. */
export function regionLabel(spelling: string | null | undefined): string | null {
  return resolveRegion(spelling)?.display_label ?? null;
}

/** Long picker descriptor for a region spelling, or null. */
export function regionDescriptor(spelling: string | null | undefined): string | null {
  return resolveRegion(spelling)?.descriptor ?? null;
}

/** Fallback centroid [lat, lon] for a region spelling, or null. */
export function regionCentroid(spelling: string | null | undefined): [number, number] | null {
  const r = resolveRegion(spelling);
  if (!r || r.centroid_lat === null || r.centroid_lon === null) return null;
  return [r.centroid_lat, r.centroid_lon];
}

/** Inquiry-burn band (1/2/3) for a region spelling. Unknown → 1 (kind floor). */
export function regionBurnBand(spelling: string | null | undefined): 1 | 2 | 3 {
  return resolveRegion(spelling)?.burn_band ?? 1;
}

// ── city → region (public.wedding_destinations.city_aliases) ─────────────────
// SYNCHRONOUS, fallback-safe. The wedding_destinations.city_aliases column is
// seeded EMPTY this cycle (the migration NOTEs a follow-up backfill), so this
// cache is EMPTY and `regionForCity()` (lib/regions.ts) falls through to its
// frozen CITY_TO_REGION Map — identical to today. A future PR can populate this
// from public.wedding_destinations (same dependency-injected pattern as
// hydrateRegionsFromRows) so the city → region lookup reads the DB first.
const _cityAliasToSlug = new Map<string, string>();

/**
 * Canonical region SLUG for a city spelling, from the (currently empty)
 * wedding_destinations city-alias cache. Returns null when the cache has no
 * entry — the caller (regionForCity) then falls back to its own Map. Sync,
 * never throws.
 */
export function regionSlugForCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  if (key.length === 0) return null;
  return _cityAliasToSlug.get(key) ?? null;
}

/**
 * Hydrate the cache from public.regions, fallback-safe. DEPENDENCY-INJECTED so
 * this module never references the server Supabase client (which pulls in
 * `next/headers`) — keeping region-source fully client-bundle-safe, since
 * match-criteria/onboarding-shell import the sync resolver into client
 * components.
 *
 * The server caller fetches the rows (e.g.
 * `(await createClient()).from('regions').select('…')`) and passes them in.
 * Any error / empty / all-malformed input leaves the static table in place —
 * never throws, never empties the cache. The 20270128395443 migration seeds the
 * table; until it's applied (or if a server context never calls this), the
 * static fallback is the live source and behavior is identical to the pre-fix
 * consts.
 *
 * Returns true if the DB rows replaced the static table, false if the fallback
 * was kept. No current caller invokes this (the static fallback is the live
 * path this cycle); it's the wiring point for a future server-side refresh.
 */
type RegionRowInput = {
  slug?: unknown;
  psgc_code?: unknown;
  display_label?: unknown;
  descriptor?: unknown;
  aliases?: unknown;
  burn_band?: unknown;
  centroid_lat?: unknown;
  centroid_lon?: unknown;
  sort_order?: unknown;
  is_scopable?: unknown;
};

export function hydrateRegionsFromRows(input: readonly RegionRowInput[] | null | undefined): boolean {
  if (!input || input.length === 0) return false; // fallback stays.
  const rows: CanonicalRegion[] = [];
  for (const row of input) {
    const slug = typeof row.slug === 'string' ? row.slug : null;
    const display_label = typeof row.display_label === 'string' ? row.display_label : null;
    if (!slug || !display_label) continue; // skip malformed rows defensively.
    const band = Number(row.burn_band);
    rows.push({
      slug,
      psgc_code: typeof row.psgc_code === 'string' ? row.psgc_code : null,
      display_label,
      descriptor: typeof row.descriptor === 'string' ? row.descriptor : null,
      aliases: Array.isArray(row.aliases)
        ? (row.aliases as unknown[]).filter((a): a is string => typeof a === 'string')
        : [],
      burn_band: band === 2 ? 2 : band === 3 ? 3 : 1,
      centroid_lat: typeof row.centroid_lat === 'number' ? row.centroid_lat : null,
      centroid_lon: typeof row.centroid_lon === 'number' ? row.centroid_lon : null,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : 999,
      is_scopable: row.is_scopable !== false,
    });
  }
  if (rows.length === 0) return false; // every row malformed → keep fallback.

  _regions = rows;
  rebuildIndexes();
  return true;
}
