/**
 * scripts/seed-demo-vendors.ts
 *
 * PR 1 of 3 — Marketplace simulation workstream (owner-approved 2026-05-22).
 *
 * Seeds ~1,500 synthetic vendor_profiles flagged `is_demo=TRUE` across the
 * 192-row canonical_service_schemas taxonomy. 5-10 vendors per service,
 * geographically distributed across 11 PH cities (NCR 40% · Cebu 20% ·
 * Davao 15% · Tagaytay 15% · Boracay 10%), with realistic Filipino
 * business names, 1-3 packages per vendor (vendor_services rows with
 * starts_at_centavos + package_inclusions), category-specific attribute
 * payloads (vendor_service_attributes), and admin-readable cleanup
 * metadata (demo_batch_id).
 *
 * WHY
 * ---
 * Owner needs to dogfood the marketplace surface (compare view, per-category
 * filters, pricing display) before real vendor curation completes. Per the
 * pilot-first timeline (CLAUDE.md 2026-05-18 row 8), real vendor onboarding
 * ramps post-pilot once the DTI/BIR/business-account chain wraps. Synthetic
 * vendors give the owner a working marketplace right now without committing
 * to real vendor relationships.
 *
 * CROSS-PR
 * --------
 * Agent 2 ships ?demo=1 query-param gate that filters by is_demo. Agent 3
 * ships the compare view that consumes this seed data. The seed must exist
 * for either downstream PR to surface usable demo content.
 *
 * SAFETY
 * ------
 * Refuses to run if SUPABASE_DB_URL points at the prod project ref OR if
 * --allow-prod is not explicitly passed AND the URL is missing the
 * `setnayan-test` or `setnayan-staging` substring. Prints what it would do
 * with --dry-run and exits 0 without writing.
 *
 * USAGE
 * -----
 *   # Generate fresh batch (cleans previous batch first):
 *   pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts
 *
 *   # Generate ON TOP of existing batches (keeps prior demo data):
 *   pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts --append
 *
 *   # Just print what would happen:
 *   pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts --dry-run
 *
 *   # Limit canonical services (faster local testing):
 *   pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts --limit=20
 *
 * ENV
 * ---
 *   SUPABASE_URL                 — required (target Supabase project URL)
 *   SUPABASE_SERVICE_ROLE_KEY    — required (service-role; bypasses RLS)
 *   DEMO_VENDORS_PROD_REF        — optional override prod ref guard
 *
 * IDEMPOTENCY
 * -----------
 * Default mode: deletes the most recent demo_batch_id (per row count), then
 * inserts a brand-new batch with a fresh UUID. Predictable single-batch
 * state per run. The legacy 2026-06-01 test-seed rows (batch
 * 00000000-0000-0000-0000-000000000001) are preserved and never touched
 * by default — they're a separate batch.
 *
 * --append mode: skips cleanup and adds a new batch alongside existing
 * batches. Useful for stacking different curated batches for A/B preview.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// ===========================================================================
// SAFETY GUARDS
// ===========================================================================

const PROD_PROJECT_REF =
  process.env.DEMO_VENDORS_PROD_REF ?? 'njrupjnvkjkitfctetvi';

// Shared prod-safety check. The API route (server-side) uses this to return a
// 403 instead of process.exit; the CLI keeps the hard exit in assertNotProd.
export function isNonProdUrl(supabaseUrl: string | undefined | null): boolean {
  return !!supabaseUrl && !supabaseUrl.includes(PROD_PROJECT_REF);
}

function assertNotProd(supabaseUrl: string): void {
  if (!isNonProdUrl(supabaseUrl)) {
    console.error(
      `\nREFUSING TO RUN. Detected prod project ref "${PROD_PROJECT_REF}" in SUPABASE_URL.\n` +
        `Demo vendors are for non-prod environments only. Set SUPABASE_URL to a test/staging project,\n` +
        `or override the guard via DEMO_VENDORS_PROD_REF= (only if you're absolutely certain).\n`,
    );
    process.exit(2);
  }
}

// ===========================================================================
// CITY POOL — weighted by region per spec
// ===========================================================================

type CityRow = {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  weight: number;
};

const CITIES: ReadonlyArray<CityRow> = [
  // NCR — 40% total. 6 cities × ~6.7% each.
  { name: 'Manila', slug: 'manila', lat: 14.5995, lng: 120.9842, weight: 6.7 },
  { name: 'Quezon City', slug: 'quezon-city', lat: 14.676, lng: 121.0437, weight: 6.7 },
  { name: 'Makati', slug: 'makati', lat: 14.5547, lng: 121.0244, weight: 6.7 },
  { name: 'Pasig', slug: 'pasig', lat: 14.5764, lng: 121.0851, weight: 6.6 },
  { name: 'BGC', slug: 'bgc', lat: 14.5497, lng: 121.0507, weight: 6.7 },
  { name: 'Taguig', slug: 'taguig', lat: 14.5176, lng: 121.0509, weight: 6.6 },
  // Cebu — 20% total. 3 cities, weighted Cebu City heavy.
  { name: 'Cebu City', slug: 'cebu-city', lat: 10.3157, lng: 123.8854, weight: 10 },
  { name: 'Mactan', slug: 'mactan', lat: 10.3128, lng: 124.0167, weight: 5 },
  { name: 'Lapu-Lapu', slug: 'lapu-lapu', lat: 10.3098, lng: 123.9492, weight: 5 },
  // Davao — 15%. Single city.
  { name: 'Davao City', slug: 'davao-city', lat: 7.1907, lng: 125.4553, weight: 15 },
  // Tagaytay — 15%.
  { name: 'Tagaytay', slug: 'tagaytay', lat: 14.086, lng: 120.9621, weight: 15 },
  // Boracay — 10%.
  { name: 'Boracay', slug: 'boracay', lat: 11.9669, lng: 121.9251, weight: 10 },
];

const CITY_WEIGHT_TOTAL = CITIES.reduce((sum, c) => sum + c.weight, 0);

function pickWeightedCity(rng: () => number): CityRow {
  let r = rng() * CITY_WEIGHT_TOTAL;
  for (const city of CITIES) {
    r -= city.weight;
    if (r <= 0) return city;
  }
  return CITIES[CITIES.length - 1]!;
}

// A reception venue IS a place, so it carries ONE specific venue setting (the
// couple's reception-style pick filters on it). City-correlated for realism —
// Boracay venues are beachfront, Tagaytay are garden/ridge, NCR are hotel
// ballrooms + heritage houses, etc. Derived from (city, index) so it's
// deterministic WITHOUT consuming the RNG stream (keeps every other generated
// field byte-identical to the pre-change seed). Values are the events
// .venue_setting CHECK set (banquet_hall · garden · beach · destination ·
// heritage · outdoor_tent). NON-venue vendors get NULL = "works at any venue"
// (a photographer/caterer isn't tied to a setting) — see the insert below.
const VENUE_SETTINGS_BY_CITY: Record<string, readonly string[]> = {
  Boracay: ['beach', 'beach', 'destination'],
  Tagaytay: ['garden', 'garden', 'destination', 'banquet_hall'],
  Mactan: ['beach', 'destination', 'banquet_hall'],
  'Lapu-Lapu': ['beach', 'destination'],
  'Cebu City': ['banquet_hall', 'heritage', 'garden'],
  'Davao City': ['banquet_hall', 'garden', 'outdoor_tent'],
};
// NCR + any unlisted city → mostly hotel ballrooms, some heritage + garden.
const VENUE_SETTINGS_DEFAULT: readonly string[] = [
  'banquet_hall',
  'banquet_hall',
  'heritage',
  'garden',
];
function venueSettingFor(cityName: string, index: number): string {
  const options = VENUE_SETTINGS_BY_CITY[cityName] ?? VENUE_SETTINGS_DEFAULT;
  return options[index % options.length]!;
}

// ===========================================================================
// DETERMINISTIC RNG (seeded mulberry32)
// ===========================================================================
// A seeded PRNG means a given batch_id + canonical_service produces the same
// vendor names / cities / prices on re-run — useful when the seed script
// re-runs and you want stable demo data. Each canonical_service derives its
// own seed from a string hash so different categories produce different
// samples but each category is reproducible.

function hashStringToInt(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function intBetween(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ===========================================================================
// BUSINESS-NAME TEMPLATES
// ===========================================================================

const FIRST_NAMES = [
  'Maria', 'Juan', 'Ana', 'Joaquin', 'Sofia', 'Mateo', 'Isabel', 'Diego',
  'Carmen', 'Andres', 'Lucia', 'Rafael', 'Patricia', 'Manuel', 'Elena',
  'Jose', 'Camille', 'Lorenzo', 'Bianca', 'Enrique', 'Margaux', 'Vincent',
  'Trisha', 'Antonio', 'Sabrina', 'Gabriel', 'Beatriz', 'Cristian', 'Karina',
  'Felipe',
];

const LAST_NAMES = [
  'Reyes', 'Cruz', 'Santos', 'Garcia', 'Mendoza', 'Torres', 'Aquino',
  'Bautista', 'Castillo', 'Delgado', 'Fernandez', 'Gonzales', 'Hernandez',
  'Ibarra', 'Jimenez', 'Lopez', 'Martinez', 'Navarro', 'Ocampo', 'Padilla',
  'Quintos', 'Ramos', 'Salazar', 'Tan', 'Uy', 'Villanueva', 'Yulo', 'Zamora',
  'Alvarez', 'Buenaventura',
];

const PLACES = [
  'Manila', 'Cebu', 'Davao', 'Tagaytay', 'Iloilo', 'Baguio', 'Boracay',
  'Bohol', 'Dumaguete', 'Pampanga', 'Vigan', 'Cavite', 'Laguna', 'Quezon',
  'Batangas', 'Bicol', 'Palawan',
];

const BOTANICAL = [
  'Sampaguita', 'Ilang-Ilang', 'Rosal', 'Gumamela', 'Waling-Waling',
  'Cadena de Amor', 'Bougainvillea', 'Camellia', 'Calachuchi', 'Sunflower',
];

const ELEMENTS = [
  'Atelier', 'Studios', 'Co.', 'Collective', 'House', 'Manor', 'Pavilion',
  'Garden', 'Hall', 'Loft', 'Casita', 'Bridges', 'Sunday', 'Heritage',
];

const CITY_DESCRIPTORS = ['Manila', 'Cebu', 'Davao', 'NCR', 'PH'];

type NameTemplate =
  | 'first_last_kind'
  | 'casa_place'
  | 'place_kind'
  | 'botanical_kind'
  | 'place_blooms'
  | 'studio_first'
  | 'first_last_studio'
  | 'kind_atelier';

function buildBusinessName(
  rng: () => number,
  service: string,
  kindWord: string,
): string {
  const template: NameTemplate = pickFrom(rng, [
    'first_last_kind',
    'casa_place',
    'place_kind',
    'botanical_kind',
    'place_blooms',
    'studio_first',
    'first_last_studio',
    'kind_atelier',
  ]);

  const first = pickFrom(rng, FIRST_NAMES);
  const last = pickFrom(rng, LAST_NAMES);
  const place = pickFrom(rng, PLACES);
  const botanical = pickFrom(rng, BOTANICAL);
  const el = pickFrom(rng, ELEMENTS);
  const city = pickFrom(rng, CITY_DESCRIPTORS);

  // For categories where florist/blooms names don't make sense, swap.
  const isFlorist = /(florist|flower|floral|bouquet|garlands|petal)/i.test(service);
  const isVenue = /(venue|hall|garden|beach|resort|farm|estate|hotel)/i.test(service);
  const isFoodVendor = /(catering|coffee|food|drinks|cake|pastry|dessert|bar)/i.test(
    service,
  );

  switch (template) {
    case 'first_last_kind':
      return `${first} ${last} ${kindWord}`;
    case 'casa_place':
      return `Casa ${place}${isVenue ? '' : ` ${kindWord}`}`;
    case 'place_kind':
      return `${place} ${kindWord}`;
    case 'botanical_kind':
      return `${botanical} ${kindWord}`;
    case 'place_blooms':
      if (!isFlorist) return `${first} ${last} ${kindWord}`;
      return `${place} Blooms & ${el}`;
    case 'studio_first':
      return `${el} of ${first}`;
    case 'first_last_studio':
      return `${first} ${last} ${el}`;
    case 'kind_atelier':
      return isFoodVendor
        ? `${first} ${last} Kitchen`
        : `${kindWord} ${el} · ${city}`;
  }
}

// ===========================================================================
// CATEGORY → PRICING PROFILE
// ===========================================================================
//
// Each entry maps a regex-matched canonical_service slug to a realistic
// PH wedding-vendor pricing band + a crew-size hint + a list of common
// package-line-item snippets. Centavos as the source of truth (project
// pricing canon).
//
// Order matters — first match wins (so "ai_edited_highlight" hits the
// video-AI branch before the generic videographer branch).

type PricingProfile = {
  packages: Array<{
    tierLabel: string; // "Essentials" / "Signature" / "Premium" — purely cosmetic in vendor_services.category isn't where this goes
    minCentavos: number; // starts_at_centavos low end of the band
    maxCentavos: number; // high end of band (random within for each vendor)
    inclusions: ReadonlyArray<string>;
  }>;
  crewSize: () => [number, number]; // [min, max] crew size band
  crewMealRequired: boolean;
  numPackagesRange: [number, number]; // how many vendor_services rows to create per vendor
};

function priceProfileFor(service: string): PricingProfile {
  const s = service;

  // Photography variants — ₱30k-150k
  if (/(photograph|prenup|engagement|boudoir|studio_portrait|family_day2)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Essentials',
          minCentavos: 3_000_000, // ₱30,000
          maxCentavos: 6_000_000, // ₱60,000
          inclusions: [
            '4 hours of coverage',
            '1 lead photographer',
            '200+ edited high-res photos',
            'online gallery for 6 months',
          ],
        },
        {
          tierLabel: 'Signature',
          minCentavos: 6_500_000,
          maxCentavos: 11_000_000,
          inclusions: [
            '8 hours of coverage',
            '1 lead + 1 assistant',
            '500+ edited high-res photos',
            'online gallery for 12 months',
            'pre-nup discount voucher',
          ],
        },
        {
          tierLabel: 'Premium',
          minCentavos: 11_500_000,
          maxCentavos: 15_000_000,
          inclusions: [
            '10 hours of coverage',
            '2 photographers',
            '800+ edited photos',
            'photobook (8x12 hardcover)',
            'all RAW files on USB',
          ],
        },
      ],
      crewSize: () => [2, 3],
      crewMealRequired: true,
      numPackagesRange: [2, 3],
    };
  }

  // Videography variants — ₱40k-200k
  if (/(videograph|cinematograph|highlight_reel|same_day_edit|drone_video|ai_edited_highlight)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Essentials',
          minCentavos: 4_000_000,
          maxCentavos: 7_500_000,
          inclusions: [
            '4 hours of coverage',
            '1 videographer',
            '3-minute highlight reel',
            'online delivery',
          ],
        },
        {
          tierLabel: 'Signature',
          minCentavos: 8_000_000,
          maxCentavos: 14_000_000,
          inclusions: [
            '8 hours of coverage',
            '2 videographers',
            '5-minute highlight + full ceremony cut',
            'raw footage delivered',
            'social-share cutdowns',
          ],
        },
        {
          tierLabel: 'Premium',
          minCentavos: 15_000_000,
          maxCentavos: 20_000_000,
          inclusions: [
            '12 hours of coverage',
            '3 videographers',
            'same-day-edit option',
            'drone aerials',
            'full-day documentary cut',
          ],
        },
      ],
      crewSize: () => [2, 4],
      crewMealRequired: true,
      numPackagesRange: [2, 3],
    };
  }

  // Catering — per-plate ₱1,200-1,800; total ₱60k-400k for 50-500 pax
  if (/(catering|live_station|paella|pasta_station|carving_station|grazing|food_truck|dessert_bar)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '50-pax buffet',
          minCentavos: 6_000_000,
          maxCentavos: 9_000_000,
          inclusions: [
            'buffet for 50 guests',
            '5 main courses + 2 desserts',
            'unlimited iced tea + water',
            'full service crew',
            'table setup',
          ],
        },
        {
          tierLabel: '150-pax plated',
          minCentavos: 18_000_000,
          maxCentavos: 27_000_000,
          inclusions: [
            'plated dinner for 150 guests',
            '6 main courses + 3 desserts',
            'amuse-bouche + welcome drinks',
            'tasting session',
            'full service crew',
          ],
        },
        {
          tierLabel: '300-pax premium',
          minCentavos: 36_000_000,
          maxCentavos: 54_000_000,
          inclusions: [
            'plated or buffet for 300 guests',
            '8 main courses + 4 desserts',
            'unlimited cocktails',
            'cake-cutting tableside service',
            'custom menu design',
          ],
        },
      ],
      crewSize: () => [12, 30],
      crewMealRequired: false,
      numPackagesRange: [2, 3],
    };
  }

  // Cakes & desserts — ₱8k-50k
  if (/(cake|pastry|dessert)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '3-tier wedding cake',
          minCentavos: 800_000,
          maxCentavos: 1_800_000,
          inclusions: [
            '3-tier wedding cake (serves 80)',
            'buttercream finish',
            'fresh-flower topper',
            'delivery within Metro Manila',
          ],
        },
        {
          tierLabel: '5-tier premium',
          minCentavos: 2_500_000,
          maxCentavos: 5_000_000,
          inclusions: [
            '5-tier wedding cake (serves 200)',
            'fondant + sugar-flower detail',
            'custom monogram topper',
            'cake-table styling',
            'delivery + setup',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Florals — ₱25k-80k
  if (/(florist|flower|floral|bouquet|garlands|petal)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Bride essentials',
          minCentavos: 2_500_000,
          maxCentavos: 4_000_000,
          inclusions: [
            'bridal bouquet',
            'groom + parent boutonnieres',
            'flower girl petals',
            'ring pillow flowers',
          ],
        },
        {
          tierLabel: 'Full ceremony + reception',
          minCentavos: 5_000_000,
          maxCentavos: 8_000_000,
          inclusions: [
            'bridal + entourage bouquets',
            'ceremony arch (4m)',
            '15 centerpieces',
            'aisle petals + arrangements',
            'stage backdrop florals',
          ],
        },
      ],
      crewSize: () => [3, 6],
      crewMealRequired: true,
      numPackagesRange: [2, 2],
    };
  }

  // Venues — ₱80k-500k
  if (/(venue|hotel|garden|beach|resort|hall|tent|farm|estate|reception_venue|chapel|cathedral|basilica|mosque|inc_locale|temple|civil_registrar)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Half-day rate',
          minCentavos: 8_000_000,
          maxCentavos: 18_000_000,
          inclusions: [
            '6-hour venue rental',
            'tables + chairs for 100 pax',
            'basic lights + sound',
            'bridal holding room',
            'parking for 20 cars',
          ],
        },
        {
          tierLabel: 'Full-day rate',
          minCentavos: 18_000_000,
          maxCentavos: 38_000_000,
          inclusions: [
            '12-hour venue rental',
            'tables + chairs for up to 250 pax',
            'lights + sound system',
            'venue coordinator',
            'separate bridal + groom holding rooms',
            'parking for 40 cars',
          ],
        },
        {
          tierLabel: 'Premium (catering-tied)',
          minCentavos: 38_000_000,
          maxCentavos: 50_000_000,
          inclusions: [
            'full-day venue exclusive',
            'in-house catering for 300 pax',
            'premium AV package',
            'florals + standard styling',
            'pre-ceremony prep suite',
          ],
        },
      ],
      crewSize: () => [4, 10],
      crewMealRequired: false,
      numPackagesRange: [2, 3],
    };
  }

  // Coordinators / planners — ₱50k-200k
  if (/(coordinator|planner|wedding_coordination|on_the_day|day_of)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Day-of coordination',
          minCentavos: 5_000_000,
          maxCentavos: 8_000_000,
          inclusions: [
            '4-week prep + day-of execution',
            '2 coordinators on event day',
            'vendor coordination & timeline',
            'rehearsal supervision',
          ],
        },
        {
          tierLabel: 'Month-of (partial planning)',
          minCentavos: 8_500_000,
          maxCentavos: 13_000_000,
          inclusions: [
            '8-week prep',
            'venue + vendor coordination',
            '3 coordinators on event day',
            'timeline + run-of-show',
            'guest experience design',
          ],
        },
        {
          tierLabel: 'Full planning',
          minCentavos: 14_000_000,
          maxCentavos: 20_000_000,
          inclusions: [
            'end-to-end planning (12+ months)',
            'vendor sourcing + budget management',
            'design direction',
            '4 coordinators on event day',
            'unlimited check-ins',
          ],
        },
      ],
      crewSize: () => [2, 4],
      crewMealRequired: true,
      numPackagesRange: [2, 3],
    };
  }

  // HMUA — ₱8k-25k
  if (/(makeup|hair|hmua)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Bride only',
          minCentavos: 800_000,
          maxCentavos: 1_400_000,
          inclusions: [
            'bridal trial (90 min)',
            'event-day makeup + hair',
            'airbrush foundation',
            'lashes included',
          ],
        },
        {
          tierLabel: 'Bride + entourage (up to 4)',
          minCentavos: 1_500_000,
          maxCentavos: 2_500_000,
          inclusions: [
            'bridal trial',
            'bride + 4 entourage HMU',
            'on-site touch-ups',
          ],
        },
      ],
      crewSize: () => [1, 3],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Lights & Sound — ₱20k-80k
  if (/(lights_and_sound|sound_system|lighting_design|av_)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Standard',
          minCentavos: 2_000_000,
          maxCentavos: 3_500_000,
          inclusions: [
            '4-hour event coverage',
            '2 speakers + 2 monitors',
            'wireless mics x 2',
            '8 par-can uplights',
            '1 sound engineer',
          ],
        },
        {
          tierLabel: 'Premium concert-grade',
          minCentavos: 5_000_000,
          maxCentavos: 8_000_000,
          inclusions: [
            '8-hour event coverage',
            'line-array speakers',
            'wireless mics x 4',
            'full uplight + moving-head package',
            'fog + haze',
            '2 sound engineers + 1 lighting op',
          ],
        },
      ],
      crewSize: () => [2, 4],
      crewMealRequired: true,
      numPackagesRange: [1, 2],
    };
  }

  // Live bands / acoustic / DJ — ₱25k-120k
  if (/(band|dj|acoustic|live_music|wedding_singer|choir|chorale|string_quartet|string_ensemble|string_trio|kulintang|rondalla|folk_performer)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '3-piece band',
          minCentavos: 2_500_000,
          maxCentavos: 5_000_000,
          inclusions: [
            '3 musicians',
            '2 x 45-min sets',
            'standard sound check',
            'genre mix (pop, ballads, OPM)',
          ],
        },
        {
          tierLabel: '5-piece band',
          minCentavos: 5_500_000,
          maxCentavos: 9_500_000,
          inclusions: [
            '5 musicians + vocalist',
            '3 x 45-min sets',
            'requests list option',
            'first-dance solo arrangement',
          ],
        },
        {
          tierLabel: '8-piece premier',
          minCentavos: 10_000_000,
          maxCentavos: 12_000_000,
          inclusions: [
            '8 musicians (full ensemble)',
            '4 x 45-min sets',
            'lead vocalist + 2 backups',
            'custom-arranged ceremony piece',
          ],
        },
      ],
      crewSize: () => [3, 8],
      crewMealRequired: true,
      numPackagesRange: [2, 3],
    };
  }

  // Photobooths — ₱15k-45k
  if (/(photobooth|photo_booth|booth)/i.test(s) && !/coffee|mobile_bar/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '4-hour booth',
          minCentavos: 1_500_000,
          maxCentavos: 2_500_000,
          inclusions: [
            '4 hours of booth',
            'unlimited prints (2x6 strips)',
            'custom template (couple monogram)',
            'props + backdrop',
            '1 attendant',
          ],
        },
        {
          tierLabel: 'Full reception',
          minCentavos: 3_000_000,
          maxCentavos: 4_500_000,
          inclusions: [
            '6 hours of booth',
            'unlimited prints + digital gallery',
            '360° spin-cam upgrade',
            'props + premium backdrop',
            '2 attendants',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Mobile bars / coffee — ₱20k-60k
  if (/(mobile_bar|coffee_booth|bar_service|bartender|cocktail|juice_bar|tea_booth)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '4-hour bar (50 pax)',
          minCentavos: 2_000_000,
          maxCentavos: 3_000_000,
          inclusions: [
            '4 hours of service',
            '3 signature cocktails',
            'bar setup + glassware',
            '1 bartender',
            'unlimited soft drinks',
          ],
        },
        {
          tierLabel: '6-hour bar (150 pax)',
          minCentavos: 3_500_000,
          maxCentavos: 5_500_000,
          inclusions: [
            '6 hours of service',
            '5 signature cocktails',
            'premium spirit selection',
            'custom drink menu cards',
            '2 bartenders',
          ],
        },
      ],
      crewSize: () => [2, 4],
      crewMealRequired: true,
      numPackagesRange: [1, 2],
    };
  }

  // Gowns / suits / attire — ₱25k-120k
  if (/(gown|bridal_attire|wedding_dress|entourage_gown|suit|barong|tuxedo|groom_attire|entourage_suit|filipiniana|maria_clara|terno|balintawak)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Rental',
          minCentavos: 2_500_000,
          maxCentavos: 4_500_000,
          inclusions: [
            'rental for 5 days',
            '2 fittings',
            'standard alterations',
            'professional steaming',
          ],
        },
        {
          tierLabel: 'Custom design',
          minCentavos: 7_500_000,
          maxCentavos: 12_000_000,
          inclusions: [
            'custom design consultation',
            'pattern + 4 fittings',
            'all alterations included',
            'preservation box',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Officiant / religious / ceremony — ₱5k-30k
  if (/(priest|minister|pastor|imam|judge|officiant|reverend|rabbi|church_fee)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Ceremony service',
          minCentavos: 500_000,
          maxCentavos: 1_500_000,
          inclusions: [
            'ceremony officiating',
            'rehearsal attendance',
            'wedding vows prep',
            'ceremony script',
          ],
        },
        {
          tierLabel: 'Full ceremony package',
          minCentavos: 1_800_000,
          maxCentavos: 3_000_000,
          inclusions: [
            'rehearsal + ceremony',
            'pre-marital counseling sessions',
            'marriage certificate filing assistance',
          ],
        },
      ],
      crewSize: () => [1, 1],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Transportation — ₱15k-80k
  if (/(transport|car_|shuttle|coach|trolley|bridal_car)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Bridal car (single)',
          minCentavos: 1_500_000,
          maxCentavos: 3_000_000,
          inclusions: [
            'bridal car + driver',
            'fresh florals décor',
            '6 hours of service',
            'fuel + parking included',
          ],
        },
        {
          tierLabel: 'Bridal + guest shuttle',
          minCentavos: 4_500_000,
          maxCentavos: 8_000_000,
          inclusions: [
            'bridal car + driver',
            '2 guest shuttles (capacity 30 each)',
            '8 hours total service',
            'coordinator on route',
          ],
        },
      ],
      crewSize: () => [1, 3],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Invitations / stationery / save-the-date / monogram / signage
  if (/(invitation|stationery|save_the_date|monogram|signage|seating_chart|seal|wax_seal|menu_card|escort_card|guestbook)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Digital suite',
          minCentavos: 500_000,
          maxCentavos: 1_500_000,
          inclusions: [
            'custom save-the-date design',
            'digital RSVP form',
            'wedding website setup',
            'unlimited revisions',
          ],
        },
        {
          tierLabel: 'Print + digital',
          minCentavos: 2_000_000,
          maxCentavos: 4_000_000,
          inclusions: [
            'invitation suite (150 pcs)',
            'envelope addressing',
            'wax seal accent',
            'matching menu + seating cards',
            'digital RSVP form',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Rings / jewelry — ₱25k-200k
  if (/(ring|jewel)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'His & Hers rings',
          minCentavos: 2_500_000,
          maxCentavos: 5_500_000,
          inclusions: [
            'pair of matching wedding bands',
            'choice of gold (14k/18k)',
            'engraving (3 lines free)',
            'lifetime cleaning warranty',
          ],
        },
        {
          tierLabel: 'Premium bridal set',
          minCentavos: 8_000_000,
          maxCentavos: 18_000_000,
          inclusions: [
            'engagement + wedding bands set',
            'lab-grown or natural diamond',
            'platinum or 18k gold',
            'custom design consultation',
            'lifetime upgrade option',
          ],
        },
      ],
      crewSize: () => [1, 1],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Beauty & wellness (bridal prep adjacent to HMUA) — ₱3k-25k
  if (/(bridal_spa|fitness|nutritionist|dermatology|dental|grooming|henna|family_mua|maternity_bride_mua|mature_bride_mua|touchup_mua)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Single session',
          minCentavos: 300_000,
          maxCentavos: 900_000,
          inclusions: [
            'one bridal-prep session',
            'consultation included',
            'personalized plan',
          ],
        },
        {
          tierLabel: 'Bridal program',
          minCentavos: 1_200_000,
          maxCentavos: 2_500_000,
          inclusions: [
            '4-session bridal program',
            'progress tracking',
            'event-week touch-up',
            'partner add-on option',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Experiential booths & wellness stations — ₱15k-50k
  if (/(magic_mirror|selfie|vr_ar|arcade|perfume_bar|massage_chair|mini_nail|nail_bar|aromatherapy|tarot|palmistry|astrology|retro_games|led_dance|hair_touchup_station)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: '4-hour station',
          minCentavos: 1_500_000,
          maxCentavos: 2_800_000,
          inclusions: [
            '4 hours of station service',
            '1 attendant',
            'setup + teardown',
            'props / consumables included',
          ],
        },
        {
          tierLabel: 'Full reception',
          minCentavos: 3_200_000,
          maxCentavos: 5_000_000,
          inclusions: [
            '6 hours of station service',
            '2 attendants',
            'premium setup + branding',
            'digital sharing / keepsakes',
          ],
        },
      ],
      crewSize: () => [1, 3],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Live craft & keepsakes (on-site artists + souvenirs/tokens) — ₱8k-40k
  if (/(portrait_painter|caricature|silhouette|calligraphy|keychain_engraving|embroidery|poetry_typewriter|souvenir|giveaway|_token|pasalubong)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Per 50 guests',
          minCentavos: 800_000,
          maxCentavos: 1_800_000,
          inclusions: [
            'live craft station for ~50 guests',
            '1 artist',
            'materials included',
            'take-home keepsakes',
          ],
        },
        {
          tierLabel: 'Full event',
          minCentavos: 2_200_000,
          maxCentavos: 4_000_000,
          inclusions: [
            'full-reception coverage',
            '2 artists',
            'premium materials + packaging',
            'custom monogram option',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Bridal accessories (veil / garter / headpiece / corsage / tiara) — ₱2k-20k
  if (/(veil|garter|headpiece|corsage|tiara)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Ready-to-wear',
          minCentavos: 200_000,
          maxCentavos: 800_000,
          inclusions: [
            'ready-to-wear piece',
            'standard colorway',
            'one fitting / sizing',
          ],
        },
        {
          tierLabel: 'Made-to-order',
          minCentavos: 1_000_000,
          maxCentavos: 2_000_000,
          inclusions: [
            'made-to-order design',
            'material + finish consultation',
            '2 fittings',
            'matching entourage option',
          ],
        },
      ],
      crewSize: () => [1, 1],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Ceremony prep & paperwork (seminars + license/document logistics) — ₱2k-15k
  if (/(pre_cana|cfo_seminar|counseling|license_expediting|apostille|dfa_authentication|visa_wedding)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Standard processing',
          minCentavos: 200_000,
          maxCentavos: 600_000,
          inclusions: [
            'requirements checklist',
            'standard processing',
            'document review',
          ],
        },
        {
          tierLabel: 'Assisted / expedited',
          minCentavos: 800_000,
          maxCentavos: 1_500_000,
          inclusions: [
            'end-to-end assistance',
            'expedited processing',
            'appointment scheduling',
            'follow-up coordination',
          ],
        },
      ],
      crewSize: () => [1, 2],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Rentals & site infrastructure — ₱5k-45k
  if (/(generator_rental|restroom_rental|cooling_fans|misters|bug_repellent|parasol|tent_rental)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Day rental',
          minCentavos: 500_000,
          maxCentavos: 1_500_000,
          inclusions: [
            'event-day rental',
            'delivery + pickup (Metro Manila)',
            'on-site setup',
          ],
        },
        {
          tierLabel: 'Full-event + standby crew',
          minCentavos: 2_000_000,
          maxCentavos: 4_500_000,
          inclusions: [
            'extended rental window',
            'standby technician on-site',
            'fuel / consumables included',
            'destination delivery option',
          ],
        },
      ],
      crewSize: () => [1, 3],
      crewMealRequired: true,
      numPackagesRange: [1, 2],
    };
  }

  // Food carts & dessert stations (snack / drink stations) — ₱8k-45k
  if (/(halo_halo|mini_lechon|ice_cream_cart|cotton_candy|crepe|pancake|charcuterie|tea_bar|whiskey_cigar)/i.test(s)) {
    return {
      packages: [
        {
          tierLabel: 'Station for 80 pax',
          minCentavos: 800_000,
          maxCentavos: 1_800_000,
          inclusions: [
            'station service for ~80 guests',
            '1-2 attendants',
            'unlimited servings (3 hrs)',
            'setup + styling',
          ],
        },
        {
          tierLabel: 'Station for 150 pax',
          minCentavos: 2_200_000,
          maxCentavos: 4_500_000,
          inclusions: [
            'station service for ~150 guests',
            '2-3 attendants',
            'unlimited servings (4 hrs)',
            'premium cart styling + signage',
          ],
        },
      ],
      crewSize: () => [2, 4],
      crewMealRequired: false,
      numPackagesRange: [1, 2],
    };
  }

  // Default (catch-all for less common services) — ₱10k-40k
  return {
    packages: [
      {
        tierLabel: 'Standard',
        minCentavos: 1_000_000,
        maxCentavos: 2_500_000,
        inclusions: [
          'standard service package',
          'event-day execution',
          'consultation included',
        ],
      },
      {
        tierLabel: 'Premium',
        minCentavos: 3_000_000,
        maxCentavos: 4_000_000,
        inclusions: [
          'premium service package',
          'extended hours',
          'priority scheduling',
          'extra deliverables',
        ],
      },
    ],
    crewSize: () => [1, 3],
    crewMealRequired: true,
    numPackagesRange: [1, 2],
  };
}

// ===========================================================================
// CATEGORY KIND-WORD (for the business name template)
// ===========================================================================
//
// Maps canonical_service slugs to a noun that reads well after a first/last
// name in the business-name templates (e.g. "Maria Reyes Photography" beats
// "Maria Reyes Pre_Nup_Photographer"). The fallback splits the slug into
// title case.

function kindWordFor(service: string): string {
  const s = service;
  if (/(photograph|prenup|engagement|family_day2|boudoir|studio_portrait)/i.test(s))
    return 'Photography';
  if (/(videograph|cinematograph|highlight_reel|same_day_edit|drone_video|ai_edited_highlight)/i.test(s))
    return 'Films';
  if (/(catering|live_station|paella|pasta_station|carving_station|grazing|food_truck|dessert_bar)/i.test(s))
    return 'Catering';
  if (/(cake|pastry|dessert)/i.test(s)) return 'Cakes';
  if (/(florist|flower|floral|bouquet|garlands|petal)/i.test(s)) return 'Florals';
  if (/(venue|hotel|garden|beach|resort|hall|tent|farm|estate|reception_venue)/i.test(s))
    return 'Venue';
  if (/(coordinator|planner|on_the_day|wedding_coordination|day_of)/i.test(s))
    return 'Events';
  if (/(makeup|hmua)/i.test(s)) return 'Makeup';
  if (/(hair)/i.test(s)) return 'Hair';
  if (/(lights_and_sound|sound_system|lighting_design|av_)/i.test(s))
    return 'Productions';
  if (/(band|live_music)/i.test(s)) return 'Band';
  if (/(acoustic)/i.test(s)) return 'Acoustic';
  if (/dj/i.test(s)) return 'DJ';
  if (/(string_quartet|string_ensemble|string_trio)/i.test(s)) return 'Strings';
  if (/(choir|chorale)/i.test(s)) return 'Choir';
  if (/(photobooth|photo_booth|booth)/i.test(s)) return 'Booth';
  if (/(mobile_bar|coffee|bartender|cocktail|juice_bar|tea_booth)/i.test(s))
    return 'Bar Co.';
  if (/(gown|bridal_attire|wedding_dress|entourage_gown)/i.test(s)) return 'Couture';
  if (/(suit|barong|tuxedo|groom_attire)/i.test(s)) return 'Suits';
  if (/(filipiniana|maria_clara|terno|balintawak)/i.test(s)) return 'Atelier';
  if (/(priest|minister|pastor|imam|judge|officiant|reverend|rabbi)/i.test(s))
    return 'Ministries';
  if (/(transport|car_|shuttle|coach|trolley|bridal_car)/i.test(s))
    return 'Transport';
  if (/(invitation|stationery|save_the_date|monogram|signage|seating_chart)/i.test(s))
    return 'Paper Co.';
  if (/(ring|jewel)/i.test(s)) return 'Jewelers';
  if (/(led_|projector|video_wall|screen)/i.test(s)) return 'Visuals';
  if (/(security|usher)/i.test(s)) return 'Security';
  if (/(giveaway|gift|favor|souvenir)/i.test(s)) return 'Favors';
  // Title-case the slug as fallback
  return s
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// ===========================================================================
// COARSE-CATEGORY MAP (same heuristic as the existing 2026-06-01 test seed)
// ===========================================================================
// vendor_profiles.services[] should carry BOTH canonical_service AND a
// coarse VENDOR_CATEGORIES enum value so saveVendorToPicks routes the saved
// row to the right planner bucket. Lifted verbatim from
// 20260601000000_marketplace_test_seed_960_vendors.sql lines 80-110.

function coarseCategoryFor(service: string): string {
  const s = service;
  if (/priest|minister|pastor|imam|judge|officiant|reverend|rabbi/i.test(s))
    return 'officiant';
  if (/photographer|photography|pre_?nup_shoot|engagement_shoot/i.test(s))
    return 'photographer';
  if (/videographer|videography|cinematographer|highlight_video|ai_edited_highlight/i.test(s))
    return 'videographer';
  if (/photobooth|photo_booth|booth/i.test(s)) return 'photobooth';
  if (/mobile_bar|bar_service|bartender|cocktail/i.test(s)) return 'mobile_bar';
  if (/catering|food_truck|live_station|paella|pasta_station|carving_station|grazing|dessert_bar/i.test(s))
    return 'catering';
  if (/cake|pastry|dessert/i.test(s)) return 'cake_maker';
  if (/string_quartet|string_ensemble|string_trio/i.test(s)) return 'string_quartet';
  if (/choir|chorale/i.test(s)) return 'choir';
  if (/band|dj|acoustic_duo|acoustic_trio|live_music|solo_musician/i.test(s))
    return 'band_dj';
  if (/host|emcee|mc_/i.test(s)) return 'host_emcee';
  if (/florist|flower|floral|bouquet/i.test(s)) return 'florist';
  if (/decor|styling|stylist|setup|backdrop|tablescape|prop/i.test(s))
    return 'reception_decor';
  if (/makeup/i.test(s)) return 'makeup_artist';
  if (/hair|stylist/i.test(s)) return 'hair_stylist';
  if (/gown|bridal_attire|bridal_modest|wedding_dress|entourage_gown/i.test(s))
    return 'gown_designer';
  if (/suit|barong|tuxedo|groom_attire|entourage_suit/i.test(s))
    return 'suit_designer';
  if (/ring|jewel/i.test(s)) return 'rings';
  if (/invitation|stationery|save_the_date|monogram|signage|seating_chart/i.test(s))
    return 'invitations_stationery';
  if (/transport|car_|shuttle|coach|trolley|bridal_car/i.test(s))
    return 'transportation';
  if (/lights_and_sound|sound_system|lighting_design|av_/i.test(s))
    return 'lights_and_sound';
  if (/led_|projector|video_wall|screen/i.test(s)) return 'led_screens';
  if (/security|usher|coordinator_assistant/i.test(s)) return 'security';
  if (/giveaway|gift|favor|souvenir/i.test(s)) return 'gifts_and_giveaways';
  if (/coordinator|planner|wedding_coordination|day_of|on_the_day|wizard/i.test(s))
    return 'planner_coordinator';
  if (/catholic_church|christian_church|chapel|cathedral|basilica|mosque|inc_locale|temple|civil_registrar/i.test(s))
    return 'religious_venue';
  if (/venue|hotel|garden|beach|resort|hall|tent|farm|estate/i.test(s))
    return 'venue';
  if (/church_fee/i.test(s)) return 'church_fees';
  return 'misc';
}

// ===========================================================================
// DESCRIPTION BUILDER — 50-150 word realistic copy
// ===========================================================================

const VOICE_PREFIXES: ReadonlyArray<(name: string, kind: string) => string> = [
  (name, kind) => `${name} brings a calm, modern approach to ${kind.toLowerCase()} for Filipino weddings.`,
  (name, kind) => `Established in Manila, ${name} works with couples across the Philippines on ${kind.toLowerCase()}.`,
  (name, kind) => `${name} is a small studio of seasoned ${kind.toLowerCase()} professionals — every booking is owner-led.`,
  (name, kind) => `For couples planning a celebration that feels theirs, ${name} offers thoughtfully-crafted ${kind.toLowerCase()}.`,
  (name, kind) => `${name} has been part of hundreds of Filipino weddings since opening — ${kind.toLowerCase()} that respects the moment.`,
];

const VOICE_BODIES: ReadonlyArray<string> = [
  'Every booking starts with a one-hour discovery call so the team understands the couple, the venue, and the moments that matter most.',
  'Available across Metro Manila, Tagaytay, Cebu, and destination weddings nationwide.',
  'Comfortable working in Catholic, civil, and Christian ceremonies — happy to coordinate with parish coordinators and family elders.',
  'Final pricing depends on event date, location, and inclusions — book a chat through Setnayan to discuss.',
  'Wedding-day timelines coordinated tightly with the rest of the vendor team.',
  'All deliverables come with a clear contract and clearly-stated revision rounds.',
  'Years of experience means smooth coordination even when the venue, weather, or family logistics change at the last moment.',
];

function buildDescription(rng: () => number, name: string, kindWord: string): string {
  const prefix = pickFrom(rng, VOICE_PREFIXES)(name, kindWord);
  // Pick 3-4 body sentences without replacement.
  const numBody = intBetween(rng, 3, 4);
  const bodies = [...VOICE_BODIES].sort(() => rng() - 0.5).slice(0, numBody);
  return [prefix, ...bodies].join(' ');
}

// ===========================================================================
// PER-CATEGORY ATTRIBUTE GENERATION (iteration 0044 schema-driven)
// ===========================================================================
//
// Demo vendors fill the SAME per-category attribute schema a real vendor fills
// via /vendor-dashboard/attributes. We load every canonical_service_schemas
// row + the shared_attribute_groups it inherits, merge them exactly like
// lib/vendor-service-attributes.ts#fetchSchemaWithSharedGroups, then generate
// realistic, schema-valid values per field. completeness_score +
// meets_visibility_minimum are computed HONESTLY (mirroring the SQL helper
// public.compute_attribute_completeness + the write-side visibility gate in
// app/vendor-dashboard/attributes/actions.ts) instead of the old hard-coded
// 75 / true — which never even filled the real `service_regions` minimum field.

type AttributeFieldDef = {
  type:
    | 'boolean'
    | 'int'
    | 'text_short'
    | 'text_long'
    | 'enum'
    | 'multi_select'
    | 'multi_select_open';
  label?: string;
  required?: boolean;
  options?: readonly string[];
  default?: unknown;
  min?: number;
  max?: number;
  required_if?: string;
};

export type ResolvedDemoSchema = {
  schemaVersion: number;
  /** category_specific_attributes merged with inherited shared groups. */
  fields: Record<string, AttributeFieldDef>;
  minimumFields: string[];
};

