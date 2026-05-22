import type { SupabaseClient } from '@supabase/supabase-js';

import { haversineKm } from './geo';

/**
 * Paired-venue recommendation engine.
 *
 * When a couple has anchored a reception venue (`events.venue_latitude` +
 * `events.venue_longitude` populated by the save-vendor flow), this helper
 * surfaces nearby CEREMONY venues for the matching ceremony_type — closing
 * the "I picked a venue, where's the other half?" planning loop the
 * marketplace couldn't answer in V1.
 *
 * Data source: `public.venue_directory` (V1 read-only seed introduced in
 * migration 20260526000000_venue_directory_seed.sql). Distinct from
 * `vendor_profiles` because directory entries are informational placeholders
 * for couples — no booking, no chat, no user ownership requirement. V1.2
 * venue iteration migrates these rows into a bookable schema with per-
 * location calendars + day-rates.
 *
 * V1 scope:
 *   • Reception → Ceremony direction only. `events.venue_latitude` is
 *     defined as the reception anchor in migration
 *     20260525000000_vendor_hq_geocode_and_event_venue_anchor.sql. Adding
 *     a symmetric ceremony anchor needs a separate migration (V1.2).
 *   • Religious ceremony venue types: `catholic_church`, `christian_church`,
 *     `inc_chapel`, `mosque`, `cultural_site`, plus `civil_registrar` for
 *     civil couples.
 *   • Faith filter uses `compatible_ceremony_types[]` so a Catholic couple
 *     doesn't see a mosque, etc. Empty array = "open to all" (matches the
 *     0043 contract on vendor_profiles).
 *   • Top 3 candidates within 10 km, sorted by distance. Couples wanting
 *     a wider radius browse the Ceremony folder directly.
 */

const PAIRED_VENUE_RADIUS_KM = 10;
const PAIRED_VENUE_LIMIT = 3;

const CEREMONY_VENUE_TYPES = [
  'catholic_church',
  'christian_church',
  'inc_chapel',
  'mosque',
  'cultural_site',
  'civil_registrar',
] as const;

export type PairedVenueCandidate = {
  venue_directory_id: string;
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_latitude: number;
  hq_longitude: number;
  distance_km: number;
  compatible_ceremony_types: string[];
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  hero_image_license: string | null;
  hero_image_source_url: string | null;
  is_in_plan: boolean;
  /** Iteration 0050 (V1 venue directory promoted 2026-05-22 evening) —
   *  optional fields from `20260604000000_venue_directory_reception_support`.
   *  When the column doesn't exist (pre-migration) OR the row is NULL,
   *  these populate as null/false. The Reception card rendering hides the
   *  associated chips when fields are null. */
  day_rate_php_min: number | null;
  day_rate_php_max: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  is_demo: boolean;
  /** `venue_category` ∈ {'ceremony', 'reception', 'combined'} — drives the
   *  "⇄ also hosts ceremony" badge. Null pre-migration; populated post-PR
   *  #324. */
  venue_category: 'ceremony' | 'reception' | 'combined' | null;
};

type Row = {
  venue_directory_id: string;
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_latitude: number | string;
  hq_longitude: number | string;
  compatible_ceremony_types: string[];
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  hero_image_license: string | null;
  hero_image_source_url: string | null;
  // Optional post-Agent-A schema columns.
  day_rate_php_min?: number | string | null;
  day_rate_php_max?: number | string | null;
  capacity_min?: number | string | null;
  capacity_max?: number | string | null;
  is_demo?: boolean | null;
  venue_category?: string | null;
  compatible_venue_settings?: string[] | null;
};

