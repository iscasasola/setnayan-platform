/**
 * Vendor badge engine — computes the 4 quick-view badges per the
 * 2026-05-22 owner directive (CLAUDE.md decision log row "Ship vendor
 * marketplace card quick-view redesign + 4-badge system").
 *
 * Badges, from least → most exclusive:
 *
 *   1. `new`           — vendor signed up in the last 3 months AND is
 *                        verified. We intentionally pair "new" with
 *                        "verified" because an unverified brand-new
 *                        vendor doesn't deserve the New badge — it
 *                        would actively mislead couples into trusting
 *                        an unvetted profile during the verification
 *                        backlog window. Verified vendors who recently
 *                        joined get a real boost from the New badge
 *                        because it telegraphs "fresh, vetted, hungry."
 *
 *   2. `verified`      — always present when `verification_state =
 *                        'verified'`. Stacks with every other badge
 *                        (a vendor can be Verified + Top Pick + Most
 *                        Booking at the same time).
 *
 *   3. `most_booking`  — vendor sits in the top 10% by completed
 *                        bookings count across the verified pool. We
 *                        compute against `event_vendors` rows whose
 *                        status is in ('delivered', 'complete') because
 *                        those are the canonical "the work happened"
 *                        states (same set the review-policy uses to
 *                        gate review insertion, see
 *                        `20260514100000_vendor_reviews.sql:107`).
 *                        Unverified vendors are excluded from the
 *                        ranking entirely — otherwise an off-platform
 *                        vendor with 50 manual bookings would beat a
 *                        verified vendor with 8 real bookings, which
 *                        misrepresents marketplace trust.
 *
 *   4. `top_pick`      — vendor sits in the top 5% by review-weighted
 *                        score in the current calendar month. Score
 *                        is `avg_rating × ln(review_count + 1)` — a
 *                        Wilson-style proxy that rewards both quality
 *                        AND volume without one dominating the other.
 *                        Vendors with 0 reviews never qualify (ln(1)
 *                        = 0). This is the most prestigious badge,
 *                        rotates monthly, and we recompute on each
 *                        page load (cheap because the input set is
 *                        bounded — see V1 caveat below).
 *
 * V1 caveat: we deliberately do NOT bake these into a materialized
 * view yet. The recomputation cost is small (≤ a few hundred verified
 * vendors at pilot scale, see CLAUDE.md 2026-05-18 row 8 pilot
 * cohort), and shipping the computation in app code means we can
 * iterate on threshold formulas without a migration cycle. When
 * verified vendor count crosses ~5,000 (post Jan 30 2027 sunset per
 * CLAUDE.md 2026-05-20 vendor pricing row), promote to a materialized
 * view refreshed nightly + an `is_top_pick`/`is_most_booking` boolean
 * column on `vendor_profiles` so the per-page badge lookup is a hash
 * map, not a recompute.
 *
 * Returned shape is keyed by `vendor_profile_id` so callers can do a
 * single hash lookup at render time:
 *
 *   const badges = computeVendorBadges(...).get(vendor.vendor_profile_id) ?? [];
 *
 * Edge cases handled:
 *   - Vendors absent from the input list get `[]` (no badge rendered).
 *   - When no verified vendor has any bookings, no one gets
 *     `most_booking`. Same for `top_pick` when no one has reviews.
 *   - Sponsored / Boosted ad rank does NOT factor in. Badges are
 *     organic; paid placement floats vendors via `ad_rank` in the
 *     sort (page.tsx line 875), which is the right surface for
 *     monetization to live separately from trust badges.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorBadge = 'new' | 'verified' | 'most_booking' | 'top_pick';

/**
 * Vendor row shape needed for badge computation. Pull these columns from
 * `vendor_profiles` (or join through `vendor_market_stats` which has them).
 */
export type VendorBadgeInput = {
  vendor_profile_id: string;
  /** `vendor_profiles.verification_state` — only `'verified'` qualifies. */
  verification_state: string | null;
  /** `vendor_profiles.created_at` — used for the 3-month New window. */
  created_at: string | null;
  /**
   * `vendor_review_stats.avg_rating_overall` — 0 when the vendor has
   * zero reviews. Drives the `top_pick` formula.
   */
  avg_rating_overall: number | null;
  /**
   * `vendor_review_stats.total_count` — 0 when the vendor has zero
   * reviews. Drives both the `top_pick` formula AND its zero-review
   * disqualification.
   */
  review_count: number | null;
};

/**
 * Aggregated completed-booking counts (status IN ('delivered','complete'))
 * keyed by `marketplace_vendor_id`. Use `fetchCompletedBookingCounts` to
 * build this in one batched SQL call.
 */
export type CompletedBookingCounts = ReadonlyMap<string, number>;

const NEW_BADGE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
// 10% / 5% thresholds — per the brief. These are cumulative-distribution
// floors: a vendor must be at OR above the 90th percentile of bookings
// to get most_booking, and at OR above the 95th percentile of weighted
// score to get top_pick.
const MOST_BOOKING_PERCENTILE = 0.9;
const TOP_PICK_PERCENTILE = 0.95;

function isVerified(state: string | null): boolean {
  return state === 'verified';
}

function isNewWithin90d(createdAt: string | null, now: number): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return now - t <= NEW_BADGE_WINDOW_MS;
}

function topPickScore(avgRating: number, reviewCount: number): number {
  // Wilson-ish: scale by log(reviews + 1) so a 5★ vendor with 1 review
  // doesn't beat a 4.8★ vendor with 30 reviews. Adding 1 keeps log
  // defined at 0 and makes the score 0 at exactly 0 reviews.
  return avgRating * Math.log(reviewCount + 1);
}

