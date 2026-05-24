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

/** Single vendor recommendation row · shape consumed by VendorPickCard. */
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
  /** Cap on rows. Default 15 (5 default + 10 VIEW MORE). */
  limit?: number;
  /** Exclude already-locked event_vendors so the host doesn't see
   *  recommendations that are already on their plan. */
  excludeVendorIds?: ReadonlyArray<string>;
};

/**
 * Top recommendations for a wizard vendor-pick card. Returns an empty
 * array on any query error so the card stays clean rather than partially
 * broken — the VendorPickCard renders a polite-voice empty state when
 * recs is empty (rare · happens for very narrow ceremony_type +
 * venue_setting combos before marketplace inventory grows).
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
      'vendor_profile_id,business_name,business_slug,logo_url,tagline,location_city,avg_rating_overall,review_count,ad_rank,public_visibility,compatible_ceremony_types,compatible_venue_settings',
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
  return data as unknown as WizardVendorRec[];
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
} as const;