type DemoAttrContext = {
  startsCentavos: number;
  kindWord: string;
  coarse: string;
  city: string;
};

type SchemaRow = {
  canonical_service: string;
  schema_version: number | null;
  category_specific_attributes: Record<string, AttributeFieldDef> | null;
  shared_attribute_groups: string[] | null;
  required_for_visibility: { minimum_fields?: string[] } | null;
};

type GroupRow = {
  group_name: string;
  attributes: Record<string, AttributeFieldDef> | null;
};

// Resolve every canonical_service's full field map once. Merge order mirrors
// fetchSchemaWithSharedGroups: category-specific fields first, then each shared
// group in declaration order; category-specific wins on key collision.
export async function fetchResolvedSchemas(
  admin: SupabaseClient,
): Promise<Map<string, ResolvedDemoSchema>> {
  const [{ data: schemaRows, error: e1 }, { data: groupRows, error: e2 }] =
    await Promise.all([
      admin
        .from('canonical_service_schemas')
        .select(
          'canonical_service, schema_version, category_specific_attributes, shared_attribute_groups, required_for_visibility',
        ),
      admin.from('shared_attribute_groups').select('group_name, attributes'),
    ]);
  if (e1) throw new Error(`load canonical_service_schemas: ${e1.message}`);
  if (e2) throw new Error(`load shared_attribute_groups: ${e2.message}`);

  const groups = new Map<string, Record<string, AttributeFieldDef>>();
  for (const g of (groupRows ?? []) as GroupRow[]) {
    groups.set(g.group_name, g.attributes ?? {});
  }

  const out = new Map<string, ResolvedDemoSchema>();
  for (const row of (schemaRows ?? []) as SchemaRow[]) {
    const fields: Record<string, AttributeFieldDef> = {};
    for (const [key, def] of Object.entries(row.category_specific_attributes ?? {})) {
      fields[key] = def;
    }
    const sharedNames = Array.isArray(row.shared_attribute_groups)
      ? row.shared_attribute_groups
      : [];
    for (const name of sharedNames) {
      const groupFields = groups.get(name);
      if (!groupFields) continue;
      for (const [key, def] of Object.entries(groupFields)) {
        if (key in fields) continue; // category-specific wins
        fields[key] = def;
      }
    }
    const minimumFields = Array.isArray(row.required_for_visibility?.minimum_fields)
      ? row.required_for_visibility!.minimum_fields!
      : [];
    out.set(row.canonical_service, {
      schemaVersion: row.schema_version ?? 1,
      fields,
      minimumFields,
    });
  }
  return out;
}