/**
 * Computes which badges each vendor in `inputs` qualifies for, against
 * the population of `inputs` (so percentile thresholds reflect the page's
 * visible set, NOT a global recomputation). Returns a Map keyed by
 * `vendor_profile_id` — vendors with no badges are omitted from the map
 * entirely (caller's `.get(id) ?? []` handles the empty case).
 *
 * `bookingCounts` should be the result of `fetchCompletedBookingCounts`
 * for at least the union of vendor IDs in `inputs`. Missing entries are
 * treated as 0, which correctly disqualifies the vendor from
 * `most_booking` rather than crashing.
 */
export function computeVendorBadges(
  inputs: ReadonlyArray<VendorBadgeInput>,
  bookingCounts: CompletedBookingCounts,
  options?: { now?: number },
): Map<string, VendorBadge[]> {
  const now = options?.now ?? Date.now();

  // First pass — pre-compute the verified pool's booking counts and
  // top-pick scores. Percentile thresholds derive from these arrays.
  const verifiedPool: Array<{
    id: string;
    bookings: number;
    score: number;
    reviewCount: number;
  }> = [];

  for (const v of inputs) {
    if (!isVerified(v.verification_state)) continue;
    const bookings = bookingCounts.get(v.vendor_profile_id) ?? 0;
    const reviewCount = v.review_count ?? 0;
    const avg = Number(v.avg_rating_overall ?? 0);
    const score = topPickScore(avg, reviewCount);
    verifiedPool.push({
      id: v.vendor_profile_id,
      bookings,
      score,
      reviewCount,
    });
  }

  // Percentile gates — sort ascending and pick the threshold value at
  // the percentile index. We use ">= threshold" comparison so ties at
  // the boundary all qualify, which feels less arbitrary than a strict
  // "top N rows" cutoff.
  const bookingThreshold = percentileValue(
    verifiedPool.map((p) => p.bookings),
    MOST_BOOKING_PERCENTILE,
  );
  const scoreThreshold = percentileValue(
    verifiedPool.map((p) => p.score),
    TOP_PICK_PERCENTILE,
  );

  const mostBookingIds = new Set<string>();
  const topPickIds = new Set<string>();

  // A vendor only qualifies for `most_booking` if they have AT LEAST
  // 1 completed booking. Threshold can legitimately be 0 when the
  // pilot pool has very few completed bookings; in that case nobody
  // gets the badge instead of everybody getting it.
  for (const p of verifiedPool) {
    if (p.bookings >= bookingThreshold && p.bookings > 0) {
      mostBookingIds.add(p.id);
    }
    // top_pick needs reviews — zero-review vendors have score 0 and
    // would otherwise qualify if the threshold itself is 0.
    if (p.reviewCount > 0 && p.score >= scoreThreshold && p.score > 0) {
      topPickIds.add(p.id);
    }
  }

  // Second pass — assemble each vendor's badge array.
  const out = new Map<string, VendorBadge[]>();
  for (const v of inputs) {
    const badges: VendorBadge[] = [];
    if (isVerified(v.verification_state)) {
      badges.push('verified');
      if (isNewWithin90d(v.created_at, now)) badges.push('new');
      if (mostBookingIds.has(v.vendor_profile_id)) badges.push('most_booking');
      if (topPickIds.has(v.vendor_profile_id)) badges.push('top_pick');
    }
    if (badges.length > 0) {
      out.set(v.vendor_profile_id, badges);
    }
  }
  return out;
}

/**
 * Returns the value at the given percentile (0–1) in a sorted-ascending
 * sample. For empty arrays returns Infinity so no vendor can clear the
 * gate (correct: an empty pool has no top-10% leaders).
 *
 * Uses nearest-rank: percentile p maps to ceil(p × n) - 1 index. With
 * p=0.9 and n=10 vendors, index = 8 — the 9th-ranked vendor's value is
 * the floor; everyone with a value ≥ that floor qualifies.
 */
function percentileValue(values: ReadonlyArray<number>, p: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  // `idx` is bounded to [0, sorted.length - 1] by the Math.max above,
  // but TS strict-array-index still flags sorted[idx] as possibly
  // undefined. The fallback to +Infinity is unreachable (length ≥ 1
  // here) but keeps the type system happy without an assertion.
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? Number.POSITIVE_INFINITY;
}

/**
 * Batched read against `event_vendors` to count completed bookings per
 * marketplace vendor. Counts statuses `'delivered'` and `'complete'`
 * (the same set the review-insert RLS policy gates on, see
 * `20260514100000_vendor_reviews.sql:107`).
 *
 * Aggregates in app code rather than via PostgREST's `?select=count()`
 * because we want one row per vendor + counts of multiple specific
 * statuses, which is cleaner as a single SELECT + reduce than as
 * multiple parallel count queries. The row volume here is bounded
 * (V1 pilot ≤ 20 events × ≤ 30 picks = ≤ 600 rows in practice — see
 * CLAUDE.md 2026-05-18 row 8 pilot cohort).
 *
 * Vendors with zero completed bookings are absent from the returned
 * map — callers must default to 0.
 */
export async function fetchCompletedBookingCounts(
  admin: SupabaseClient,
  vendorIds: ReadonlyArray<string>,
): Promise<CompletedBookingCounts> {
  if (vendorIds.length === 0) return new Map();

  const { data, error } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, status')
    .in('marketplace_vendor_id', vendorIds as string[])
    .in('status', ['delivered', 'complete']);

  // Bookings can't fail open: if the SELECT errors, return an empty
  // map. Badges silently miss until the next request; the failure does
  // NOT bubble up and block the whole vendor grid from rendering.
  if (error) {
    console.error('[vendor-badges] failed to fetch booking counts', error);
    return new Map();
  }

  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { marketplace_vendor_id: string | null })
      .marketplace_vendor_id;
    if (!id) continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}
