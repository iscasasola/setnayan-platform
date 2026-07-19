/**
 * CANONICAL SOURCE NOTE (2026-06-19 · REGIONS canonical-source QA fix):
 * `public.regions` + `public.wedding_destinations` (migration
 * 20270128395443_regions_canonical_source) are now the canonical source for the
 * region taxonomy and the city → region map. The consts below (PH_REGIONS,
 * TOP_DESTINATIONS, CITY_TO_REGION) are kept as a COMPAT SHIM + build-time
 * fallback: `regionForCity()` now reads the DB-backed city aliases first (via
 * lib/region-source.regionSlugForCity) and falls through to CITY_TO_REGION on
 * any miss. wedding_destinations.city_aliases is seeded EMPTY this cycle, so the
 * Map fallback is the live path until a follow-up backfill lands — behavior is
 * identical to before. Do not delete these consts.
 *
 * Canonical PH region taxonomy · drives the Concierge wizard Card 02
 * (Reception Venue) Region → City cascade filter.
 *
 * Iteration 0006 · 2026-05-24 owner directive (verbatim):
 *   "For reception venue. instead of Straight City, let us choose Region
 *    first then City after. so customers can also search by region if
 *    they do not define city."
 *
 * Two surfaces consume this:
 *   1. `vendor-pick-grid-card.tsx` — region dropdown above the existing
 *      city dropdown · top-destinations chip strip above both · client-
 *      side filtering on `WizardVendorRec.hq_region`.
 *   2. `supabase/migrations/20260620000000_iteration_0006_vendor_profiles_hq_region.sql`
 *      — backfill UPDATE on `vendor_profiles.hq_region`. The city → region
 *      mapping in that migration matches `regionForCity()` below so legacy
 *      backfill + live new-vendor onboarding pick the same region code.
 *
 * PSGC codes (Philippine Standard Geographic Code) are the stable
 * identifier; display names + emoji optional. PSGC names sometimes shift
 * (CALABARZON renamed from "Southern Tagalog A"; SOCCSKSARGEN from
 * "Central Mindanao"); codes don't. Region IV-A · Region VII · NCR etc.
 * are PSA-defined and stable since 2002.
 *
 * Negros Island Region (NIR) — created 2024 by RA 12000 splitting Bacolod
 * (formerly Region VI) and Dumaguete (formerly Region VII) into a single
 * region. Currently still maps Bacolod → VI and Dumaguete → VII in the
 * migration backfill (pragmatic: most existing PH wedding-industry data
 * still indexes against the pre-split assignment). Future cutover can
 * re-map without schema changes.
 *
 * Per the brand-voice lock (CLAUDE.md 2026-05-15 row "0015 § Voice ·
 * luxurious, Filipino, modern"): region names use the canonical PSA
 * spellings (CALABARZON · SOCCSKSARGEN all-caps) but with friendly
 * descriptors so the picker doesn't read as bureaucratic. Examples:
 *   "NCR · Metro Manila"
 *   "IV-A · CALABARZON (Cavite, Laguna, Batangas, Rizal, Quezon)"
 *   "VII · Central Visayas (Cebu, Bohol, Negros Oriental)"
 */

import { regionBySlug, regionSlugForCity } from '@/lib/region-source';

/** Single region row · code + display name. Order: NCR first (biggest
 *  vendor pool · most-common pick), then PSGC numeric order, then BARMM
 *  + NIR at the end. */
export type PHRegion = {
  /** PSGC code · stable ID. NCR / CAR / I / II … XIII / BARMM / NIR. */
  code: string;
  /** Display name with descriptor — "NCR · Metro Manila",
   *  "IV-A · CALABARZON (Cavite, Laguna, Batangas, Rizal, Quezon)". */
  name: string;
};

/** Canonical 18-row region list. Order is deliberate (NCR first because
 *  most vendors are there, then geographic-numeric order, then BARMM
 *  + NIR at the end). The dropdown renders this list as-is. */
