/**
 * Concierge Active Wizard · vendor recommendation helper.
 *
 * Iteration 0016 · Phase 2 (Foundation vendor cards). Wraps
 * vendor_market_stats to surface the top-N recommendations for a given
 * canonical_service set, scoped to the event's region + ceremony_type +
 * venue_setting compatibility.
 *
 * UX lock per [[feedback_setnayan_concierge_wizard_ux]] · Cards 02-24
 * vendor-pick variant shows TOP 5 by default · [VIEW MORE] expands
 * inline up to 15 (NO LINKS · no navigation out).
 *
 * Sort chain mirrors the public vendor-grid: ad_rank → review_count →
 * avg_rating_overall → most-recent. Setnayan-Pay-enabled / verified
 * vendors float to the top via ad_rank.
 *
 * Compat filters mirror the marketplace's existing scoring. All are OPTIONAL
 * (omit the arg → that dimension isn't scoped · exact prior behavior):
 *   - `compatible_ceremony_types[]` overlap with event.ceremony_type (`ceremonyType`)
 *   - `compatible_venue_settings[]` overlap with event.venue_setting (`venueSetting`)
 *   - region scope by PSGC code (`region`) · effective region = hq_region, or
 *     regionForCity(location_city) for rows the backfill left NULL · narrowed
 *     in JS after the over-fetch (the 2026-06-04 leaf-match wiring · supersedes
 *     the never-wired "~100km of venue_lat/lon" intent this doc once described)
 *   - event-type scope by `event_types[]` membership (`eventType`)
 *
 * NULL safety (Hybrid · admit-unknown, exclude-known-mismatch): a vendor row
 * with compatible_ceremony_types = NULL means "compatible with all ceremonies"
 * (same OR-clause as the religion-default filter from CLAUDE.md 2026-05-22
 * PR #305). Same for venue, event_types, and effective region.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { r2PublicUrl, R2_BUCKETS } from '@/lib/r2';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import {
  MUSIC_CANONICALS,
  fetchEventSongPickIds,
  fetchVendorSongOverlaps,
} from '@/lib/songs';
import { fetchPreferenceMatches, type PreferenceMatch } from '@/lib/preference-match';
import { regionForCity } from '@/lib/regions';
import { getBatchVendorAvailableDays } from '@/lib/vendor-availability';

/** Single vendor recommendation row · shape consumed by VendorPickCard
 *  AND the new visual VendorPickGridCard. */
