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

  // 2026-05-24: enrich with per-vendor service photo + verification state.
  // Pattern mirrors apps/web/app/vendors/page.tsx's enrichment Promise.all
  // · two batched IN-lookups so a 100-vendor result set hits the DB twice
  // instead of N+1. Fail-soft on either side · the card keeps rendering
  // the vendor row even if photos / verification can't be resolved.
  const baseRows = data as unknown as Omit<
    WizardVendorRec,
    'primary_photo_url' | 'verification_state'
  >[];
  const vendorIds = baseRows.map((r) => r.vendor_profile_id);
  if (vendorIds.length === 0) return [];

  const [photosByVendor, verificationByVendor] = await Promise.all([
    (async (): Promise<Map<string, string>> => {
      const { data: rows, error: err } = await admin
        .from('vendor_services')
        .select(
          'vendor_profile_id,primary_photo_r2_key,canonical_service,is_active',
        )
        .in('vendor_profile_id', vendorIds)
        .in('canonical_service', args.canonicalServices as readonly string[]);
      if (err || !rows) return new Map();
      // Pick first non-null primary_photo_r2_key per vendor that matches
      // the canonical_service filter · biases toward the service the host
      // is shopping for (a venue's reception photo, not a random side gig).
      const out = new Map<string, string>();
      for (const row of rows as Array<{
        vendor_profile_id: string;
        primary_photo_r2_key: string | null;
        is_active: boolean | null;
      }>) {
        if (row.is_active === false) continue;
        if (!row.primary_photo_r2_key || row.primary_photo_r2_key.length === 0)
          continue;
        if (!out.has(row.vendor_profile_id)) {
          out.set(row.vendor_profile_id, row.primary_photo_r2_key);
        }
      }
      return out;
    })(),
    (async (): Promise<Map<string, string>> => {
      const { data: rows, error: err } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id,verification_state')
        .in('vendor_profile_id', vendorIds);
      if (err || !rows) return new Map();
      const out = new Map<string, string>();
      for (const row of rows as Array<{
        vendor_profile_id: string;
        verification_state: string | null;
      }>) {
        if (row.verification_state) {
          out.set(row.vendor_profile_id, row.verification_state);
        }
      }
      return out;
    })(),
  ]);

  return baseRows.map((row) => {
    const photoKey = photosByVendor.get(row.vendor_profile_id) ?? null;
    return {
      ...row,
      primary_photo_url: photoKey
        ? r2PublicUrl(R2_BUCKETS.media, photoKey)
        : null,
      verification_state:
        verificationByVendor.get(row.vendor_profile_id) ?? null,
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