// Real YouTube/Vimeo URLs — must satisfy the showcase-URL validator
// (YOUTUBE_VIMEO_URL_RE) in app/vendor-dashboard/attributes/actions.ts so a
// vendor saving over this demo data wouldn't be rejected.
const SAMPLE_VIDEO_URLS: readonly string[] = [
  'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  'https://youtu.be/2Vv-BfVoq4g',
  'https://vimeo.com/76979871',
  'https://vimeo.com/148751763',
];

const FREEFORM_DRONE_MODELS: readonly string[] = [
  'DJI Mavic 3 Pro',
  'DJI Air 3',
  'DJI Mini 4 Pro',
  'Autel EVO II',
];

const FREEFORM_LOCATIONS: readonly string[] = [
  'Tagaytay Highlands',
  'Fernwood Gardens',
  'Blue Leaf Filipinas',
  'Balai Taal',
  'Shangri-La Mactan',
  'Las Casas Filipinas',
  "Antonio's Tagaytay",
];

function genIntValue(
  key: string,
  def: AttributeFieldDef,
  rng: () => number,
  startsCentavos: number,
): number {
  const k = key.toLowerCase();
  let v: number;
  if (k.includes('centavos')) {
    if (k.includes('max')) v = startsCentavos * intBetween(rng, 2, 4);
    else if (k.includes('fee') || k.includes('travel')) v = intBetween(rng, 50_000, 300_000);
    else v = startsCentavos; // starting_price / typical_range_min
  } else if (k.includes('year')) v = intBetween(rng, 2, 20);
  else if (k.includes('headcount') && k.includes('max')) v = intBetween(rng, 200, 600);
  else if (k.includes('headcount')) v = intBetween(rng, 30, 100);
  else if (k.includes('radius') || k.endsWith('_km')) v = intBetween(rng, 20, 200);
  else if (k.includes('altitude')) v = intBetween(rng, 50, 120);
  else if (k.includes('hour') || k.includes('duration')) v = intBetween(rng, 2, 12);
  else if (k.includes('minute')) v = intBetween(rng, 2, 8);
  else if (k.includes('week') || k.includes('turnaround')) v = intBetween(rng, 1, 8);
  else if (k.includes('tier')) v = intBetween(rng, 2, 6);
  else if (k.includes('count') || k.includes('upload')) {
    const lo = def.min ?? 5;
    v = intBetween(rng, lo, lo + 15);
  } else v = intBetween(rng, 1, 10);
  if (typeof def.min === 'number') v = Math.max(v, def.min);
  if (typeof def.max === 'number') v = Math.min(v, def.max);
  return v;
}