export type WizardVendorRec = {
  vendor_profile_id: string;
  business_name: string;
  business_slug: string;
  logo_url: string | null;
  tagline: string | null;
  location_city: string | null;
  avg_rating_overall: number | null;
  review_count: number | null;
  ad_rank: number | null;
  public_visibility: string | null;
  /** PRIORITY 1 hero photo for the grid card · resolved public URL of
   *  the vendor's matching `vendor_services.primary_photo_r2_key`
   *  (picked deterministically · first non-null match against the
   *  canonical_services filter). Null when no service photo is set ·
   *  grid card falls back to `logo_url` then to a monogram initial. */
  primary_photo_url: string | null;
  /** Drives the "Verified by Setnayan" badge + Setnayan Statement copy
   *  on the visual grid card. Values: 'unverified' / 'pending_review' /
   *  'verified' / 'demoted' / 'rejected'. Only 'verified' renders the
   *  badge. Read from `vendor_profiles.verification_state` (separate
   *  column from `public_visibility`). */
  verification_state: string | null;
  /** Hybrid-anonymity reveal timestamp (V2.1 brief amendment #2 ·
   *  2026-05-30 per CLAUDE.md "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED"
   *  row § 1(d) + memory rule
   *  [[project_setnayan_vendor_hybrid_anonymity]]). NULL = vendor's
   *  business_name is hidden in browse + microsite + grid cards;
   *  surfaces render the anonymized taxonomy + city placeholder via
   *  `resolveVendorDisplayName` in lib/vendors.ts. Non-NULL = name
   *  globally revealed (everywhere from then on). DB trigger
   *  `reveal_vendor_name_on_chat` stamps this column on first vendor
   *  chat reply (PR #662 / migration 20260530010000). Pro + Enterprise
   *  subscribers also render the real name unconditionally via the
   *  app-layer `isPaidTier` flag on `resolveVendorDisplayName`. */
  name_revealed_at: string | null;
  /** CLAUDE.md 2026-05-30 refinement row · Bark-format stored
   *  anonymized name like "Manila Wedding Photographer #4218" from
   *  `vendor_profiles.screen_name` (migration `20260714000000`). When
   *  present, `resolveVendorDisplayName` surfaces this stable
   *  identifier instead of computing the legacy "service · city"
   *  placeholder. Pulled in the same vendor_profiles batched read as
   *  verification_state + presentation_pattern + name_revealed_at.
   *  Null = pre-backfill vendor OR venue-exempt vendor where the
   *  generator deliberately skipped (services overlap with
   *  religious_venue + venue); resolver falls back to the legacy
   *  computed placeholder which is fine because venue vendors don't
   *  surface in vendor-pick cards anyway (Card 03 ceremony venue +
   *  Card 02 reception venue land on dedicated venue-directory
   *  surfaces, not wizard vendor picks). */
  screen_name: string | null;
  /** Vendor HQ location · drives the Card 03 ceremony-venue distance
   *  filter (kms from the host's locked reception venue). Pulled from
   *  vendor_market_stats.hq_latitude / hq_longitude. Null when the
   *  vendor profile hasn't set a location · those rows pass through
   *  any distance filter unfiltered (treated as "unknown, don't hide"). */
  hq_latitude: number | null;
  hq_longitude: number | null;
  /** Canonical PSGC region code (NCR / CAR / I…XIII / BARMM / NIR) ·
   *  added 2026-05-24 for Card 02 Reception Venue Region → City cascade.
   *  Backfilled by migration 20260620000000 from `location_city` for the
   *  ~50 most-common PH wedding cities. NULL = region unknown · the
   *  region filter passes them through unfiltered when no region is
   *  picked, hides them when a specific region IS picked (canonical
   *  NULL-safe filter shape · matches the city + distance filters'
   *  treatment of NULL location fields). */
  hq_region: string | null;
  /** Display pattern for the grid tile (V1.1 multi-photo upgrade · 2026-
   *  05-24 owner lock). 'creations' = Pattern A · 2×2 collage of up to
   *  4 vendor_services photos. 'locked' = Pattern B · single-hero
   *  photo (existing behavior). NULL = unclassified → defaults to
   *  single-hero. Per CLAUDE.md decision-log "Vendor presentation
   *  pattern locked" + 02_Specifications/Vendor_Taxonomy_V1_Master.md
   *  § 10. Backfilled by migration 20260623000000 from services[1]. */
  presentation_pattern: 'creations' | 'locked' | null;
  /** Top 3-5 vendor_services photos for Pattern A tile rendering. Only
   *  populated when presentation_pattern === 'creations'; empty array
   *  for Pattern B and for Pattern A vendors with < 2 service photos
   *  (the tile falls back to single-hero in those cases · same UX as
   *  Pattern B). Photo URLs are pre-resolved via r2PublicUrl. */
  services_preview: ReadonlyArray<{
    photo_url: string;
    service_name: string | null;
  }>;
  /** Music compatibility (Vendor_Compatibility_and_Master_Songlist_2026-06-03).
   *  Set ONLY on a music-category query carrying `matchEventId` whose event has
   *  song picks. `song_overlap_count` = how many of the couple's chosen songs
   *  this vendor performs; `song_pick_total` = the couple's pick count;
   *  `match_label` = 'best' (≥90% of the picks) / 'next_best' (<90%). Absent on
   *  non-music / no-pick queries → cards render no cue (degrades gracefully). */
  song_overlap_count?: number;
  song_pick_total?: number;
  match_label?: 'best' | 'next_best';
  /** Layer-B preference match (Vendor_Match_Personalization_2026-06-01 §8/§9).
   *  True when the vendor's `vendor_service_attributes` facet tags overlap the
   *  couple's `event_vendor_preferences` on ≥1 dimension for a shared service.
   *  Drives the "Matches your preference" float + badge + the % match pill's
   *  refinement-fit dimension. `preference_matched_dimensions` = how many of the
   *  couple's expressed dimensions the vendor satisfies. Absent on no-pref /
   *  no-vendor-tag queries — inert until vendor facet-tagging coverage exists
   *  (`vendor_service_attributes` is empty in prod today), so zero regression. */
  preference_matched?: boolean;
  preference_matched_dimensions?: number;
};

