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
 *   3. `couple_trusted`— verified vendor with a proven, well-rated
 *                        review history — but counted ONLY over
 *                        receipt-backed, arm's-length reviews (via the
 *                        `vendor_trusted_review_stats` materialized view):
 *                        `trusted_review_count ≥ 10` AND
 *                        `trusted_avg_rating ≥ 4.7` out of 5. It does NOT
 *                        read the raw `review_count` / `avg_rating_overall`
 *                        anymore — those count every review with no
 *                        provenance filter, which let a vendor mint the
 *                        badge with sockpuppet couple accounts + self-made
 *                        "delivered" events. The trusted stat excludes
 *                        off-platform reviews (not booked through Setnayan)
 *                        AND the vendor's own owner/team/internal/self-comp
 *                        bookings, so fake / self-dealt reviews cannot earn
 *                        it by construction. A simple count-floor + rating
 *                        bar — it does NOT depend on booking counts (owner
 *                        decision 2026-07-05, after industry research: an
 *                        absolute reviews+rating threshold, not a coverage
 *                        ratio). It's an ABSOLUTE gate (not a percentile),
 *                        STACKS like every other badge, and is NOT a
 *                        monthly-rotating Spotlight Award — it never enters
 *                        the awards vocabulary.
 *
 *   4. `most_booking`  — vendor sits in the top 10% by VETTED completed
 *                        events count across the verified pool. ANTI-FRAUD
 *                        (2026-07-05): the count comes from the
 *                        `vendor_public_completed_events_stats` materialized
 *                        view (delivered/complete, self-dealing EXCLUDED —
 *                        unlinked/archived/owner/team/internal/self-comp),
 *                        NOT a raw `event_vendors` count. So a vendor can't
 *                        climb by self-creating "delivered" events. Unverified
 *                        vendors are excluded from the ranking entirely —
 *                        otherwise an off-platform vendor with 50 manual
 *                        bookings would beat a verified vendor with 8 real
 *                        bookings, which misrepresents marketplace trust.
 *
 *   5. `top_pick`      — vendor sits in the top 5% by review-weighted
 *                        score in the current calendar month. Score
 *                        is `trusted_avg_rating × ln(trusted_review_count
 *                        + 1)` — a Wilson-style proxy that rewards both
 *                        quality AND volume without one dominating the
 *                        other. ANTI-FRAUD (2026-07-05): it reads the
 *                        TRUSTED (receipt-backed, arm's-length) review
 *                        stat, NOT the raw review_count / avg_rating_overall
 *                        (which count every review with no provenance
 *                        filter). Vendors with 0 TRUSTED reviews never
 *                        qualify (ln(1) = 0), so fake / self-dealt reviews
 *                        can't lift a vendor into the top 5%. This is the
 *                        most prestigious badge, rotates monthly, and we
 *                        recompute on each page load (cheap because the
 *                        input set is bounded — see V1 caveat below).
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
 *   - Badges are organic — they reflect real bookings + reviews only,
 *     never any paid placement signal.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorBadge =
  | 'new'
  | 'verified'
  | 'couple_trusted'
  | 'most_booking'
  | 'top_pick';

/**
 * Spotlight Awards bridge (Wave 5 vendor benefit).
 *
 * The two EXCLUSIVE, monthly-rotating badges computed here — `top_pick` and
 * `most_booking` — are the source signals for the persisted Spotlight Awards
 * record. `new` and `verified` are NOT awards: `verified` is a trust state and
 * `new` is a recency window, neither is an exclusive monthly recognition.
 *
 * `apps/web/lib/spotlight-awards.ts` snapshots the badges this engine produces
 * into `public.vendor_spotlight_awards` once a month (cron-free — admin
 * "Run now" or a Next 15 after() piggyback). It maps these badge keys to the
 * awards vocabulary via `SPOTLIGHT_AWARD_BADGES` below:
 *
 *   top_pick     → 'top_pick'
 *   most_booking → 'most_booked'
 *
 * Keep this list in sync if a new exclusive badge is added that should also
 * become an award. NOTE: `couple_trusted` is deliberately NOT here — it is an
 * absolute, stacking trust badge (not an exclusive monthly recognition), so it
 * never becomes a Spotlight Award.
 */
export const SPOTLIGHT_AWARD_BADGES: ReadonlyArray<
  Extract<VendorBadge, 'top_pick' | 'most_booking'>
> = ['top_pick', 'most_booking'];

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
   * zero reviews. Counts EVERY review with no provenance filter, so it is
   * deliberately NOT used by `couple_trusted` OR `top_pick` anymore (both
   * read `trusted_avg_rating`). Retained on the input for callers that still
   * pass it; the badge engine ignores it for scoring (ANTI-FRAUD 2026-07-05).
   */
  avg_rating_overall: number | null;
  /**
   * `vendor_review_stats.total_count` — 0 when the vendor has zero
   * reviews. Like `avg_rating_overall`, it has no provenance filter and is
   * NOT read by `couple_trusted` OR `top_pick` anymore (both read
   * `trusted_review_count`). Retained on the input shape only.
   */
  review_count: number | null;
  /**
   * `vendor_trusted_review_stats.trusted_review_count` — count of ONLY
   * receipt-backed, arm's-length reviews (booked through Setnayan, with
   * the vendor's own owner/team/internal/self-comp bookings excluded).
   * 0/`null` when the vendor has no trusted reviews. Drives the
   * `couple_trusted` count floor AND the `top_pick` score + its zero-review
   * disqualification — fake / self-dealt reviews never reach this number.
   */
  trusted_review_count: number | null;
  /**
   * `vendor_trusted_review_stats.trusted_avg_rating` — average overall
   * rating across ONLY the receipt-backed, arm's-length reviews above.
   * 0/`null` when the vendor has no trusted reviews. Drives the
   * `couple_trusted` rating bar AND the `top_pick` score.
   */
  trusted_avg_rating: number | null;
};