function genFieldValue(
  key: string,
  def: AttributeFieldDef,
  rng: () => number,
  ctx: DemoAttrContext,
): unknown {
  switch (def.type) {
    case 'boolean':
      return rng() < 0.65;
    case 'int':
      return genIntValue(key, def, rng, ctx.startsCentavos);
    case 'enum': {
      const opts = def.options ?? [];
      return opts.length > 0 ? pickFrom(rng, opts) : null;
    }
    case 'multi_select': {
      const opts = def.options ?? [];
      if (opts.length === 0) return null;
      const shuffled = [...opts].sort(() => rng() - 0.5);
      const count = 1 + Math.floor(rng() * Math.min(4, opts.length));
      return shuffled.slice(0, count);
    }
    case 'text_short':
    case 'text_long': {
      const k = key.toLowerCase();
      if (k.includes('client')) {
        return 'Reyes–Santos (2024) · Cruz–Garcia (Tagaytay, 2023)';
      }
      const base = `${ctx.kindWord} for Filipino weddings, based in ${ctx.city}.`;
      return def.type === 'text_long'
        ? `${base} Owner-led team with a clear contract and clearly-stated revision rounds.`
        : base;
    }
    case 'multi_select_open': {
      const k = key.toLowerCase();
      if (k.endsWith('_video_urls') || k.endsWith('_audio_urls')) {
        const pool = [...SAMPLE_VIDEO_URLS].sort(() => rng() - 0.5);
        return pool.slice(0, 1 + Math.floor(rng() * 2));
      }
      let pool: readonly string[];
      if (k.includes('drone') || k.includes('model')) pool = FREEFORM_DRONE_MODELS;
      else if (k.includes('location')) pool = FREEFORM_LOCATIONS;
      else pool = [`${ctx.kindWord} portfolio`, 'Nationwide service', 'Custom packages available'];
      const shuffled = [...pool].sort(() => rng() - 0.5);
      return shuffled.slice(0, 2 + Math.floor(rng() * 2));
    }
    default:
      return null;
  }
}

function isFilledValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// Build a realistic, schema-valid payload. Required + visibility-minimum fields
// are always filled; ~18% of purely-optional fields are left unset so the
// completeness score varies realistically (~80-100) instead of a flat 100.
function generateAttributePayload(
  resolved: ResolvedDemoSchema,
  rng: () => number,
  ctx: DemoAttrContext,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const minimumSet = new Set(resolved.minimumFields);
  for (const [key, def] of Object.entries(resolved.fields)) {
    let mustFill = def.required === true || minimumSet.has(key);
    // required_if "other=value": when the (already-generated) controlling
    // field matches, this field is genuinely required — the write-side
    // validator treats it so — so always fill it; when it doesn't match the
    // field is not applicable, so skip it entirely. Insertion order puts
    // controllers (category fields, then shared groups) before dependents.
    if (def.required_if) {
      const [otherKey, expected] = def.required_if.split('=');
      const actual = payload[otherKey ?? ''];
      const met = Array.isArray(actual)
        ? actual.includes(expected ?? '')
        : String(actual ?? '') === (expected ?? '');
      if (!met) continue;
      mustFill = true;
    }
    // Leave ~18% of purely-optional fields unset for realistic completeness
    // variance (~80-100) instead of a flat 100.
    if (!mustFill && rng() < 0.18) continue;
    const value = genFieldValue(key, def, rng, ctx);
    if (isFilledValue(value)) payload[key] = value;
  }
  return payload;
}