type Args = {
  /** Canonical_services array that defines the category set. Reception
   *  venue uses ['venue']; Officiant uses ['officiant']; Photographer
   *  uses ['photographer', 'videographer']; etc. */
  canonicalServices: ReadonlyArray<string>;
  /** events.ceremony_type · null for civil/no-religion events · used to
   *  filter to compatible-ceremony vendors. */
  ceremonyType: string | null;
  /** events.secondary_ceremony_type · set for Mixed/interfaith weddings
   *  (e.g. Catholic + Muslim). When present, vendors compatible with the
   *  primary OR the secondary ceremony match — additive, only ADMITS more,
   *  never excludes. Undefined/null = behaves exactly as before (primary
   *  only). Reliable: same value space as compatible_ceremony_types. */
  secondaryCeremonyType?: string | null;
  /** events.venue_setting · null when not picked yet · used to filter
   *  to compatible-venue vendors. */
  venueSetting: string | null;
  /** Couple's region · PSGC code (NCR / IV-A / VII …). When set, results are
   *  scoped to that region under the Hybrid match contract: a vendor's
   *  EFFECTIVE region — `hq_region`, or `regionForCity(location_city)` for the
   *  demo + legacy rows the 20260620 backfill left NULL — must equal it, EXCEPT
   *  genuinely-unknown-region rows (no hq_region + unrecognized city), which are
   *  admitted so unknown coverage is never hidden. Omit = no region scope
   *  (exact prior behavior). Applied as a post-query JS narrowing, so the fetch
   *  over-reads to keep a full `limit` of in-region rows. */
  region?: string | null;
  /** Couple's event type · `'wedding'` in V1. NULL-safe OR on `event_types[]`:
   *  admits vendors with no declared types (covers all), excludes ones that
   *  declare only OTHER event types (e.g. corporate-only). Omit = no event-type
   *  scope (exact prior behavior). */
  eventType?: string | null;
  /** Couple's guest count · `events.estimated_pax`. When set, a vendor whose
   *  `capacity_max` is below it is dropped (a venue that can't seat the wedding).
   *  Hybrid NULL-safe: a vendor with NULL `capacity_max` — every non-venue, plus
   *  venues that haven't stated capacity — is admitted. `capacity_max` lives on
   *  `vendor_profiles` (not the market_stats view), so it's resolved via a small
   *  candidate-pool lookup after the base fetch. Omit/0 = no pax scope. */
  pax?: number | null;
  /** Couple's FINE reception venue type (`hotel_ballroom` · `events_place` ·
   *  `restaurant` · `garden` · `beach` · `heritage` · `resort`) — the precise
   *  pick the onboarding reception screen captures before it's collapsed to the
   *  coarse `venue_setting` enum at commit. Distinguishes e.g. a hotel ballroom
   *  from an events place (both `banquet_hall` under `venueSetting`). Filters
   *  `vendor_profiles.venue_type` (resolved in the SAME candidate-pool lookup as
   *  capacity). Hybrid NULL-safe: a vendor with NULL `venue_type` is admitted.
   *  Omit = no venue-type scope. */
  venueType?: string | null;
  /** Couple's candidate wedding dates as YYYY-MM-DD keys (the onboarding
   *  "possible dates", or a single committed date). When set, a vendor is kept
   *  only if it's FREE on at least one of them — drops vendors whose
   *  `vendor_calendar_blocks` cover every candidate date. Hybrid + failing-open
   *  (the locked V1 default in lib/vendor-availability): a vendor with NO blocks
   *  is fully available → admitted; so Setnayan always-on services + any vendor
   *  who hasn't marked their calendar pass through. Resolved via the batched
   *  `getBatchVendorAvailableDays` over the candidates' span. Omit/empty = no
   *  schedule scope. */
  availableDateKeys?: ReadonlyArray<string>;
  /** Cap on rows. Default 15 for the legacy list VendorPickCard; the
   *  new visual VendorPickGridCard bumps to 100+ so its 15-per-page
   *  pagination has multiple pages to walk through. */
  limit?: number;
  /** Exclude already-locked event_vendors so the host doesn't see
   *  recommendations that are already on their plan. */
  excludeVendorIds?: ReadonlyArray<string>;
  /** Optional free-text search across business_name + location_city +
   *  tagline. NULL/empty string = no search filter (default rank order
   *  still applies). Used by the grid card's search submit. */
  searchQuery?: string;
  /** The browsing couple's event_id. When set AND the category is a music act,
   *  vendors are re-ranked by how much of the couple's song picks
   *  (`event_song_picks`) they perform, and each row gets a match label. Omit
   *  (or non-music category) → exact prior behavior, no extra reads. */
  matchEventId?: string;
};