/**
 * Find ceremony venues within `PAIRED_VENUE_RADIUS_KM` of the couple's
 * reception anchor. Returns ≤ `PAIRED_VENUE_LIMIT`, sorted by distance.
 *
 * Faith filter: when `coupleCeremonyType` is set (e.g. 'catholic'), only
 * venues that include it in `compatible_ceremony_types[]` (or have an
 * empty array meaning "open to all") surface. When `null` (anonymous
 * browse or no couple), all faiths surface.
 *
 * Note on civil couples: `coupleCeremonyType === 'civil'` matches
 * `civil_registrar` venues by enum membership. Civil couples who want a
 * combined ceremony + reception at a garden/beach venue would set a
 * different ceremony_type — this helper recommends the courthouse,
 * not the reception venue.
 */
export async function findPairedCeremonyVenues(
  admin: SupabaseClient,
  args: {
    anchorLat: number;
    anchorLng: number;
    coupleCeremonyType: string | null;
    /**
     * If supplied, each returned candidate carries `is_in_plan: true` when
     * the event already has a saved event_vendors row keyed on its
     * source_venue_directory_id. Used by the panel to render the "Add to
     * plan" button in its terminal "Added" state on first paint.
     */
    eventId?: string | null;
  },
): Promise<PairedVenueCandidate[]> {
  // Cast a generous fetch window because PostgREST can't trim by haversine
  // distance — we do the math in-process. The directory caps at ~80 rows
  // total in V1 so a 200-row window covers any radius < global.
  const FETCH_WINDOW = 200;

  const { data, error } = await admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url',
    )
    .in('venue_type', CEREMONY_VENUE_TYPES as readonly string[])
    .limit(FETCH_WINDOW);

  if (error || !data) return [];

  const rows = data as Row[];
  const candidates: PairedVenueCandidate[] = [];

  for (const row of rows) {
    const lat = Number(row.hq_latitude);
    const lng = Number(row.hq_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Faith filter — if couple has a ceremony_type, the venue must declare
    // compatibility OR have an empty array (open to all). Anonymous viewers
    // (coupleCeremonyType === null) skip the filter entirely.
    if (args.coupleCeremonyType !== null) {
      const compat = row.compatible_ceremony_types ?? [];
      if (compat.length > 0 && !compat.includes(args.coupleCeremonyType)) {
        continue;
      }
    }

    const distance = haversineKm(args.anchorLat, args.anchorLng, lat, lng);
    if (distance > PAIRED_VENUE_RADIUS_KM) continue;

    candidates.push({
      venue_directory_id: row.venue_directory_id,
      slug: row.slug,
      name: row.name,
      venue_type: row.venue_type,
      location_city: row.location_city,
      hq_latitude: lat,
      hq_longitude: lng,
      distance_km: distance,
      compatible_ceremony_types: row.compatible_ceremony_types ?? [],
      hero_image_url: row.hero_image_url,
      hero_image_attribution: row.hero_image_attribution,
      hero_image_license: row.hero_image_license,
      hero_image_source_url: row.hero_image_source_url,
      is_in_plan: false,
      day_rate_php_min:
        row.day_rate_php_min !== null && row.day_rate_php_min !== undefined
          ? Number(row.day_rate_php_min)
          : null,
      day_rate_php_max:
        row.day_rate_php_max !== null && row.day_rate_php_max !== undefined
          ? Number(row.day_rate_php_max)
          : null,
      capacity_min:
        row.capacity_min !== null && row.capacity_min !== undefined
          ? Number(row.capacity_min)
          : null,
      capacity_max:
        row.capacity_max !== null && row.capacity_max !== undefined
          ? Number(row.capacity_max)
          : null,
      is_demo: row.is_demo === true,
      venue_category:
        row.venue_category === 'ceremony' ||
        row.venue_category === 'reception' ||
        row.venue_category === 'combined'
          ? row.venue_category
          : null,
    });
  }

  candidates.sort((a, b) => a.distance_km - b.distance_km);
  const topCandidates = candidates.slice(0, PAIRED_VENUE_LIMIT);

  // Resolve already-in-plan state for the surfaced top N (not the full
  // window) so the secondary query stays cheap. Only fires when the
  // viewer has a primary event — anonymous browsers skip this entirely
  // and the AddVenueToPlanButton renders in `canAdd=false` (hidden) state.
  if (args.eventId && topCandidates.length > 0) {
    const ids = topCandidates.map((c) => c.venue_directory_id);
    const { data: savedRows } = await admin
      .from('event_vendors')
      .select('source_venue_directory_id')
      .eq('event_id', args.eventId)
      .in('source_venue_directory_id', ids);
    const savedSet = new Set(
      (savedRows ?? [])
        .map((r) => r.source_venue_directory_id as string | null)
        .filter((x): x is string => x !== null),
    );
    for (const c of topCandidates) {
      if (savedSet.has(c.venue_directory_id)) c.is_in_plan = true;
    }
  }

  return topCandidates;
}