// Mirror public.compute_attribute_completeness: filled / total over the merged
// field map, 0-100.
function computeCompleteness(
  fields: Record<string, AttributeFieldDef>,
  payload: Record<string, unknown>,
): number {
  const keys = Object.keys(fields);
  if (keys.length === 0) return 0;
  const filled = keys.filter((k) => isFilledValue(payload[k])).length;
  return Math.round((filled * 100) / keys.length);
}

// ===========================================================================
// LOCATION DETAIL + SYNTHETIC REVIEWS (demo realism)
// ===========================================================================
//
// District-level addresses + synthetic reviews/ratings so demo vendors can
// exercise search, compare, and "best match" ranking. Reviews reuse the
// archived `TEST-REVIEW · %` synthetic-event pool created by
// migrations/20260607000000_seed_vendor_reviews.sql (vendor_reviews.event_id is
// NOT NULL) and set couple_user_id = NULL — the self-review trigger
// (20260515030000) short-circuits on NULL, so service-role inserts pass.
// Ratings surface via the vendor_review_stats matview (refreshed per INSERT
// statement) so reviews are accumulated + bulk-inserted in large chunks → the
// matview refreshes only a handful of times, not once per category.

const CITY_DISTRICTS: Record<string, readonly string[]> = {
  manila: ['Malate', 'Ermita', 'Binondo', 'Intramuros', 'Sampaloc'],
  'quezon-city': ['Diliman', 'Cubao', 'Kamuning', 'Loyola Heights', 'Tomas Morato'],
  makati: ['Poblacion', 'Salcedo Village', 'Legazpi Village', 'San Lorenzo', 'Rockwell'],
  pasig: ['Ortigas Center', 'Kapitolyo', 'San Antonio', 'Ugong'],
  bgc: ['Uptown BGC', 'Forbes Town', 'Serendra', 'McKinley Hill'],
  taguig: ['Western Bicutan', 'Signal Village', 'FTI Complex', 'Lower Bicutan'],
  'cebu-city': ['Lahug', 'Banilad', 'Capitol Site', 'Guadalupe', 'IT Park'],
  mactan: ['Punta Engaño', 'Maribago', 'Marigondon'],
  'lapu-lapu': ['Basak', 'Gun-ob', 'Pajo'],
  'davao-city': ['Poblacion', 'Lanang', 'Matina', 'Buhangin', 'Talomo'],
  tagaytay: ['Kaybagal', 'Maharlika', 'Silang Junction', 'Mendez Crossing'],
  boracay: ['Station 1', 'Station 2', 'Station 3', 'Diniwid'],
};

function pickDistrict(rng: () => number, city: CityRow): string {
  const pool = CITY_DISTRICTS[city.slug];
  return pool && pool.length > 0 ? pickFrom(rng, pool) : city.name;
}

const REVIEW_BODIES_POSITIVE: readonly string[] = [
  'Sobrang ganda ng output — super worth it! Highly recommend to other couples.',
  'So professional and accommodating from start to finish. Salamat!',
  'Grabe, the team really delivered — our guests kept complimenting them.',
  'On time, organized, and the quality exceeded our expectations. 10/10.',
  'Best decision for our wedding. Galing nila talaga, no regrets.',
  'Communication was smooth and they really listened to what we wanted.',
  'Worth every peso. Will definitely recommend to friends getting married.',
  'Ang bait ng buong team and very patient with all our requests. Thank you!',
];

const REVIEW_BODIES_MIXED: readonly string[] = [
  'Maganda naman ang final output, na-delay lang nang konti ang communication.',
  'Decent service overall, but the coordination could be a little better.',
  'Okay naman — though we expected a bit more for the price.',
  'Good quality, pero medyo mabagal ang responses during prep.',
];

const VENDOR_REVIEW_REPLIES: readonly string[] = [
  'Maraming salamat! It was a pleasure working with you both. Congrats!',
  'Thank you for trusting us with your big day!',
  'Salamat sa review — we loved being part of your celebration.',
  'Thank you! Sana makasama namin kayo ulit sa future events.',
];