/**
 * Aggregated VETTED completed-event counts keyed by `vendor_profile_id`.
 * Sourced from the `vendor_public_completed_events_stats` materialized view
 * (migration `20260515020000_public_stats_exclusion.sql`), which already
 * excludes self-dealing bookings — unlinked rows, archived events, the vendor
 * owner on the event, any team member on the event, internal accounts tied to
 * the vendor, and self-comp grants. Use `fetchCompletedBookingCounts` to build
 * this in one batched SQL call.
 *
 * ANTI-FRAUD (2026-07-05, Phase 1 follow-up): this replaced a raw
 * `event_vendors` count that applied NONE of those exclusions, which let a
 * crooked vendor inflate `most_booking` / the Experience tier with self-created
 * "delivered" events. Keyed by `vendor_profile_id` (was `marketplace_vendor_id`,
 * the same id — the view keys on `vendor_profiles.vendor_profile_id`).
 */
export type CompletedBookingCounts = ReadonlyMap<string, number>;

const NEW_BADGE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
// 10% / 5% thresholds — per the brief. These are cumulative-distribution
// floors: a vendor must be at OR above the 90th percentile of bookings
// to get most_booking, and at OR above the 95th percentile of weighted
// score to get top_pick.
const MOST_BOOKING_PERCENTILE = 0.9;
const TOP_PICK_PERCENTILE = 0.95;
// `couple_trusted` is an ABSOLUTE (non-percentile) gate — a vendor earns it
// on their own numbers, independent of the visible pool AND independent of
// booking counts. Owner decision 2026-07-05: a simple review-count floor plus
// an average-rating bar (mean overall star rating, 1–5). At least 10 reviews
// so the average is meaningful, and ≥ 4.7★. Counted over the TRUSTED
// (receipt-backed, arm's-length) review stat only — see `isCoupleTrusted`.
const COUPLE_TRUSTED_MIN_REVIEWS = 10;
const COUPLE_TRUSTED_MIN_AVG_RATING = 4.7;

function isVerified(state: string | null): boolean {
  return state === 'verified';
}

function isNewWithin90d(createdAt: string | null, now: number): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return now - t <= NEW_BADGE_WINDOW_MS;
}

/**
 * `couple_trusted` gate — an ABSOLUTE (per-vendor, not percentile) badge.
 * True when the vendor has `trusted_review_count ≥ 10` AND
 * `trusted_avg_rating ≥ 4.7`. These read ONLY the receipt-backed, arm's-length
 * `vendor_trusted_review_stats` fields — NOT the raw `review_count` /
 * `avg_rating_overall` (which count every review with no provenance filter and
 * could be inflated with fake / self-dealt reviews). Depends only on the
 * vendor's own trusted review numbers — NOT on booking counts. Verified-gating
 * is enforced by the caller, not here.
 */