/**
 * All ceremony venues (catholic_church · christian_church · inc_chapel ·
 * mosque · cultural_site · civil_registrar) filtered by the couple's faith.
 * UNLIKE `findPairedCeremonyVenues`, this one is NOT distance-gated — it
 * surfaces the venues directly inside the Ceremony folder of the marketplace
 * regardless of whether a reception anchor exists.
 *
 * When `args.anchorLat/Lng` is provided, each candidate carries a
 * `distance_km` so the section can sort by proximity. Without an anchor,
 * results are alphabetical within each venue_type group.
 *
 * Faith filter mirrors findPairedCeremonyVenues: empty `compatible_ceremony_
 * types[]` = open to all; populated array must include `coupleCeremonyType`.
 */
export async function findCeremonyVenuesByFaith(
  admin: SupabaseClient,
  args: {
    coupleCeremonyType: string | null;
    anchorLat?: number | null;
    anchorLng?: number | null;
    eventId?: string | null;
    /** Cap per venue_type group. Default 6 so the section reads as scannable. */
    perTypeLimit?: number;
  },
): Promise<PairedVenueCandidate[]> {
  const perTypeLimit = args.perTypeLimit ?? 6;
  const hasAnchor =
    typeof args.anchorLat === 'number' &&
    typeof args.anchorLng === 'number' &&
    Number.isFinite(args.anchorLat) &&
    Number.isFinite(args.anchorLng);

  const { data, error } = await admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url',
    )
    .in('venue_type', CEREMONY_VENUE_TYPES as readonly string[])
    .order('name', { ascending: true });

  if (error || !data) return [];

  const rows = data as Row[];
  const candidates: PairedVenueCandidate[] = [];

  for (const row of rows) {
    const lat = Number(row.hq_latitude);
    const lng = Number(row.hq_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    if (args.coupleCeremonyType !== null) {
      const compat = row.compatible_ceremony_types ?? [];
      if (compat.length > 0 && !compat.includes(args.coupleCeremonyType)) {
        continue;
      }
    }

    const distance = hasAnchor
      ? haversineKm(args.anchorLat as number, args.anchorLng as number, lat, lng)
      : 0;

    candidates.push({
      venue_directory_id: row.venue_directory_id,
      slug: row.slug,
      name: row.name,
      venue_type: row.venue_type,
      location_city: row.location_city,
      hq_latitude: lat,
      hq_longitude: lng,
      distance_km: distance,
      compatible_ceremony_types: row.compatible_ceremony_types ?? [],
      hero_image_url: row.hero_image_url,
      hero_image_attribution: row.hero_image_attribution,
      hero_image_license: row.hero_image_license,
      hero_image_source_url: row.hero_image_source_url,
      is_in_plan: false,
      day_rate_php_min:
        row.day_rate_php_min !== null && row.day_rate_php_min !== undefined
          ? Number(row.day_rate_php_min)
          : null,
      day_rate_php_max:
        row.day_rate_php_max !== null && row.day_rate_php_max !== undefined
          ? Number(row.day_rate_php_max)
          : null,
      capacity_min:
        row.capacity_min !== null && row.capacity_min !== undefined
          ? Number(row.capacity_min)
          : null,
      capacity_max:
        row.capacity_max !== null && row.capacity_max !== undefined
          ? Number(row.capacity_max)
          : null,
      is_demo: row.is_demo === true,
      venue_category:
        row.venue_category === 'ceremony' ||
        row.venue_category === 'reception' ||
        row.venue_category === 'combined'
          ? row.venue_category
          : null,
    });
  }

  // Bucket by venue_type, sort each bucket, then flatten.
  const buckets = new Map<string, PairedVenueCandidate[]>();
  for (const c of candidates) {
    const arr = buckets.get(c.venue_type) ?? [];
    arr.push(c);
    buckets.set(c.venue_type, arr);
  }
  const trimmed: PairedVenueCandidate[] = [];
  for (const bucket of buckets.values()) {
    if (hasAnchor) {
      bucket.sort((a, b) => a.distance_km - b.distance_km);
    }
    trimmed.push(...bucket.slice(0, perTypeLimit));
  }

  // Resolve in-plan state in one round-trip for the trimmed surface.
  if (args.eventId && trimmed.length > 0) {
    const ids = trimmed.map((c) => c.venue_directory_id);
    const { data: savedRows } = await admin
      .from('event_vendors')
      .select('source_venue_directory_id')
      .eq('event_id', args.eventId)
      .in('source_venue_directory_id', ids);
    const savedSet = new Set(
      (savedRows ?? [])
        .map((r) => r.source_venue_directory_id as string | null)
        .filter((x): x is string => x !== null),
    );
    for (const c of trimmed) {
      if (savedSet.has(c.venue_directory_id)) c.is_in_plan = true;
    }
  }

  return trimmed;
}

