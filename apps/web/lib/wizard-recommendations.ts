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
 * Compat filters mirror the marketplace's existing scoring:
 *   - `compatible_ceremony_types[]` overlap with event.ceremony_type
 *   - `compatible_venue_settings[]` overlap with event.venue_setting
 *   - region within ~100km of event.venue_latitude/venue_longitude
 *     (loose · gracefully degrades to "no region match" when event has
 *     no venue locked yet)
 *
 * NULL safety: a vendor row with compatible_ceremony_types = NULL means
 * "compatible with all ceremonies" (same OR-clause as the religion-
 * default filter from CLAUDE.md 2026-05-22 PR #305). Same for venue.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { r2PublicUrl, R2_BUCKETS } from '@/lib/r2';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

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
};

type Args = {
  /** Canonical_services array that defines the category set. Reception
   *  venue uses ['venue']; Officiant uses ['officiant']; Photographer
   *  uses ['photographer', 'videographer']; etc. */
  canonicalServices: ReadonlyArray<string>;
  /** events.ceremony_type · null for civil/no-religion events · used to
   *  filter to compatible-ceremony vendors. */
  ceremonyType: string | null;
  /** events.venue_setting · null when not picked yet · used to filter
   *  to compatible-venue vendors. */
  venueSetting: string | null;
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
export async function fetchWizardVendorRecommendations(
  admin: SupabaseClient,
  args: Args,
): Promise<WizardVendorRec[]> {
  const limit = args.limit ?? 15;
  if (args.canonicalServices.length === 0) return [];

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
  if (args.ceremonyType) {
    query = query.or(
      `compatible_ceremony_types.is.null,compatible_ceremony_types.cs.{${args.ceremonyType}}`,
    );
  }

  // Venue-setting compat · same NULL-safe OR. Skipped when venue_setting
  // is null (event hasn't picked a venue type yet · all vendors qualify).
  if (args.venueSetting) {
    query = query.or(
      `compatible_venue_settings.is.null,compatible_venue_settings.cs.{${args.venueSetting}}`,
    );
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
    .limit(limit);

  const { data, error } = await query;
  if (error || !data) return [];

  // 2026-05-24: enrich with per-vendor service photo + verification state
  // + V1.1 presentation_pattern + services_preview (up to 5 photos per
  // Pattern A vendor for the multi-photo 2×2 tile collage). Pattern
  // mirrors apps/web/app/vendors/page.tsx's enrichment Promise.all · two
  // batched IN-lookups so a 100-vendor result set hits the DB twice
  // instead of N+1. Fail-soft on either side · the card keeps rendering
  // the vendor row even if photos / verification can't be resolved.
  const baseRows = data as unknown as Omit<
    WizardVendorRec,
    | 'primary_photo_url'
    | 'verification_state'
    | 'name_revealed_at'
    | 'presentation_pattern'
    | 'services_preview'
    | 'screen_name'
  >[];
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
