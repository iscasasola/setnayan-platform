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

  const { data, error } = await admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url',
    )
    .in('venue_type', venueTypes as readonly string[])
    .order('name', { ascending: true });

  if (error || !data) return [];

  const rows = data as Row[];
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