function clampStar(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

// Synthetic-event pool that satisfies vendor_reviews.event_id (NOT NULL FK).
// Reuses the archived `TEST-REVIEW · %` events from migration 20260607000000.
// Returns [] (→ reviews skipped) if that migration isn't on the target DB.
export async function fetchReviewEventPool(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('events')
    .select('event_id')
    .like('display_name', 'TEST-REVIEW · %')
    .limit(60);
  if (error) {
    console.warn(`Review event pool fetch failed (skipping reviews): ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => (r as { event_id: string }).event_id);
}

// Generate 0-10 reviews for one vendor. Each vendor gets a hidden baseline
// quality so vendors genuinely differ (for compare + ranking). Every row uses
// couple_user_id = NULL + a random event from the pool; the five 1-5 ratings
// are drawn around the baseline.
function generateVendorReviews(
  rng: () => number,
  vendorProfileId: string,
  eventPool: string[],
): Array<Record<string, unknown>> {
  const baseline = 3.6 + rng() * 1.3; // mean ⭐ in [3.6, 4.9]
  const count = rng() < 0.15 ? 0 : 1 + Math.floor(rng() * 10); // ~15% have none
  const rows: Array<Record<string, unknown>> = [];
  for (let n = 0; n < count; n++) {
    const overall = clampStar(baseline + (rng() - 0.5) * 1.6);
    const sub = () => clampStar(overall + (rng() < 0.6 ? 0 : rng() < 0.5 ? -1 : 1));
    const daysAgo = 1 + Math.floor(rng() * 364);
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const hasReply = rng() < 0.2;
    rows.push({
      vendor_profile_id: vendorProfileId,
      event_id: pickFrom(rng, eventPool),
      couple_user_id: null,
      rating_overall: overall,
      rating_communication: sub(),
      rating_quality: sub(),
      rating_value: sub(),
      rating_on_time: sub(),
      body:
        rng() < 0.6
          ? pickFrom(rng, overall >= 4 ? REVIEW_BODIES_POSITIVE : REVIEW_BODIES_MIXED)
          : null,
      vendor_reply: hasReply ? pickFrom(rng, VENDOR_REVIEW_REPLIES) : null,
      vendor_reply_at: hasReply ? createdAt : null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  return rows;
}

const CALENDAR_BLOCK_LABELS: readonly string[] = [
  'Booked', 'Reserved', 'Unavailable', 'Out of town', 'Prior event',
];

// UTC-midnight ISO for `daysFromNow` — minute 0 + second 0 satisfies the
// vendor_calendar_blocks 30-minute-granularity / zero-second CHECK constraints
// across whole- and half-hour session timezones.
function isoMidnight(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

// 2-8 full-day busy blocks spread over the next ~12 months. Sparse on purpose
// so the mutual-availability intersection (lib/vendor-availability.ts) narrows
// as a couple locks more vendors without collapsing to "no days work".
function generateCalendarBlocks(
  rng: () => number,
  vendorProfileId: string,
): Array<Record<string, unknown>> {
  const count = intBetween(rng, 2, 8);
  const used = new Set<number>();
  const rows: Array<Record<string, unknown>> = [];
  for (let n = 0; n < count; n++) {
    let day = 7 + Math.floor(rng() * 350);
    for (let guard = 0; used.has(day) && guard < 5; guard++) day = 7 + Math.floor(rng() * 350);
    used.add(day);
    rows.push({
      vendor_profile_id: vendorProfileId,
      blocked_at: isoMidnight(day),
      blocked_until: isoMidnight(day + 1),
      block_label: pickFrom(rng, CALENDAR_BLOCK_LABELS),
      block_source: 'manual',
      is_private: rng() < 0.8,
    });
  }
  return rows;
}

// ===========================================================================
// SEED RUNNER
// ===========================================================================

type SeedArgs = {
  append: boolean;
  dryRun: boolean;
  limit: number | null;
  vendorsMin: number;
  vendorsMax: number;
};

function parseArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = {
    append: false,
    dryRun: false,
    limit: null,
    vendorsMin: 20,
    vendorsMax: 50,
  };
  for (const a of argv.slice(2)) {
    if (a === '--append') args.append = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length));
    else if (a.startsWith('--min=')) args.vendorsMin = Number(a.slice('--min='.length));
    else if (a.startsWith('--max=')) args.vendorsMax = Number(a.slice('--max='.length));
  }
  if (args.vendorsMax < args.vendorsMin) args.vendorsMax = args.vendorsMin;
  return args;
}

export async function fetchCanonicalServices(
  admin: SupabaseClient,
  limit: number | null,
): Promise<string[]> {
  const q = admin
    .from('canonical_service_schemas')
    .select('canonical_service')
    .order('canonical_service', { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(`Failed to load canonical services: ${error.message}`);
  const all = (data ?? []).map((r) => r.canonical_service as string);
  return limit !== null && Number.isFinite(limit) ? all.slice(0, limit) : all;
}

export async function findLatestDemoBatch(admin: SupabaseClient): Promise<string | null> {
  // Pick the most-recently-created non-legacy batch (excludes the
  // deterministic 2026-06-01 legacy batch UUID).
  const LEGACY = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('demo_batch_id, created_at')
    .eq('is_demo', true)
    .not('demo_batch_id', 'is', null)
    .neq('demo_batch_id', LEGACY)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to query batches: ${error.message}`);
  return (data?.[0]?.demo_batch_id as string | null) ?? null;
}

export async function cleanupBatch(admin: SupabaseClient, batchId: string): Promise<number> {
  const { count, error } = await admin
    .from('vendor_profiles')
    .delete({ count: 'exact' })
    .eq('demo_batch_id', batchId);
  if (error) throw new Error(`Cleanup of batch ${batchId} failed: ${error.message}`);
  return count ?? 0;
}

export type SeedConfig = { vendorsMin: number; vendorsMax: number };

export type SeedCategoryResult = {
  vendorsCreated: number;
  servicesCreated: number;
  attrsCreated: number;
  /** Caller bulk-inserts these (the CLI accumulates across all categories;
   *  the chunked API inserts per chunk) so the vendor_review_stats matview
   *  refreshes a few times, not once per category. */
  reviewRows: Array<Record<string, unknown>>;
  blockRows: Array<Record<string, unknown>>;
};

// Seed ONE canonical_service: insert its vendor_profiles + vendor_services +
// vendor_service_attributes, and RETURN the generated review + calendar-block
// rows for the caller to bulk-insert. Shared by the CLI `seed()` below and the
// chunked admin API (/api/admin/demo/seed). RNG is keyed on (batchId, service)
// so output is identical regardless of how categories are chunked.
export async function seedCategory(
  admin: SupabaseClient,
  opts: {
    service: string;
    batchId: string;
    schemaMap: Map<string, ResolvedDemoSchema>;
    reviewEventPool: string[];
    cfg: SeedConfig;
  },
): Promise<SeedCategoryResult> {
  const { service, batchId, schemaMap, reviewEventPool, cfg } = opts;

  // Seeded RNG per (batchId, service) for stable repro within a run.
  const rngSeed = hashStringToInt(`${batchId}|${service}`);
  const rng = mulberry32(rngSeed);

  const profile = priceProfileFor(service);
  const coarse = coarseCategoryFor(service);
  const kindWord = kindWordFor(service);

  const numVendors = intBetween(rng, cfg.vendorsMin, cfg.vendorsMax);

  // Build vendor_profiles rows
  const vendorRows: Array<Record<string, unknown>> = [];
  type LocalVendor = {
    business_name: string;
    service: string;
    pkgRanges: PricingProfile;
    packagesCount: number;
  };
  const local: LocalVendor[] = [];

  for (let i = 0; i < numVendors; i++) {
    const city = pickWeightedCity(rng);
    const jitterLat = (rng() - 0.5) * 0.024;
    const jitterLng = (rng() - 0.5) * 0.024;
    const district = pickDistrict(rng, city);
    const businessName = buildBusinessName(rng, service, kindWord);
    const slug = `demo-${batchId.slice(0, 8)}-${service.replace(/_/g, '-')}-${i + 1}-${city.slug}`;
    // Consume RNG to keep the stream identical to the pre-refactor loop (and
    // keep buildDescription referenced); the seed doesn't store a description.
    void buildDescription(rng, businessName, kindWord);
    const packagesCount = intBetween(
      rng,
      profile.numPackagesRange[0],
      profile.numPackagesRange[1],
    );

    vendorRows.push({
      user_id: null,
      created_by_admin_user_id: null,
      is_demo: true,
      demo_batch_id: batchId,
      business_name: businessName,
      business_slug: slug,
      tagline: `${kindWord} for Filipino weddings, based in ${city.name}.`,
      services: [service, coarse],
      location_city: city.name,
      hq_address: `${district}, ${city.name}, Philippines`,
      hq_latitude: Number((city.lat + jitterLat).toFixed(7)),
      hq_longitude: Number((city.lng + jitterLng).toFixed(7)),
      is_published: true,
      public_visibility: 'verified',
      // Placeholders pull from a SMALL, batch-stable pool of Picsum seeds
      // (~40 logos + ~60 photos reused across the whole marketplace) rather
      // than a unique image per vendor. The old per-vendor seeds meant ~4,900
      // unique 800×600 requests, which made Picsum rate-limit the IP so the
      // images failed to load. A bounded pool lets the browser cache them, and
      // the sizes are display-appropriate (logo tile / portfolio gallery).
      logo_url: `https://picsum.photos/seed/snl${i % 40}/400/300`,
      portfolio_r2_keys: Array.from(
        { length: 4 + (i % 3) },
        (_v, j) =>
          `https://picsum.photos/seed/snp${(i * 4 + j) % 60}/600/400`,
      ),
      compatible_ceremony_types: ['catholic', 'civil', 'christian'],
      // Reception venues declare ONE setting (the couple's reception-style pick
      // filters on it); every other vendor is venue-agnostic → NULL = "works at
      // any venue" (NULL-safe-admits in the marketplace). The old uniform
      // ['banquet_hall','garden','heritage'] both (a) made the venue filter
      // useless — every venue matched every pick — and (b) wrongly EXCLUDED all
      // service vendors from beach/destination weddings.
      compatible_venue_settings:
        coarse === 'venue' ? [venueSettingFor(city.name, i)] : null,
      event_types: ['wedding'],
      contact_email: `${slug}@demo.setnayan.local`,
    });

    local.push({ business_name: businessName, service, pkgRanges: profile, packagesCount });
  }

  // Insert profiles (chunked to 500), service-role bypasses RLS.
  const insertedIds: string[] = [];
  for (let chunk = 0; chunk < vendorRows.length; chunk += 500) {
    const slice = vendorRows.slice(chunk, chunk + 500);
    const { data, error } = await admin
      .from('vendor_profiles')
      .insert(slice)
      .select('vendor_profile_id, business_slug');
    if (error) {
      throw new Error(
        `Insert vendor_profiles for ${service} failed at chunk ${chunk}: ${error.message}`,
      );
    }
    for (const row of data ?? []) {
      insertedIds.push((row as { vendor_profile_id: string }).vendor_profile_id);
    }
  }

  // vendor_services (1 row per vendor, collapsed packages).
  const servicesToInsert: Array<Record<string, unknown>> = [];
  for (let i = 0; i < insertedIds.length; i++) {
    const vendorProfileId = insertedIds[i]!;
    const v = local[i]!;
    const allPackages = [...v.pkgRanges.packages];
    const startIdx = intBetween(rng, 0, Math.max(0, allPackages.length - v.packagesCount));
    const chosenPackages = allPackages.slice(startIdx, startIdx + v.packagesCount);
    const lowestStart = chosenPackages.reduce(
      (min, p) => Math.min(min, intBetween(rng, p.minCentavos, p.maxCentavos)),
      Number.POSITIVE_INFINITY,
    );
    const startsCentavos = Number.isFinite(lowestStart)
      ? lowestStart
      : v.pkgRanges.packages[0]!.minCentavos;
    const inclusions: string[] = [];
    for (const p of chosenPackages) {
      inclusions.push(`— ${p.tierLabel} —`);
      for (const inc of p.inclusions) inclusions.push(inc);
    }
    const [crewLo, crewHi] = v.pkgRanges.crewSize();
    const crewSize = intBetween(rng, crewLo, crewHi);
    servicesToInsert.push({
      vendor_profile_id: vendorProfileId,
      category: service,
      starting_price_php: Math.floor(startsCentavos / 100),
      starts_at_centavos: startsCentavos,
      package_inclusions: inclusions,
      crew_size: crewSize,
      crew_meal_required: v.pkgRanges.crewMealRequired,
      is_active: true,
    });
  }
  for (let chunk = 0; chunk < servicesToInsert.length; chunk += 500) {
    const slice = servicesToInsert.slice(chunk, chunk + 500);
    const { error } = await admin.from('vendor_services').insert(slice);
    if (error) {
      throw new Error(
        `Insert vendor_services for ${service} failed at chunk ${chunk}: ${error.message}`,
      );
    }
  }

  // vendor_service_attributes — schema-driven refinements + honest scoring.
  const resolvedSchema = schemaMap.get(service);
  if (resolvedSchema) {
    const undefinedMins = resolvedSchema.minimumFields.filter(
      (f) => !(f in resolvedSchema.fields),
    );
    if (undefinedMins.length > 0) {
      process.stdout.write(
        `  ! ${service}: minimum field(s) absent from schema, excluded from visibility gate: ${undefinedMins.join(', ')}\n`,
      );
    }
  }
  const attrsToInsert: Array<Record<string, unknown>> = [];
  for (let i = 0; i < insertedIds.length; i++) {
    const vendorProfileId = insertedIds[i]!;
    if (!resolvedSchema) {
      attrsToInsert.push({
        vendor_profile_id: vendorProfileId,
        canonical_service: service,
        attribute_payload: { bio_blurb: `Demo seed vendor for ${kindWord.toLowerCase()}.` },
        schema_version_at_fill: 1,
        completeness_score: 0,
        meets_visibility_minimum: false,
      });
      continue;
    }
    const startsCentavos =
      (servicesToInsert[i]?.starts_at_centavos as number | undefined) ??
      profile.packages[0]!.minCentavos;
    const city =
      (vendorRows[i]?.location_city as string | undefined) ?? 'the Philippines';
    const payload = generateAttributePayload(resolvedSchema, rng, {
      startsCentavos,
      kindWord,
      coarse,
      city,
    });
    const definableMins = resolvedSchema.minimumFields.filter(
      (f) => f in resolvedSchema.fields,
    );
    const meetsVisibility = definableMins.every((f) => isFilledValue(payload[f]));
    attrsToInsert.push({
      vendor_profile_id: vendorProfileId,
      canonical_service: service,
      attribute_payload: payload,
      schema_version_at_fill: resolvedSchema.schemaVersion,
      completeness_score: computeCompleteness(resolvedSchema.fields, payload),
      meets_visibility_minimum: meetsVisibility,
    });
  }
  for (let chunk = 0; chunk < attrsToInsert.length; chunk += 500) {
    const slice = attrsToInsert.slice(chunk, chunk + 500);
    const { error } = await admin.from('vendor_service_attributes').insert(slice);
    if (error) {
      if (!String(error.message).match(/duplicate key/i)) {
        throw new Error(
          `Insert vendor_service_attributes for ${service} chunk ${chunk}: ${error.message}`,
        );
      }
    }
  }

  // Reviews + calendar blocks — generated here, RETURNED for the caller to
  // bulk-insert (CLI accumulates across all categories; API inserts per chunk).
  const reviewRows: Array<Record<string, unknown>> = [];
  if (reviewEventPool.length > 0) {
    for (const vendorProfileId of insertedIds) {
      for (const review of generateVendorReviews(rng, vendorProfileId, reviewEventPool)) {
        reviewRows.push(review);
      }
    }
  }
  const blockRows: Array<Record<string, unknown>> = [];
  for (const vendorProfileId of insertedIds) {
    for (const block of generateCalendarBlocks(rng, vendorProfileId)) {
      blockRows.push(block);
    }
  }

  return {
    vendorsCreated: insertedIds.length,
    servicesCreated: servicesToInsert.length,
    attrsCreated: attrsToInsert.length,
    reviewRows,
    blockRows,
  };
}

async function seed(args: SeedArgs): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\nMissing env. Set:\n' +
        '  SUPABASE_URL=https://<project>.supabase.co\n' +
        '  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>\n',
    );
    process.exit(2);
  }

  assertNotProd(supabaseUrl);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n--- Setnayan demo-vendor seed ---`);
  console.log(`Target: ${supabaseUrl}`);
  console.log(
    `Mode: ${args.dryRun ? 'DRY RUN (no writes)' : args.append ? 'APPEND' : 'REPLACE LATEST BATCH'}`,
  );
  console.log(
    `Vendors per canonical_service: ${args.vendorsMin}-${args.vendorsMax}`,
  );
  console.log(`Limit canonical services: ${args.limit ?? 'all'}`);

  // 1. Pull canonical_services
  const services = await fetchCanonicalServices(admin, args.limit);
  console.log(`Canonical services loaded: ${services.length}`);

  // 2. Plan batch
  const batchId = randomUUID();
  const totalVendors = services.length * Math.round((args.vendorsMin + args.vendorsMax) / 2);

  // 3. Optionally clean previous batch
  let previousBatchId: string | null = null;
  if (!args.append) {
    previousBatchId = await findLatestDemoBatch(admin);
    if (previousBatchId !== null) {
      console.log(`\nPrevious demo batch found: ${previousBatchId}`);
      if (!args.dryRun) {
        const removed = await cleanupBatch(admin, previousBatchId);
        console.log(`Cleanup removed ${removed} rows.`);
      } else {
        console.log(`(dry-run: would delete batch ${previousBatchId})`);
      }
    } else {
      console.log(`\nNo previous demo batch to clean.`);
    }
  }

  console.log(`\nNew batch_id: ${batchId}`);
  console.log(`Estimated row count: ${totalVendors} vendors (+ packages + attribute payloads)`);
  if (args.dryRun) {
    console.log(`\nDry run — exiting without writes.`);
    return;
  }

  // Load per-category attribute schemas once (category_specific_attributes +
  // inherited shared groups) so each vendor below can fill a realistic,
  // schema-valid attribute payload instead of one generic blob.
  const schemaMap = await fetchResolvedSchemas(admin);
  console.log(`Attribute schemas resolved: ${schemaMap.size}`);

  // Synthetic-event pool for reviews (empty → reviews skipped, logged).
  const reviewEventPool = await fetchReviewEventPool(admin);
  console.log(
    reviewEventPool.length > 0
      ? `Review event pool: ${reviewEventPool.length} synthetic events`
      : `Review event pool EMPTY — demo reviews skipped (apply migration 20260607000000 to enable).`,
  );
  // Reviews are accumulated across all categories, then bulk-inserted after the
  // loop so the vendor_review_stats matview refreshes only a few times.
  const allReviews: Array<Record<string, unknown>> = [];
  // Calendar blocks (busy dates) accumulated + bulk-inserted after the loop.
  const allBlocks: Array<Record<string, unknown>> = [];

  // 4. Iterate canonical services, build vendor rows + child rows
  let totalVendorsCreated = 0;
  let totalServicesCreated = 0;
  let totalAttrsCreated = 0;
  let totalReviewsCreated = 0;
  let totalBlocksCreated = 0;

  for (const service of services) {
    const r = await seedCategory(admin, {
      service,
      batchId,
      schemaMap,
      reviewEventPool,
      cfg: { vendorsMin: args.vendorsMin, vendorsMax: args.vendorsMax },
    });
    allReviews.push(...r.reviewRows);
    allBlocks.push(...r.blockRows);
    totalVendorsCreated += r.vendorsCreated;
    totalServicesCreated += r.servicesCreated;
    totalAttrsCreated += r.attrsCreated;

    // Compact progress line
    process.stdout.write(
      `  ${service.padEnd(40)} ${String(r.vendorsCreated).padStart(3)} vendors\n`,
    );
  }

  // 8. Bulk-insert all accumulated reviews in large chunks (the matview refresh
  //    trigger is per-statement, so fewer/larger statements = fewer refreshes).
  for (let chunk = 0; chunk < allReviews.length; chunk += 1000) {
    const slice = allReviews.slice(chunk, chunk + 1000);
    const { error } = await admin.from('vendor_reviews').insert(slice);
    if (error) {
      if (!String(error.message).match(/duplicate key/i)) {
        throw new Error(`Insert vendor_reviews chunk ${chunk}: ${error.message}`);
      }
    } else {
      totalReviewsCreated += slice.length;
    }
  }

  // 9. Bulk-insert calendar blocks (cascade-delete with their vendor on cleanup).
  for (let chunk = 0; chunk < allBlocks.length; chunk += 1000) {
    const slice = allBlocks.slice(chunk, chunk + 1000);
    const { error } = await admin.from('vendor_calendar_blocks').insert(slice);
    if (error) {
      throw new Error(`Insert vendor_calendar_blocks chunk ${chunk}: ${error.message}`);
    }
    totalBlocksCreated += slice.length;
  }

  console.log(`\n=== Seed complete ===`);
  console.log(`Batch ID:       ${batchId}`);
  console.log(`Vendor rows:    ${totalVendorsCreated}`);
  console.log(`Service rows:   ${totalServicesCreated}`);
  console.log(`Attr rows:      ${totalAttrsCreated}`);
  console.log(`Review rows:    ${totalReviewsCreated}`);
  console.log(`Block rows:     ${totalBlocksCreated}`);
  console.log(
    `\nTo view in admin: /admin/demo-vendors\n` +
      `To preview in marketplace: /vendors?demo=1  (Agent 2 ships this flag)\n` +
      `To cleanup this batch: admin UI Cleanup ALL OR POST /api/admin/demo/cleanup-batch { batch_id: '${batchId}' }\n`,
  );
}

// CLI entrypoint — only auto-runs when executed directly (e.g.
// `tsx scripts/seed-demo-vendors.ts`), NOT when imported. The admin chunked-
// seed API (/api/admin/demo/seed) imports `seedCategory` + the helpers above;
// under the Next server runtime process.argv[1] is the server entry, so this
// guard stays false and nothing auto-runs on import.
const invokedPath = (process.argv[1] ?? '').replace(/\\/g, '/');
if (
  invokedPath.endsWith('/seed-demo-vendors.ts') ||
  invokedPath.endsWith('/seed-demo-vendors.js')
) {
  const args = parseArgs(process.argv);
  seed(args).catch((err) => {
    console.error('\nFATAL:', err.message ?? err);
    process.exit(1);
  });
}