/**
 * Reception venue_directory_type values (6 reception venues + civil_registrar
 * which appears in both ceremony and reception folders per the directory
 * enum locked 2026-05-26).
 *
 * Mirrors CEREMONY_VENUE_TYPES so the Reception folder surface (introduced
 * 2026-05-22 — CLAUDE.md row "Fix: Reception folder now respects host's
 * events.venue_setting" follow-up) reads real `venue_directory` rows.
 *
 * NB: the events.venue_setting enum uses `banquet_hall` + `destination`
 * while venue_directory.venue_type uses `hotel_ballroom` + `destination_resort`.
 * The mapping lives in `venueSettingToDirectoryType()` below.
 */
const RECEPTION_VENUE_TYPES = [
  'hotel_ballroom',
  'garden',
  'beach',
  'destination_resort',
  'heritage',
  'outdoor_tent',
] as const;

/**
 * Map a host's `events.venue_setting` enum value to the corresponding
 * `venue_directory.venue_type` enum value. The two enums diverged at seed
 * time (events.venue_setting was locked 2026-05-19 iteration 0043; the
 * directory enum landed 2026-05-26).
 *
 * Returns `null` when the input doesn't map to any reception venue_type —
 * either an unknown value or a `civil_registrar` setting which the
 * Ceremony folder already covers.
 */
export function venueSettingToDirectoryType(setting: string): string | null {
  switch (setting) {
    case 'banquet_hall':
      return 'hotel_ballroom';
    case 'garden':
      return 'garden';
    case 'beach':
      return 'beach';
    case 'destination':
      return 'destination_resort';
    case 'heritage':
      return 'heritage';
    case 'outdoor_tent':
      return 'outdoor_tent';
    // civil_registrar appears on Ceremony, not Reception — fall through.
    default:
      return null;
  }
}