function isCoupleTrusted(v: VendorBadgeInput): boolean {
  const trustedCount = v.trusted_review_count ?? 0;
  if (trustedCount < COUPLE_TRUSTED_MIN_REVIEWS) return false;
  const avg = Number(v.trusted_avg_rating ?? 0);
  return avg >= COUPLE_TRUSTED_MIN_AVG_RATING;
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
    // ANTI-FRAUD (2026-07-05, Phase 1 follow-up): top_pick scores on the
    // TRUSTED (receipt-backed, arm's-length) review stat, NOT the raw
    // review_count / avg_rating_overall (which count every review with no
    // provenance filter). A vendor with high raw reviews but 0 trusted reviews
    // scores 0 (ln(0 + 1) = 0) and can never earn top_pick — fake / self-dealt
    // reviews are invisible to the ranking by construction.
    const reviewCount = v.trusted_review_count ?? 0;
    const avg = Number(v.trusted_avg_rating ?? 0);
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

  // Second pass — assemble each vendor's badge array in the ONE canonical
  // render order shared across the whole system: new → verified →
  // couple_trusted → most_booking → top_pick. Every consumer (card row,
  // spotlight snapshot) relies on this ordering, so push in exactly this
  // sequence.
  const out = new Map<string, VendorBadge[]>();
  for (const v of inputs) {
    const badges: VendorBadge[] = [];
    if (isVerified(v.verification_state)) {
      if (isNewWithin90d(v.created_at, now)) badges.push('new');
      badges.push('verified');
      if (isCoupleTrusted(v)) badges.push('couple_trusted');
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
 * Batched read of the VETTED completed-event count per vendor, keyed by
 * `vendor_profile_id`.
 *
 * ANTI-FRAUD (2026-07-05, Phase 1 follow-up · spec
 * `03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md` § 3): reads the
 * `vendor_public_completed_events_stats` materialized view instead of raw
 * `event_vendors`. That view already counts only `delivered`/`complete`
 * bookings linked via `linked_vendor_profile_id` and EXCLUDES self-dealing —
 * archived events, the vendor owner on the event, any team member on the event,
 * internal accounts tied to the vendor, and self-comp grants. Routing the count
 * through it means a vendor can't inflate `most_booking` (percentile) or the
 * Experience tier by self-creating "delivered" events for themselves.
 *
 * The view exposes the count in the `public_completed_count` column (one row
 * per `vendor_profile_id`), so no app-side aggregation is needed — we just map
 * the column. Vendors with zero vetted completed events either have a 0-count
 * row or no row at all; both collapse to 0 (callers default to 0), so we skip
 * zero rows to keep the map to positive counts only.
 *
 * Fail-soft: if the SELECT errors (e.g. the view is missing pre-migration), we
 * return an empty map. Badges + the Experience chip silently miss until the
 * next request; the failure does NOT bubble up and block the vendor grid.
 */
export async function fetchCompletedBookingCounts(
  admin: SupabaseClient,
  vendorIds: ReadonlyArray<string>,
): Promise<CompletedBookingCounts> {
  if (vendorIds.length === 0) return new Map();

  const { data, error } = await admin
    .from('vendor_public_completed_events_stats')
    .select('vendor_profile_id, public_completed_count')
    .in('vendor_profile_id', vendorIds as string[]);

  // Bookings can't fail open: if the SELECT errors, return an empty
  // map. Badges silently miss until the next request; the failure does
  // NOT bubble up and block the whole vendor grid from rendering.
  if (error) {
    console.error('[vendor-badges] failed to fetch vetted completed-event counts', error);
    return new Map();
  }

  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as {
      vendor_profile_id: string | null;
      public_completed_count: number | string | null;
    };
    if (!r.vendor_profile_id) continue;
    const count = Number(r.public_completed_count ?? 0);
    if (!Number.isFinite(count) || count <= 0) continue;
    out.set(r.vendor_profile_id, count);
  }
  return out;
}