/**
 * Top recommendations for a wizard vendor-pick card. Returns an empty
 * array on any query error so the card stays clean rather than partially
 * broken — the VendorPickCard renders a polite-voice empty state when
 * recs is empty (rare · happens for very narrow ceremony_type +
 * venue_setting combos before marketplace inventory grows).
 *
 * The result includes the per-vendor primary service photo + verification
 * state. The visual VendorPickGridCard reads both; the legacy list-only
 * VendorPickCard ignores them.
 */

/** Min/max of YYYY-MM-DD keys → a local-midnight Date span for the calendar
 *  reader (ISO keys sort lexically = chronologically). Null if none parse. */
function dateSpanFromKeys(
  keys: ReadonlyArray<string>,
): { start: Date; end: Date } | null {
  const valid = keys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).slice().sort();
  if (valid.length === 0) return null;
  const toDate = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  };
  return { start: toDate(valid[0]!), end: toDate(valid[valid.length - 1]!) };
}

export async function fetchWizardVendorRecommendations(
  admin: SupabaseClient,
  args: Args,
): Promise<WizardVendorRec[]> {
  const limit = args.limit ?? 15;
  if (args.canonicalServices.length === 0) return [];

  // Music compatibility (Vendor_Compatibility_and_Master_Songlist_2026-06-03):
  // for a music-category query with a couple's event, over-fetch a wider pool so
  // we can re-rank by song overlap (matches float up, never excludes) before
  // trimming to `limit`. Non-music / no-event queries take the exact prior path
  // (fetchLimit === limit · no extra reads).
  const isMusicMatch =
    !!args.matchEventId &&
    args.canonicalServices.some((s) => MUSIC_CANONICALS.has(s));
  // Region scoping narrows in JS after the fetch (effective region needs the
  // location_city fallback SQL can't express), so over-fetch — same trick as
  // the music re-rank — to keep a full `limit` of in-region rows.
  const needsRegionScope = !!args.region;
  const needsPaxScope = !!(args.pax && args.pax > 0);
  const needsVenueTypeScope = !!args.venueType;
  const needsScheduleScope = !!(args.availableDateKeys && args.availableDateKeys.length > 0);
  // Preference matching (Layer-B) over-fetches too, so a facet-matching vendor
  // ranked outside the top-N by ad_rank can still float up. Inert until vendor
  // facet tags exist, so this only widens the read when an event is in context.
  const needsPreferenceMatch = !!args.matchEventId;
  const fetchLimit =
    needsPreferenceMatch ||
    isMusicMatch ||
    needsRegionScope ||
    needsPaxScope ||
    needsVenueTypeScope ||
    needsScheduleScope
      ? Math.max(limit, 100)
      : limit;

  let query = admin
    .from('vendor_market_stats')
    .select(
      'vendor_profile_id,business_name,business_slug,logo_url,tagline,location_city,hq_region,avg_rating_overall,review_count,ad_rank,public_visibility,compatible_ceremony_types,compatible_venue_settings,hq_latitude,hq_longitude',
    )
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .overlaps('services', args.canonicalServices as readonly string[]);

  // Ceremony-type compat · NULL means "compatible with all" so we use
  // an OR clause that admits both NULL-compat vendors and explicit
  // overlaps. Same shape as the religion-default-on filter from
  // CLAUDE.md 2026-05-22 row · PR #305.
  //
  // Mixed/interfaith weddings (CLAUDE.md 2026-06-01) carry BOTH rites in
  // ceremony_type + secondary_ceremony_type (e.g. Catholic + Muslim). A
  // vendor fit for EITHER should match, so we admit the union — additive,
  // only ADMITS more, never excludes. Same value space as
  // compatible_ceremony_types (reliable). When only the primary is set this
  // collapses to the exact pre-existing single-ceremony clause.
  const ceremonyValues = Array.from(
    new Set(
      [args.ceremonyType, args.secondaryCeremonyType]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0),
    ),
  );
  if (ceremonyValues.length > 0) {
    query = query.or(
      [
        'compatible_ceremony_types.is.null',
        ...ceremonyValues.map((v) => `compatible_ceremony_types.cs.{${v}}`),
      ].join(','),
    );
  }

  // Venue-setting compat · same NULL-safe OR. Skipped when venue_setting
  // is null (event hasn't picked a venue type yet · all vendors qualify).
  if (args.venueSetting) {
    query = query.or(
      `compatible_venue_settings.is.null,compatible_venue_settings.cs.{${args.venueSetting}}`,
    );
  }

  // Event-type scope · same NULL-safe OR shape. A vendor with no declared
  // event_types is admitted (covers all); one that lists them must include the
  // couple's type — excludes e.g. corporate-only vendors from a wedding search.
  if (args.eventType) {
    query = query.or(`event_types.is.null,event_types.cs.{${args.eventType}}`);
  }

  // Free-text search · ilike on business_name | location_city | tagline.
  // Used by the grid card's [Search] submit. Maintains compatibility +
  // exclusion filters so a host searching while in-flight on a category
  // never sees vendors they've already locked elsewhere.
  if (args.searchQuery && args.searchQuery.trim().length > 0) {
    const safe = args.searchQuery
      .trim()
      .replace(/[%_,]/g, ' ') // strip ilike wildcards + or-syntax separators
      .replace(/\s+/g, ' ')
      .slice(0, 64);
    if (safe.length > 0) {
      query = query.or(
        `business_name.ilike.%${safe}%,location_city.ilike.%${safe}%,tagline.ilike.%${safe}%`,
      );
    }
  }

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
    .order('avg_rating_overall', { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  const { data, error } = await query;
  if (error || !data) return [];

  // 2026-05-24: enrich with per-vendor service photo + verification state
  // + V1.1 presentation_pattern + services_preview (up to 5 photos per
  // Pattern A vendor for the multi-photo 2×2 tile collage). Pattern
  // mirrors apps/web/app/vendors/page.tsx's enrichment Promise.all · two
  // batched IN-lookups so a 100-vendor result set hits the DB twice
  // instead of N+1. Fail-soft on either side · the card keeps rendering
  // the vendor row even if photos / verification can't be resolved.
  let baseRows = data as unknown as Omit<
    WizardVendorRec,
    | 'primary_photo_url'
    | 'verification_state'
    | 'name_revealed_at'
    | 'presentation_pattern'
    | 'services_preview'
    | 'screen_name'
  >[];
  if (baseRows.length === 0) return [];

  // Region scope (Hybrid · admit-unknown, exclude-known-mismatch). Effective
  // region = hq_region, or regionForCity(location_city) for rows the 20260620
  // backfill couldn't set (demo data + legacy off-platform vendors). A NULL
  // effective region = unknown coverage → admitted, never hidden. We
  // over-fetched above so a full `limit` of in-region rows survives this.
  if (args.region) {
    baseRows = baseRows.filter((r) => {
      const eff = r.hq_region ?? regionForCity(r.location_city);
      return eff === null || eff === args.region;
    });
    if (baseRows.length === 0) return [];
  }

  // Pax + venue-type scope (Hybrid · admit-unknown). Both capacity_max and
  // venue_type live on vendor_profiles, not the market_stats view, so resolve
  // them for the candidate pool with ONE small lookup, then drop venues that
  // can't seat the wedding (capacity_max < pax) or aren't the picked fine venue
  // type. A NULL on either — every non-venue vendor + venues that haven't stated
  // it — is admitted (no constraint). We over-fetched above so the slice fills.
  if (needsPaxScope || needsVenueTypeScope) {
    const pax = args.pax && args.pax > 0 ? args.pax : null;
    const vType = args.venueType ?? null;
    const attrIds = baseRows.map((r) => r.vendor_profile_id);
    const { data: attrRows } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, capacity_max, venue_type')
      .in('vendor_profile_id', attrIds);
    const attrById = new Map<string, { cap: number | null; type: string | null }>(
      (attrRows ?? []).map((r) => {
        const row = r as {
          vendor_profile_id: string;
          capacity_max: number | null;
          venue_type: string | null;
        };
        return [
          row.vendor_profile_id,
          { cap: row.capacity_max ?? null, type: row.venue_type ?? null },
        ];
      }),
    );
    baseRows = baseRows.filter((r) => {
      const a = attrById.get(r.vendor_profile_id);
      const cap = a?.cap ?? null;
      const type = a?.type ?? null;
      const paxOk = pax === null || cap === null || cap >= pax;
      const typeOk = vType === null || type === null || type === vType;
      return paxOk && typeOk;
    });
    if (baseRows.length === 0) return [];
  }

  // Schedule scope (Hybrid · failing-open). Keep a vendor only if it's FREE on
  // ≥1 candidate date — drops vendors whose vendor_calendar_blocks cover EVERY
  // candidate. Batched availability read (one round trip over the candidates'
  // span). A vendor with no blocks is fully available (the V1 calendar default),
  // so Setnayan always-on services + any vendor who hasn't marked a calendar
  // pass through. We over-fetched above so the slice still fills.
  if (needsScheduleScope) {
    const keys = args.availableDateKeys!;
    const span = dateSpanFromKeys(keys);
    if (span) {
      const schedIds = baseRows.map((r) => r.vendor_profile_id);
      const availByVendor = await getBatchVendorAvailableDays(
        admin,
        schedIds,
        span.start,
        span.end,
      );
      baseRows = baseRows.filter((r) => {
        const avail = availByVendor.get(r.vendor_profile_id);
        if (!avail) return true; // absent from the batch → failing-open (admit)
        return keys.some((k) => avail.has(k));
      });
      if (baseRows.length === 0) return [];
    }
  }

  // Song-overlap score + re-rank (music match only). `overlapByVendor` stays
  // empty otherwise, so the final map adds no match fields and the order is
  // unchanged. The sort is stable (Node/V8), preserving ad_rank → review order
  // within equal-overlap groups.
  const overlapByVendor = new Map<string, { count: number; total: number }>();
  if (isMusicMatch) {
    const pickIds = await fetchEventSongPickIds(admin, args.matchEventId!);
    if (pickIds.length > 0) {
      const poolIds = baseRows.map((r) => r.vendor_profile_id);
      const overlaps = await fetchVendorSongOverlaps(admin, poolIds, pickIds);
      for (const id of poolIds) {
        overlapByVendor.set(id, {
          count: overlaps.get(id) ?? 0,
          total: pickIds.length,
        });
      }
      baseRows = [...baseRows].sort(
        (a, b) =>
          (overlapByVendor.get(b.vendor_profile_id)?.count ?? 0) -
          (overlapByVendor.get(a.vendor_profile_id)?.count ?? 0),
      );
    }
  }

  // Preference-match score + re-rank (Layer-B · any category with an event).
  // Mirror of the song-overlap block above, generalized from music to EVERY
  // category: float vendors whose vendor_service_attributes facet tags overlap
  // the couple's event_vendor_preferences, NEVER exclude. `prefByVendor` stays
  // empty — no float, no match fields, order unchanged — when the couple has no
  // prefs OR no vendor carries facet tags. Inert in prod until vendor
  // facet-tagging coverage exists (vendor_service_attributes is empty today), so
  // zero regression. Vendor_Match_Personalization_2026-06-01 §8/§9.
  const prefByVendor: Map<string, PreferenceMatch> = args.matchEventId
    ? await fetchPreferenceMatches(
        admin,
        args.matchEventId,
        baseRows.map((r) => r.vendor_profile_id),
        args.canonicalServices,
      )
    : new Map<string, PreferenceMatch>();
  if (prefByVendor.size > 0) {
    baseRows = [...baseRows].sort(
      (a, b) =>
        (prefByVendor.get(b.vendor_profile_id)?.matchedDimensions ?? 0) -
        (prefByVendor.get(a.vendor_profile_id)?.matchedDimensions ?? 0),
    );
  }

  // Over-fetched for the music + preference re-rank → trim to the requested cap
  // before the (more expensive) photo / meta enrichment.
  baseRows = baseRows.slice(0, limit);
  const vendorIds = baseRows.map((r) => r.vendor_profile_id);
  if (vendorIds.length === 0) return [];

  type ServicePhotoRow = {
    vendor_profile_id: string;
    primary_photo_r2_key: string | null;
    canonical_service: string | null;
    is_active: boolean | null;
  };

  const [photosByVendor, vendorMetaByVendor] = await Promise.all([
    (async (): Promise<Map<string, ServicePhotoRow[]>> => {
      // V1.1 · keep ALL matching active service rows so Pattern A vendors
      // get a multi-photo collage source. Pattern B vendors only use the
      // first photo (same behavior as before). The first 5 are surfaced
      // to the tile; the rest are unused.
      const { data: rows, error: err } = await admin
        .from('vendor_services')
        .select(
          'vendor_profile_id,primary_photo_r2_key,canonical_service,is_active',
        )
        .in('vendor_profile_id', vendorIds)
        .in('canonical_service', args.canonicalServices as readonly string[]);
      if (err || !rows) return new Map();
      const out = new Map<string, ServicePhotoRow[]>();
      for (const row of rows as ServicePhotoRow[]) {
        if (row.is_active === false) continue;
        if (!row.primary_photo_r2_key || row.primary_photo_r2_key.length === 0)
          continue;
        const bucket = out.get(row.vendor_profile_id) ?? [];
        bucket.push(row);
        out.set(row.vendor_profile_id, bucket);
      }
      return out;
    })(),
    (async (): Promise<
      Map<
        string,
        {
          verification_state: string | null;
          presentation_pattern: 'creations' | 'locked' | null;
          /** Per V2.1 brief amendment #2 (2026-05-30) — hybrid-anonymity
           *  reveal timestamp. Pulled in the same vendor_profiles batch
           *  to keep the per-vendor read count constant. Falls through
           *  to null when the column is absent (pre-migration deploy)
           *  via the optional cast at the row destructure below. */
          name_revealed_at: string | null;
          /** Per CLAUDE.md 2026-05-30 refinement row · Bark-format stored
           *  anonymized name. Optional in the row destructure for the
           *  same pre-migration-deploy resilience pattern. */
          screen_name: string | null;
        }
      >
    > => {
      const { data: rows, error: err } = await admin
        .from('vendor_profiles')
        .select(
          'vendor_profile_id,verification_state,presentation_pattern,name_revealed_at,screen_name',
        )
        .in('vendor_profile_id', vendorIds);
      if (err || !rows) return new Map();
      const out = new Map<
        string,
        {
          verification_state: string | null;
          presentation_pattern: 'creations' | 'locked' | null;
          name_revealed_at: string | null;
          screen_name: string | null;
        }
      >();
      for (const row of rows as Array<{
        vendor_profile_id: string;
        verification_state: string | null;
        presentation_pattern: string | null;
        name_revealed_at?: string | null;
        screen_name?: string | null;
      }>) {
        const pattern =
          row.presentation_pattern === 'creations' ||
          row.presentation_pattern === 'locked'
            ? row.presentation_pattern
            : null;
        out.set(row.vendor_profile_id, {
          verification_state: row.verification_state ?? null,
          presentation_pattern: pattern,
          name_revealed_at: row.name_revealed_at ?? null,
          screen_name: row.screen_name ?? null,
        });
      }
      return out;
    })(),
  ]);

  return baseRows.map((row) => {
    const photos = photosByVendor.get(row.vendor_profile_id) ?? [];
    const firstPhotoKey = photos[0]?.primary_photo_r2_key ?? null;
    const meta = vendorMetaByVendor.get(row.vendor_profile_id);
    const presentationPattern = meta?.presentation_pattern ?? null;

    // V1.1 · only build services_preview for Pattern A vendors (multi-
    // photo tile candidates). Pattern B + null vendors get an empty
    // array · their tile renders single-hero from primary_photo_url.
    // Cap at 5 photos to keep payload light + 2×2 collage shows max 4
    // (the 5th is reserved for future hover-cycle expansion).
    const services_preview: ReadonlyArray<{
      photo_url: string;
      service_name: string | null;
    }> =
      presentationPattern === 'creations'
        ? photos
            .slice(0, 5)
            .map((p) => ({
              photo_url: r2PublicUrl(R2_BUCKETS.media, p.primary_photo_r2_key!),
              service_name: p.canonical_service ?? null,
            }))
        : [];

    const overlap = overlapByVendor.get(row.vendor_profile_id);
    const matchFields =
      overlap && overlap.total > 0
        ? {
            song_overlap_count: overlap.count,
            song_pick_total: overlap.total,
            match_label: (overlap.count / overlap.total >= 0.9
              ? 'best'
              : 'next_best') as 'best' | 'next_best',
          }
        : {};

    const prefMatch = prefByVendor.get(row.vendor_profile_id);
    const prefFields =
      prefMatch && prefMatch.matched
        ? {
            preference_matched: true,
            preference_matched_dimensions: prefMatch.matchedDimensions,
          }
        : {};

    return {
      ...row,
      primary_photo_url: firstPhotoKey
        ? r2PublicUrl(R2_BUCKETS.media, firstPhotoKey)
        : null,
      verification_state: meta?.verification_state ?? null,
      name_revealed_at: meta?.name_revealed_at ?? null,
      screen_name: meta?.screen_name ?? null,
      presentation_pattern: presentationPattern,
      services_preview,
      ...matchFields,
      ...prefFields,
    } as WizardVendorRec;
  });
}

/**
 * Per-wizard-task service-array mapping. Phase 2 covers the Foundation
 * tier · vendor-pick variants only. Card 06 Prenup is external_process
 * (not vendor-pick) so it's intentionally absent.
 *
 * Values match the COARSE vendor_category enum value that the demo-seed
 * stamps onto vendor_profiles.services[] alongside the canonical_service
 * key (see apps/web/scripts/seed-demo-vendors.ts coarseCategoryFor()).
 * ceremony_venue → 'religious_venue' (churches/mosques/INC-chapels);
 * reception_venue → 'venue' (banquet halls / gardens / resorts).
 *
 * Phases 3-5 will extend this map with cards 08-24.
 */
export const VENDOR_PICK_TASK_CANONICAL_SERVICES: Partial<
  Record<string, ReadonlyArray<string>>
> = {
  reception_venue: ['venue'],
  ceremony_venue: ['religious_venue'],
  officiant: ['officiant'],
  photography: ['photographer', 'videographer'],
  catering: ['catering'],
  // Phase 3 batch — 9 standard vendor-pick cards (Stylist · Lights+Sound ·
  // Music · Host · Attire · HMUA · Cake · Accommodation · Bridal Car).
  // Card 14 photobooths_booths uses MULTI-PICK variant (shipped in
  // Phase 3 PR C alongside Card 20 Sponsors + 34/38 auto-transitions).
  stylist: ['reception_decor', 'florist'],
  lights_sound: ['lights_and_sound', 'led_screens'],
  music_entertainment: [
    'band_dj',
    'choir',
    'string_quartet',
    'host_emcee',
  ],
  host_mc: ['host_emcee'],
  attire: ['gown_designer', 'suit_designer'],
  hair_makeup: ['makeup_artist', 'hair_stylist'],
  cake: ['cake_maker'],
  accommodation: ['accommodation'],
  bridal_car: ['transportation'],
} as const;

/**
 * Returns the set of `vendors.vendor_profile_id` values that are
 * CONFIRMED-BOOKED on the given wedding date · 2026-05-24 owner directive
 * for Cards 02 + 03. Excludes the host's OWN event so a vendor the host
 * already locked on this event doesn't appear as "booked elsewhere".
 *
 * Returns an empty array on missing date, missing event, or any query
 * error · the grid downgrades to no-availability-filter, which is the
 * safest fallback.
 *
 * Confirmed statuses come from CONFIRMED_VENDOR_STATUSES in lib/events.ts:
 *   'contracted' / 'deposit_paid' / 'delivered' / 'complete'
 * Looser statuses ('considering', 'shortlisted') don't lock the vendor
 * out · those couples may still change their minds.
 */
export async function fetchBookedMarketplaceVendorIdsForDate(
  admin: SupabaseClient,
  eventId: string,
  eventDate: string | null,
): Promise<string[]> {
  if (!eventDate) return [];
  try {
    const { data, error } = await admin
      .from('event_vendors')
      .select(
        'marketplace_vendor_id, event_id, events!inner(event_date, deleted_at)',
      )
      .eq('events.event_date', eventDate)
      .is('events.deleted_at', null)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
      .not('marketplace_vendor_id', 'is', null)
      .neq('event_id', eventId);
    if (error || !data) return [];
    const out = new Set<string>();
    for (const row of data as Array<{ marketplace_vendor_id: string | null }>) {
      if (row.marketplace_vendor_id) out.add(row.marketplace_vendor_id);
    }
    return Array.from(out);
  } catch {
    return [];
  }
}