/**
 * Surface reception venues from `venue_directory`. Mirrors
 * `findCeremonyVenuesByFaith` but scoped to reception venue_types and
 * filtered by the host's `events.venue_setting` instead of `ceremony_type`.
 *
 * When `hostDirectoryType` is set (host has a venue_setting picked AND the
 * `?venue` filter is default-on per Task #48 / PR #311), the result is
 * narrowed to that one venue_type — e.g. a host with `venue_setting='banquet_hall'`
 * sees only `hotel_ballroom` rows. The Ceremony surface keeps the 6 facet
 * cards above for "show me other settings" escape.
 *
 * When `hostDirectoryType` is null (anonymous browse OR `?venue=0` opt-out),
 * all 6 reception venue_types render — keeping the broad catalog view honest.
 *
 * `is_in_plan` resolves identically to the Ceremony helper via a single
 * `event_vendors` lookup keyed on `source_venue_directory_id`.
 */
export async function findReceptionVenuesByVenueSetting(
  admin: SupabaseClient,
  args: {
    /**
     * The `venue_directory.venue_type` value to filter to. Resolve via
     * `venueSettingToDirectoryType(events.venue_setting)`. When null, all
     * 6 reception venue_types surface.
     */
    hostDirectoryType: string | null;
    /** Used to compute `distance_km` from the host's reception anchor. */
    anchorLat?: number | null;
    anchorLng?: number | null;
    eventId?: string | null;
    /** Cap per venue_type group. Default 6 — matches CeremonyVenuesSection. */
    perTypeLimit?: number;
    /** When true, include rows with `is_demo=TRUE`. Default false: demo
     *  venues stay hidden unless the viewer is an admin in demo mode. */
    includeDemo?: boolean;
  },
): Promise<PairedVenueCandidate[]> {
  const perTypeLimit = args.perTypeLimit ?? 6;
  const hasAnchor =
    typeof args.anchorLat === 'number' &&
    typeof args.anchorLng === 'number' &&
    Number.isFinite(args.anchorLat) &&
    Number.isFinite(args.anchorLng);

  // When the host has picked a venue_setting, narrow the query to that one
  // venue_type. Otherwise pull all 6 reception types so anonymous browsers
  // see the breadth.
  const venueTypes: ReadonlyArray<string> =
    args.hostDirectoryType !== null
      ? [args.hostDirectoryType]
      : (RECEPTION_VENUE_TYPES as ReadonlyArray<string>);

  // SELECT the new schema columns (day_rate_php_*, capacity_*, is_demo,
  // venue_category, compatible_venue_settings) added 2026-05-22 evening by
  // migration 20260604000000_venue_directory_reception_support.sql. Falls
  // back gracefully when the columns don't exist (pre-migration) — the
  // catch path retries with the narrow column set so the section never
  // goes blank.
  const wideColumns =
    'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,'
    + 'compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url,'
    + 'day_rate_php_min,day_rate_php_max,capacity_min,capacity_max,is_demo,venue_category,compatible_venue_settings';
  const narrowColumns =
    'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,'
    + 'compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url';

  let rows: Row[] = [];
  // Default: exclude demo venues unless caller opts in via args.includeDemo.
  const includeDemo = args.includeDemo === true;
  {
    let q = admin
      .from('venue_directory')
      .select(wideColumns)
      .in('venue_type', venueTypes as readonly string[])
      .order('name', { ascending: true });
    if (!includeDemo) {
      // Exclude is_demo=TRUE; the .neq fallback covers NULL is_demo on pre-
      // migration rows by treating NULL as "not demo".
      q = q.or('is_demo.is.null,is_demo.eq.false');
    }
    const { data, error } = await q;
    if (error) {
      if (/day_rate|capacity_|is_demo|venue_category|compatible_venue_settings/i.test(error.message)) {
        // Pre-migration retry — narrow column set, no demo filter (column
        // doesn't exist yet so every row is implicitly non-demo).
        const { data: narrow, error: nerr } = await admin
          .from('venue_directory')
          .select(narrowColumns)
          .in('venue_type', venueTypes as readonly string[])
          .order('name', { ascending: true });
        if (nerr || !narrow) return [];
        rows = narrow as unknown as Row[];
      } else {
        return [];
      }
    } else {
      rows = (data ?? []) as unknown as Row[];
    }
  }

  const candidates: PairedVenueCandidate[] = [];

  for (const row of rows) {
    const lat = Number(row.hq_latitude);
    const lng = Number(row.hq_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const distance = hasAnchor
      ? haversineKm(args.anchorLat as number, args.anchorLng as number, lat, lng)
      : 0;

    candidates.push({
      venue_directory_id: row.venue_directory_id,
      slug: row.slug,
      name: row.name,
      venue_type: row.venue_type,
      location_city: row.location_city,
      hq_latitude: lat,
      hq_longitude: lng,
      distance_km: distance,
      compatible_ceremony_types: row.compatible_ceremony_types ?? [],
      hero_image_url: row.hero_image_url,
      hero_image_attribution: row.hero_image_attribution,
      hero_image_license: row.hero_image_license,
      hero_image_source_url: row.hero_image_source_url,
      is_in_plan: false,
      day_rate_php_min:
        row.day_rate_php_min !== null && row.day_rate_php_min !== undefined
          ? Number(row.day_rate_php_min)
          : null,
      day_rate_php_max:
        row.day_rate_php_max !== null && row.day_rate_php_max !== undefined
          ? Number(row.day_rate_php_max)
          : null,
      capacity_min:
        row.capacity_min !== null && row.capacity_min !== undefined
          ? Number(row.capacity_min)
          : null,
      capacity_max:
        row.capacity_max !== null && row.capacity_max !== undefined
          ? Number(row.capacity_max)
          : null,
      is_demo: row.is_demo === true,
      venue_category:
        row.venue_category === 'ceremony' ||
        row.venue_category === 'reception' ||
        row.venue_category === 'combined'
          ? row.venue_category
          : null,
    });
  }

  // Bucket + per-type cap mirrors Ceremony.
  const buckets = new Map<string, PairedVenueCandidate[]>();
  for (const c of candidates) {
    const arr = buckets.get(c.venue_type) ?? [];
    arr.push(c);
    buckets.set(c.venue_type, arr);
  }
  const trimmed: PairedVenueCandidate[] = [];
  for (const bucket of buckets.values()) {
    if (hasAnchor) {
      bucket.sort((a, b) => a.distance_km - b.distance_km);
    }
    trimmed.push(...bucket.slice(0, perTypeLimit));
  }

  if (args.eventId && trimmed.length > 0) {
    const ids = trimmed.map((c) => c.venue_directory_id);
    const { data: savedRows } = await admin
      .from('event_vendors')
      .select('source_venue_directory_id')
      .eq('event_id', args.eventId)
      .in('source_venue_directory_id', ids);
    const savedSet = new Set(
      (savedRows ?? [])
        .map((r) => r.source_venue_directory_id as string | null)
        .filter((x): x is string => x !== null),
    );
    for (const c of trimmed) {
      if (savedSet.has(c.venue_directory_id)) c.is_in_plan = true;
    }
  }

  return trimmed;
}

/** Human-friendly label for the venue_type chip. */
export function displayVenueType(venueType: string): string {
  switch (venueType) {
    case 'catholic_church':
      return 'Catholic Church';
    case 'christian_church':
      return 'Christian Church';
    case 'inc_chapel':
      return 'INC Chapel';
    case 'mosque':
      return 'Mosque';
    case 'cultural_site':
      return 'Cultural Site';
    case 'civil_registrar':
      return 'Civil Registrar';
    case 'hotel_ballroom':
      return 'Hotel Ballroom';
    case 'garden':
      return 'Garden';
    case 'beach':
      return 'Beach';
    case 'destination_resort':
      return 'Destination Resort';
    case 'heritage':
      return 'Heritage';
    case 'outdoor_tent':
      return 'Outdoor Tent';
    default:
      return venueType;
  }
}

export const PAIRED_VENUE_CONFIG = {
  radiusKm: PAIRED_VENUE_RADIUS_KM,
  limit: PAIRED_VENUE_LIMIT,
} as const;

/**
 * Inverse of `venueSettingToDirectoryType` — given a `venue_directory.venue_type`
 * enum value, returns the marketplace facet key (events.venue_setting enum
 * value). Used by the Reception venue card to declare which filter chip
 * would surface it. Returns null for ceremony-only venue_types
 * (catholic_church etc.) which never reach the Reception section.
 */
export function venueTypeToSetting(venueType: string): string | null {
  switch (venueType) {
    case 'hotel_ballroom':
      return 'banquet_hall';
    case 'garden':
      return 'garden';
    case 'beach':
      return 'beach';
    case 'destination_resort':
      return 'destination';
    case 'heritage':
      return 'heritage';
    case 'outdoor_tent':
      return 'outdoor_tent';
    default:
      return null;
  }
}

/**
 * Reception venue_types that can ALSO host the ceremony back-to-back at
 * the same location. Mirrors the combined-venue badge in the marketplace
 * (CLAUDE.md 2026-05-20 row 470 — "Settings marked ⇄ also hosts ceremony").
 * hotel_ballroom is NOT combined (hotels don't host ceremonies by tradition);
 * the other 5 reception types are combined-capable.
 */
const COMBINED_VENUE_TYPES: ReadonlySet<string> = new Set([
  'garden',
  'beach',
  'destination_resort',
  'heritage',
  'outdoor_tent',
]);

/**
 * Returns true when the venue_type can host ceremony + reception back-to-
 * back at the same location. When the row's `venue_category = 'combined'`
 * is set (post-Agent-A migration), prefer that; otherwise fall back to
 * the venue_type-based map for pre-migration rows.
 */
export function isCombinedVenue(
  venueType: string,
  venueCategory: string | null,
): boolean {
  if (venueCategory === 'combined') return true;
  if (venueCategory === 'reception') return false;
  if (venueCategory === 'ceremony') return false;
  return COMBINED_VENUE_TYPES.has(venueType);
}

/**
 * Format a venue's day-rate range as a short PHP label for the card pricing
 * chip. Day rates are stored as PHP whole pesos (NOT centavos) per
 * migration 20260604000000_venue_directory_reception_support.sql — the
 * field comment notes the alignment with vendor_services.starting_price_php.
 *
 * Returns null when no rate data is set (pre-migration OR row left null);
 * the caller renders the "Inquire for pricing" fallback in that case.
 *
 * Pricing surface posture: venue directory entries are informational V1
 * placeholders (no booking, no couple sign-up gating). Surfacing a
 * starting-from rate gives couples something to budget against.
 */
export function formatVenueDayRate(
  minPhp: number | null,
  maxPhp: number | null,
): string | null {
  if (minPhp === null || !Number.isFinite(minPhp) || minPhp <= 0) return null;
  const formatPeso = (whole: number): string => {
    // Day rates stored as PHP whole pesos, NOT centavos (per migration
    // header doc). Format with thousands separators.
    return '₱' + Math.round(whole).toLocaleString('en-PH');
  };
  if (maxPhp !== null && Number.isFinite(maxPhp) && maxPhp > minPhp) {
    return formatPeso(minPhp) + '–' + formatPeso(maxPhp) + '/day';
  }
  return 'From ' + formatPeso(minPhp) + '/day';
}

/**
 * Format a venue's capacity range as a short label for the card chip.
 * Returns null when no capacity data is set (pre-migration OR row left
 * null).
 */
export function formatVenueCapacity(
  capMin: number | null,
  capMax: number | null,
): string | null {
  if (capMin === null && capMax === null) return null;
  if (capMin !== null && capMax !== null && capMin !== capMax) {
    return capMin.toLocaleString('en-PH') + '–' + capMax.toLocaleString('en-PH') + ' guests';
  }
  const cap = capMin ?? capMax;
  if (cap === null) return null;
  return cap.toLocaleString('en-PH') + ' guests';
}