export const PH_REGIONS: ReadonlyArray<PHRegion> = [
  { code: 'NCR', name: 'NCR · Metro Manila' },
  {
    code: 'CAR',
    name: 'CAR · Cordillera (Baguio, La Trinidad, Sagada, Banaue)',
  },
  { code: 'I', name: 'I · Ilocos Region (Vigan, Laoag, Dagupan)' },
  { code: 'II', name: 'II · Cagayan Valley (Tuguegarao, Santiago)' },
  {
    code: 'III',
    name: 'III · Central Luzon (Pampanga, Bulacan, Tarlac, Subic)',
  },
  {
    code: 'IV-A',
    name: 'IV-A · CALABARZON (Tagaytay, Cavite, Laguna, Batangas, Rizal, Quezon)',
  },
  {
    code: 'IV-B',
    name: 'IV-B · MIMAROPA (Palawan, Coron, El Nido, Mindoro)',
  },
  { code: 'V', name: 'V · Bicol (Legazpi, Naga, Sorsogon)' },
  {
    code: 'VI',
    name: 'VI · Western Visayas (Iloilo, Bacolod, Boracay, Aklan)',
  },
  {
    code: 'VII',
    name: 'VII · Central Visayas (Cebu, Bohol, Panglao, Dumaguete)',
  },
  { code: 'VIII', name: 'VIII · Eastern Visayas (Tacloban, Ormoc)' },
  { code: 'IX', name: 'IX · Zamboanga Peninsula (Zamboanga, Dipolog)' },
  {
    code: 'X',
    name: 'X · Northern Mindanao (Cagayan de Oro, Iligan, Malaybalay)',
  },
  { code: 'XI', name: 'XI · Davao Region (Davao City, Tagum, Digos)' },
  {
    code: 'XII',
    name: 'XII · SOCCSKSARGEN (General Santos, Koronadal, Cotabato City)',
  },
  { code: 'XIII', name: 'XIII · Caraga (Butuan, Surigao)' },
  {
    code: 'BARMM',
    name: 'BARMM · Bangsamoro (Marawi, Cotabato, Sulu, Tawi-Tawi)',
  },
  {
    code: 'NIR',
    name: 'NIR · Negros Island Region (Bacolod, Dumaguete)',
  },
] as const;

/** Top destinations chip strip · 2026-05-24 owner-locked surface. These
 *  8 chips sit ABOVE the Region + City dropdowns on Card 02 Reception
 *  Venue · clicking a chip jumps the picker straight to (region, city)
 *  without forcing the host through the dropdown ladder. Each chip is
 *  the most-searched venue area for its region by PH wedding-vendor
 *  marketplace data (per CLAUDE.md 2026-05-14 boost-service activation
 *  gate · "verified_vendor_count >= 500" projected concentration). */
export type TopDestination = {
  /** Canonical city name · matches `vendor_profiles.location_city` Title
   *  Case. */
  city: string;
  /** PSGC region code · matches `vendor_profiles.hq_region`. */
  region: string;
  /** Display label for the chip · "Metro Manila", "Cebu", "Boracay" etc.
   *  Friendlier than the raw city name (e.g., "Metro Manila" not
   *  "Manila" — Filipino couples search by area, not by single-city). */
  label: string;
};

/** 8 top-destination chips for Card 02 · 2026-05-24 owner directive. */
export const TOP_DESTINATIONS: ReadonlyArray<TopDestination> = [
  { city: 'Manila', region: 'NCR', label: 'Metro Manila' },
  { city: 'Tagaytay', region: 'IV-A', label: 'Tagaytay' },
  { city: 'Cebu City', region: 'VII', label: 'Cebu' },
  { city: 'Boracay', region: 'VI', label: 'Boracay' },
  { city: 'Panglao', region: 'VII', label: 'Bohol' },
  { city: 'Puerto Princesa', region: 'IV-B', label: 'Palawan' },
  { city: 'Baguio', region: 'CAR', label: 'Baguio' },
  { city: 'Davao City', region: 'XI', label: 'Davao' },
] as const;

/**
 * Returns the canonical PSGC region code for a known PH city, or NULL if
 * the city is unrecognized. Mirrors the city → region mapping in the
 * 20260620000000 migration's backfill CTE — keep both in sync when adding
 * new cities. Match is case-insensitive and whitespace-tolerant so
 * "Cebu City" / "cebu city" / "  Cebu City " all resolve to "VII".
 *
 * Used by:
 *   - vendor-pick-grid-card.tsx · derives a fallback region for vendors
 *     whose hq_region is NULL (legacy off-platform rows the migration
 *     couldn't backfill from location_city) so the region filter still
 *     scopes them when the host picks a region.
 *   - Future vendor onboarding code (V1.x) · derives region from
 *     location_city on save so new rows don't depend on the migration
 *     re-running.
 *
 * Returns NULL deliberately (vs throwing) so callers can fall back to
 * "no region match" UX without try/catch boilerplate.
 */
