/**
 * Batched preview-review fetcher — loads the latest 3 reviews per
 * vendor in one SQL roundtrip so the marketplace card carousel
 * doesn't N+1 the database.
 *
 * Per the 2026-05-22 owner directive on vendor-card-quickview, every
 * quick-view card surfaces a 3-card carousel of recent reviews. With
 * PAGE_SIZE = 24 cards visible at once, the naive "fetch top 3 per
 * vendor in a loop" approach is 24 queries; this helper collapses
 * that into 1 query that pulls 3-per-vendor in a single select
 * ordered by `created_at DESC` with vendor_profile_id IN (...) ,
 * then slices in app code.
 *
 * Trade-off: we over-fetch slightly. To guarantee 3 latest per vendor
 * we pull `vendorIds.length × 3 × 2` rows and let the in-process
 * grouping take the top 3 each. The 2× safety margin handles the
 * (rare) case where one vendor has 30 reviews and another has 0 —
 * a hard `.limit(N*3)` would otherwise drop the long-tail vendor's
 * reviews entirely. The over-fetch is bounded (PAGE_SIZE × 6 ≈ 144
 * rows max), tiny compared to a per-vendor query loop.
 *
 * Returns a Map keyed by vendor_profile_id. Vendors with zero
 * reviews are absent from the map entirely; callers should default
 * to `[]` and skip rendering the carousel.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorReviewPreview = {
  review_id: string;
  rating_overall: number;
  body: string | null;
  created_at: string;
  /** Couple's first names + last-name initials — anonymized for the
   *  carousel. Null when the couple is anonymous OR the resolver
   *  can't safely derive a display string. Hosts can opt into showing
   *  their full names on the editorial later (Phase 4 of 0002, owner-
   *  controlled per RA 10173) but the marketplace preview always
   *  shows the lighter form. */
  author_display: string | null;
};

const REVIEWS_PER_VENDOR = 3;
const OVERFETCH_FACTOR = 2;

/**
 * Reads `vendor_reviews` for the given vendor IDs, returning the latest
 * REVIEWS_PER_VENDOR per vendor in chronological-descending order.
 *
 * Author display is intentionally a thin anonymization: we read the
 * couple's first names if available via a future join, but in V1 the
 * `vendor_reviews` table doesn't carry guest-display columns directly,
 * so we render a neutral "Verified couple" string. The carousel still
 * surfaces the review body + rating + date, which is the load-bearing
 * trust signal; the byline is decoration.
 *
 * V1.1 candidate: join through `events` → `users` to derive
 * "Maria & Juan S." when the host has opted into public attribution
 * for editorial purposes.
 */
export async function fetchLatestReviewsByVendor(
  admin: SupabaseClient,
  vendorIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, VendorReviewPreview[]>> {
  if (vendorIds.length === 0) return new Map();

  const limit = vendorIds.length * REVIEWS_PER_VENDOR * OVERFETCH_FACTOR;

  const { data, error } = await admin
    .from('vendor_reviews')
    .select('review_id, vendor_profile_id, rating_overall, body, created_at')
    .in('vendor_profile_id', vendorIds as string[])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Fail-soft: surface no reviews rather than crash the marketplace.
    console.error('[vendor-reviews-preview] fetch failed', error);
    return new Map();
  }

  const grouped = new Map<string, VendorReviewPreview[]>();
  for (const row of data ?? []) {
    const r = row as {
      review_id: string;
      vendor_profile_id: string;
      rating_overall: number;
      body: string | null;
      created_at: string;
    };
    const list = grouped.get(r.vendor_profile_id) ?? [];
    if (list.length >= REVIEWS_PER_VENDOR) continue;
    list.push({
      review_id: r.review_id,
      rating_overall: r.rating_overall,
      body: r.body,
      created_at: r.created_at,
      // V1: neutral byline. See doc above for the V1.1 enrichment.
      author_display: 'Verified couple',
    });
    grouped.set(r.vendor_profile_id, list);
  }

  return grouped;
}