export function regionForCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  if (key.length === 0) return null;
  // DB-canonical first: wedding_destinations.city_aliases → canonical region
  // slug → PSGC code (the return contract callers compare against). The
  // city-alias cache is EMPTY this cycle (backfill pending), so this returns
  // null and we fall through to the frozen Map below — identical to before.
  const dbSlug = regionSlugForCity(key);
  if (dbSlug) {
    const psgc = regionBySlug(dbSlug)?.psgc_code;
    if (psgc) return psgc;
  }
  return CITY_TO_REGION.get(key) ?? null;
}

/** Internal lookup map · matches the migration backfill VALUES table.
 *  Frozen Map literal so the lookup is O(1) and the contents can't be
 *  mutated at runtime. ~50 cities covering the 95th-percentile of PH
 *  wedding vendor distribution. */
const CITY_TO_REGION: ReadonlyMap<string, string> = new Map<string, string>([
  // NCR · 17 cities of Metro Manila
  ['manila', 'NCR'],
  ['quezon city', 'NCR'],
  ['makati', 'NCR'],
  ['makati city', 'NCR'],
  ['taguig', 'NCR'],
  ['taguig city', 'NCR'],
  ['bgc', 'NCR'],
  ['bonifacio global city', 'NCR'],
  ['fort bonifacio', 'NCR'],
  ['pasig', 'NCR'],
  ['pasig city', 'NCR'],
  ['mandaluyong', 'NCR'],
  ['mandaluyong city', 'NCR'],
  ['san juan', 'NCR'],
  ['san juan city', 'NCR'],
  ['pasay', 'NCR'],
  ['pasay city', 'NCR'],
  ['parañaque', 'NCR'],
  ['paranaque', 'NCR'],
  ['parañaque city', 'NCR'],
  ['paranaque city', 'NCR'],
  ['caloocan', 'NCR'],
  ['caloocan city', 'NCR'],
  ['las piñas', 'NCR'],
  ['las pinas', 'NCR'],
  ['marikina', 'NCR'],
  ['marikina city', 'NCR'],
  ['muntinlupa', 'NCR'],
  ['muntinlupa city', 'NCR'],
  ['valenzuela', 'NCR'],
  ['valenzuela city', 'NCR'],
  ['malabon', 'NCR'],
  ['navotas', 'NCR'],
  ['pateros', 'NCR'],
  // CAR · Cordillera Administrative Region
  ['baguio', 'CAR'],
  ['baguio city', 'CAR'],
  ['la trinidad', 'CAR'],
  ['sagada', 'CAR'],
  ['banaue', 'CAR'],
  // Region I · Ilocos Region
  ['vigan', 'I'],
  ['vigan city', 'I'],
  ['laoag', 'I'],
  ['laoag city', 'I'],
  ['dagupan', 'I'],
  ['dagupan city', 'I'],
  ['san fernando la union', 'I'],
  // Region II · Cagayan Valley
  ['tuguegarao', 'II'],
  ['tuguegarao city', 'II'],
  ['santiago', 'II'],
  ['santiago city', 'II'],
  // Region III · Central Luzon
  ['angeles', 'III'],
  ['angeles city', 'III'],
  ['clark', 'III'],
  ['clark freeport', 'III'],
  ['pampanga', 'III'],
  ['san fernando pampanga', 'III'],
  ['bulacan', 'III'],
  ['olongapo', 'III'],
  ['olongapo city', 'III'],
  ['subic', 'III'],
  ['tarlac', 'III'],
  ['tarlac city', 'III'],
  // Region IV-A · CALABARZON
  ['tagaytay', 'IV-A'],
  ['tagaytay city', 'IV-A'],
  ['cavite city', 'IV-A'],
  ['cavite', 'IV-A'],
  ['batangas city', 'IV-A'],
  ['batangas', 'IV-A'],
  ['lipa', 'IV-A'],
  ['lipa city', 'IV-A'],
  ['calamba', 'IV-A'],
  ['calamba city', 'IV-A'],
  ['sta. rosa', 'IV-A'],
  ['santa rosa', 'IV-A'],
  ['sta rosa', 'IV-A'],
  ['antipolo', 'IV-A'],
  ['antipolo city', 'IV-A'],
  ['lucena', 'IV-A'],
  ['lucena city', 'IV-A'],
  ['laguna', 'IV-A'],
  ['rizal', 'IV-A'],
  ['quezon', 'IV-A'],
  // Region IV-B · MIMAROPA
  ['puerto princesa', 'IV-B'],
  ['puerto princesa city', 'IV-B'],
  ['palawan', 'IV-B'],
  ['coron', 'IV-B'],
  ['el nido', 'IV-B'],
  ['mindoro', 'IV-B'],
  // Region V · Bicol
  ['legazpi', 'V'],
  ['legazpi city', 'V'],
  ['legaspi', 'V'],
  ['legaspi city', 'V'],
  ['naga', 'V'],
  ['naga city', 'V'],
  ['sorsogon', 'V'],
  ['sorsogon city', 'V'],
  ['albay', 'V'],
  // Region VI · Western Visayas
  ['iloilo city', 'VI'],
  ['iloilo', 'VI'],
  ['bacolod', 'VI'],
  ['bacolod city', 'VI'],
  ['boracay', 'VI'],
  ['aklan', 'VI'],
  ['antique', 'VI'],
  ['capiz', 'VI'],
  ['roxas', 'VI'],
  ['roxas city', 'VI'],
  ['guimaras', 'VI'],
  ['negros occidental', 'VI'],
  // Region VII · Central Visayas
  ['cebu city', 'VII'],
  ['cebu', 'VII'],
  ['mactan', 'VII'],
  ['lapu-lapu', 'VII'],
  ['lapu-lapu city', 'VII'],
  ['lapulapu', 'VII'],
  ['lapulapu city', 'VII'],
  ['mandaue', 'VII'],
  ['mandaue city', 'VII'],
  ['talisay', 'VII'],
  ['talisay city', 'VII'],
  ['bohol', 'VII'],
  ['panglao', 'VII'],
  ['tagbilaran', 'VII'],
  ['tagbilaran city', 'VII'],
  ['dumaguete', 'VII'],
  ['dumaguete city', 'VII'],
  ['negros oriental', 'VII'],
  // Region VIII · Eastern Visayas
  ['tacloban', 'VIII'],
  ['tacloban city', 'VIII'],
  ['ormoc', 'VIII'],
  ['ormoc city', 'VIII'],
  ['catbalogan', 'VIII'],
  ['borongan', 'VIII'],
  // Region IX · Zamboanga Peninsula
  ['zamboanga city', 'IX'],
  ['zamboanga', 'IX'],
  ['dipolog', 'IX'],
  ['dipolog city', 'IX'],
  ['pagadian', 'IX'],
  ['pagadian city', 'IX'],
  // Region X · Northern Mindanao
  ['cagayan de oro', 'X'],
  ['cagayan de oro city', 'X'],
  ['cdo', 'X'],
  ['iligan', 'X'],
  ['iligan city', 'X'],
  ['malaybalay', 'X'],
  ['valencia', 'X'],
  // Region XI · Davao
  ['davao city', 'XI'],
  ['davao', 'XI'],
  ['tagum', 'XI'],
  ['tagum city', 'XI'],
  ['mati', 'XI'],
  ['mati city', 'XI'],
  ['digos', 'XI'],
  ['digos city', 'XI'],
  // Region XII · SOCCSKSARGEN
  ['general santos', 'XII'],
  ['general santos city', 'XII'],
  ['gensan', 'XII'],
  ['koronadal', 'XII'],
  ['koronadal city', 'XII'],
  ['kidapawan', 'XII'],
  ['kidapawan city', 'XII'],
  ['cotabato city', 'XII'],
  // Region XIII · Caraga
  ['butuan', 'XIII'],
  ['butuan city', 'XIII'],
  ['surigao', 'XIII'],
  ['surigao city', 'XIII'],
  ['bayugan', 'XIII'],
  ['bayugan city', 'XIII'],
  // BARMM
  ['marawi', 'BARMM'],
  ['marawi city', 'BARMM'],
  ['cotabato', 'BARMM'],
  ['sulu', 'BARMM'],
  ['tawi-tawi', 'BARMM'],
  ['tawi tawi', 'BARMM'],
]);
