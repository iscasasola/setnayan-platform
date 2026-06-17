/**
 * vendor-activity.ts — Server-only score recomputation for vendor quality signals.
 *
 * Computes and upserts into `vendor_activity_stats`:
 *   - couple_trust_score  (public, 0–100)
 *   - platform_health_score (internal, 0–100)
 *   - quality_score (search priority composite, 0–100)
 *   - raw activity metrics (avg_response_minutes, response_rate_pct, etc.)
 *
 * All pure helpers are exported for unit-testability but have zero side effects.
 *
 * @module server-only
 */

// Server-only guard — this module uses the service-role client and must
// never be imported from client components.
import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { profileCompletion } from '@/lib/vendor-profile';
import type { VendorProfileRow } from '@/lib/vendor-profile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewForScore = {
  /** Per-review average across the 4 rated axes (communication, quality, value, on_time). */
  avg: number;
};

export type ComputeCoupleTrustParams = {
  reviews: ReviewForScore[];
  bookingCompletionRatePct: number;
  vendorCancellationCount: number;
  responseRatePct: number;
  avgResponseMinutes: number;
};

export type ComputePlatformHealthParams = {
  coupleTrustScore: number;
  loginDecayScore: number;
  finalizedBookingCount: number;
  inquiryToBookingPct: number;
  /** Pass 0 for V1 — no referral tracking yet. */
  referralScore: number;
};

// ---------------------------------------------------------------------------
// Pure computation helpers
// ---------------------------------------------------------------------------

/**
 * Bayesian-smoothed average of per-review averages.
 *
 * Uses a prior of `priorMean` (default 4.0) with `priorWeight` reviews
 * (default 10) so that a vendor with 1 review doesn't immediately swing
 * to a raw 5.0 or 1.0.
 *
 * Formula: (priorWeight × priorMean + Σ review_avgs) / (priorWeight + n)
 * Returns a value in [1, 5].
 */
export function computeBayesianReviewAvg(
  reviews: ReadonlyArray<ReviewForScore>,
  priorMean = 4.0,
  priorWeight = 10,
): number {
  if (reviews.length === 0) return priorMean;
  const sum = reviews.reduce((acc, r) => acc + r.avg, 0);
  return (priorWeight * priorMean + sum) / (priorWeight + reviews.length);
}

/**
 * Login decay score: linear from 100 (logged in today) to 0 (60+ days ago).
 * Returns 100 when `lastLoginAt` is null (brand-new vendor with no login yet).
 * Clamped to [0, 100].
 *
 * NOTE: `lastLoginAt` is sourced from `auth.users.last_sign_in_at` (Supabase
 * built-in, available via the admin client). If we cannot query auth.users
 * for this vendor, pass null — it will score 100 (benefit of the doubt for
 * new accounts). See `recomputeVendorActivityStats` for the query.
 */
export function computeLoginDecayScore(lastLoginAt: Date | null): number {
  if (lastLoginAt === null) return 100;
  const daysSince = (Date.now() - lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.min(100, 100 - (daysSince / 60) * 100));
}

/**
 * Responsiveness sub-score.
 *
 * Combines:
 *   - responseRatePct (0–100): did the vendor reply at all within 48h?
 *   - replyTimeScore (0–100): derived from avgResponseMinutes; faster = higher.
 *     Linear from 100 (≤30 min) to 0 (≥1440 min / 24h).
 *
 * Returns a weighted composite: 70% rate + 30% speed.
 */
function computeResponsivenessScore(responseRatePct: number, avgResponseMinutes: number): number {
  const rate = Math.max(0, Math.min(100, responseRatePct));
  const rawSpeed = avgResponseMinutes <= 0 ? 100 : Math.max(0, 100 - (avgResponseMinutes / 1440) * 100);
  const speed = Math.min(100, rawSpeed);
  return rate * 0.7 + speed * 0.3;
}

/**
 * Reliability sub-score.
 *
 * Completion rate (0–100) minus a flat cancellation penalty.
 * Penalty: 5 points per vendor-initiated cancellation, capped at 50 points.
 * Result clamped to [0, 100].
 */
function computeReliabilityScore(
  bookingCompletionRatePct: number,
  vendorCancellationCount: number,
): number {
  const penalty = Math.min(50, vendorCancellationCount * 5);
  return Math.max(0, Math.min(100, bookingCompletionRatePct - penalty));
}

/**
 * Couple Trust Score — the public-facing quality signal.
 *
 * Components:
 *   - reviewScore     (40%): Bayesian-smoothed avg of per-review averages, scaled to 0–100
 *   - reliabilityScore (30%): completion rate minus cancellation penalty
 *   - responsivenessScore (30%): response rate × speed composite
 */
export function computeCoupleTrustScore(params: ComputeCoupleTrustParams): number {
  const bayesianAvg = computeBayesianReviewAvg(params.reviews);
  const reviewScore = ((bayesianAvg - 1) / 4) * 100; // scale [1,5] → [0,100]

  const reliabilityScore = computeReliabilityScore(
    params.bookingCompletionRatePct,
    params.vendorCancellationCount,
  );

  const responsivenessScore = computeResponsivenessScore(
    params.responseRatePct,
    params.avgResponseMinutes,
  );

  const raw =
    reviewScore * 0.4 + reliabilityScore * 0.3 + responsivenessScore * 0.3;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Platform Health Score — internal signal used by Setnayan HQ.
 *
 * Components:
 *   - coupleTrustScore      (40%)
 *   - loginDecayScore       (20%): recency of last login
 *   - finalized bookings    (15%): capped at 20, then scaled to 0–100
 *   - inquiryToBookingPct   (15%): direct hit rate (0–100)
 *   - referralScore         (10%): stub 0 for V1, TODO when referral tracking lands
 *
 * TODO: wire referralScore once vendor referral tracking is implemented.
 */
export function computePlatformHealthScore(params: ComputePlatformHealthParams): number {
  const finalizedScaled = Math.min(100, (params.finalizedBookingCount / 20) * 100);
  const inquiryPct = Math.max(0, Math.min(100, params.inquiryToBookingPct));

  const raw =
    params.coupleTrustScore * 0.4 +
    params.loginDecayScore * 0.2 +
    finalizedScaled * 0.15 +
    inquiryPct * 0.15 +
    params.referralScore * 0.1;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Overall quality_score — the composite used as a search ranking signal.
 *
 * quality_score = coupleTrust × 0.70 + platformHealth × 0.30
 */
export function computeQualityScore(coupleTrust: number, platformHealth: number): number {
  return Math.round(Math.max(0, Math.min(100, coupleTrust * 0.7 + platformHealth * 0.3)));
}

// ---------------------------------------------------------------------------
// Profile completeness helper (0–100)
// ---------------------------------------------------------------------------

function profileCompletenessPct(profile: VendorProfileRow | null): number {
  const { done, total } = profileCompletion(profile);
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

// ---------------------------------------------------------------------------
// Main recompute function
// ---------------------------------------------------------------------------

/**
 * Recompute all quality/health scores for one vendor and upsert into
 * `vendor_activity_stats`. Called from route handlers via
 * `triggerVendorActivityRecompute` or directly from admin actions.
 *
 * Uses the service-role client to bypass RLS — `vendor_activity_stats` has
 * an RLS policy allowing only admin writes. The service role is treated as
 * admin for this purpose.
 *
 * @throws Error when a critical DB query fails (caller should catch if calling
 *   directly; `triggerVendorActivityRecompute` wraps with catch-and-log).
 */
export async function recomputeVendorActivityStats(vendorProfileId: string): Promise<void> {
  const supabase = createAdminClient();

  // -----------------------------------------------------------------------
  // 1. Fetch all needed data in parallel
  // -----------------------------------------------------------------------
  const [profileResult, reviewsResult, bookingsResult, inquiriesResult] =
    await Promise.all([
      // Vendor profile (for completeness + user_id to resolve last_login)
      supabase
        .from('vendor_profiles')
        .select('vendor_profile_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,hq_address,hq_longitude,hq_latitude,website,contact_email,contact_phone,is_published,portfolio_r2_keys,show_team_bookings_in_backend_count,public_visibility,compatible_ceremony_types,compatible_venue_settings,event_types,created_at,updated_at')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle(),

      // Reviews — pull the 4 rated axes to compute per-review averages
      supabase
        .from('vendor_reviews')
        .select('rating_communication,rating_quality,rating_value,rating_on_time')
        .eq('vendor_profile_id', vendorProfileId),

      // Bookings — count finalized vs all, vendor cancellations
      // "Finalized" = contracted | deposit_paid | delivered | complete
      // "Vendor cancellation" = force_majeure_flags with type='vendor_cancellation'
      // There is no cancelled status on event_vendors; cancellations go through
      // force_majeure_flags (type='vendor_cancellation'). See lib/force-majeure.ts.
      supabase
        .from('event_vendors')
        .select('status')
        .eq('vendor_profile_id', vendorProfileId),

      // Inquiries (chat_threads) — all threads + accepted (replied) threads
      // TODO: Add replied_at / first_vendor_reply_at column to chat_threads
      //   so we can compute per-thread response time. For now:
      //   - response_rate_pct = accepted threads / all threads (vendor accepted = replied)
      //   - avg_response_minutes = 0 (stubbed until timing column exists)
      supabase
        .from('chat_threads')
        .select('thread_id,inquiry_status,accepted_at,created_at')
        .eq('vendor_profile_id', vendorProfileId),

    ]);

  // -----------------------------------------------------------------------
  // 2. Compute vendor cancellation count properly
  // -----------------------------------------------------------------------
  // event_vendors PK is `vendor_id` (not event_vendor_id).
  // force_majeure_flags.event_vendor_id references event_vendors.vendor_id.
  // TODO: if force_majeure_flags.vendor_profile_id is ever added directly,
  //   remove the two-step join below.
  let vendorCancellationCount = 0;
  {
    // Two-step: get event_vendors.vendor_id for this profile, then count
    // force_majeure_flags with type='vendor_cancellation' referencing those rows.
    // (force_majeure_flags.event_vendor_id → event_vendors.vendor_id)
    const evIds = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('vendor_profile_id', vendorProfileId);
    if (evIds.data && evIds.data.length > 0) {
      const ids = evIds.data.map((r: { vendor_id: string }) => r.vendor_id);
      const { count } = await supabase
        .from('force_majeure_flags')
        .select('flag_id', { count: 'exact', head: true })
        .eq('flag_type', 'vendor_cancellation')
        .in('event_vendor_id', ids);
      vendorCancellationCount = count ?? 0;
    }
  }

  // -----------------------------------------------------------------------
  // 3. Process reviews
  // -----------------------------------------------------------------------
  const reviewRows = reviewsResult.data ?? [];
  const reviews: ReviewForScore[] = reviewRows.map(
    (r: {
      rating_communication: number;
      rating_quality: number;
      rating_value: number;
      rating_on_time: number;
    }) => ({
      avg:
        (r.rating_communication + r.rating_quality + r.rating_value + r.rating_on_time) / 4,
    }),
  );
  const reviewCount = reviews.length;
  const bayesianAvg = computeBayesianReviewAvg(reviews);
  const rawAvg =
    reviewCount > 0
      ? reviews.reduce((acc, r) => acc + r.avg, 0) / reviewCount
      : 0;

  // -----------------------------------------------------------------------
  // 4. Process bookings
  // -----------------------------------------------------------------------
  const bookingRows = (bookingsResult.data ?? []) as Array<{ status: string }>;
  const totalBookings = bookingRows.length;
  const FINALIZED_STATUSES = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
  const finalizedBookingCount = bookingRows.filter((b) =>
    FINALIZED_STATUSES.has(b.status),
  ).length;
  const bookingCompletionRatePct =
    totalBookings > 0 ? Math.round((finalizedBookingCount / totalBookings) * 100) : 0;

  // -----------------------------------------------------------------------
  // 5. Process inquiries / threads
  // -----------------------------------------------------------------------
  const threadRows = (inquiriesResult.data ?? []) as Array<{
    thread_id: string;
    inquiry_status: string;
    accepted_at: string | null;
    created_at: string;
  }>;
  const totalThreads = threadRows.length;
  const repliedThreads = threadRows.filter((t) => t.inquiry_status === 'accepted').length;
  const responseRatePct =
    totalThreads > 0 ? Math.round((repliedThreads / totalThreads) * 100) : 0;

  // TODO: Add vendor_first_reply_at to chat_messages or chat_threads so we can
  //   compute avg_response_minutes = avg(first_vendor_message_at - thread_created_at)
  //   for threads where a vendor replied within 48h.
  const avgResponseMinutes = 0; // stubbed until timing column is available

  // inquiry-to-booking conversion: threads that led to a finalized booking
  // TODO: link chat_threads to event_vendors for exact conversion tracking.
  //   For now, use a ratio approximation: finalized / max(total threads, 1).
  const inquiryToBookingPct =
    totalThreads > 0
      ? Math.min(100, Math.round((finalizedBookingCount / totalThreads) * 100))
      : 0;

  // -----------------------------------------------------------------------
  // 6. Resolve last login via auth.users.last_sign_in_at
  // -----------------------------------------------------------------------
  const profile = profileResult.data as VendorProfileRow | null;
  let lastLoginAt: Date | null = null;
  if (profile?.user_id) {
    try {
      // getUserById is the Supabase admin API method (service role required)
      const { data: authUserData } = await supabase.auth.admin.getUserById(
        profile.user_id,
      );
      if (authUserData?.user?.last_sign_in_at) {
        lastLoginAt = new Date(authUserData.user.last_sign_in_at);
      }
    } catch {
      // If auth admin API fails (e.g. missing user), default to null → 100 score
    }
  }

  // -----------------------------------------------------------------------
  // 7. Profile completeness
  // -----------------------------------------------------------------------
  const profileCompletenessPctValue = profileCompletenessPct(profile);

  // -----------------------------------------------------------------------
  // 8. Compute scores
  // -----------------------------------------------------------------------
  const loginDecayScore = computeLoginDecayScore(lastLoginAt);

  const coupleTrustScore = computeCoupleTrustScore({
    reviews,
    bookingCompletionRatePct,
    vendorCancellationCount,
    responseRatePct,
    avgResponseMinutes,
  });

  // TODO: Wire referralScore when vendor referral tracking is implemented.
  //   referralScore should reflect how many new vendors / couples signed up
  //   via this vendor's invite link. For now stubbed at 0.
  const referralScore = 0;

  const platformHealthScore = computePlatformHealthScore({
    coupleTrustScore,
    loginDecayScore,
    finalizedBookingCount,
    inquiryToBookingPct,
    referralScore,
  });

  const qualityScore = computeQualityScore(coupleTrustScore, platformHealthScore);

  // last_active_at: use the lastLoginAt we already resolved (best proxy in V1)
  const lastActiveAt = lastLoginAt?.toISOString() ?? null;

  // -----------------------------------------------------------------------
  // 9. Upsert into vendor_activity_stats
  // -----------------------------------------------------------------------
  const { error: upsertError } = await supabase
    .from('vendor_activity_stats')
    .upsert(
      {
        vendor_profile_id: vendorProfileId,
        avg_response_minutes: avgResponseMinutes,
        response_rate_pct: responseRatePct,
        booking_completion_rate_pct: bookingCompletionRatePct,
        vendor_cancellation_count: vendorCancellationCount,
        inquiry_to_booking_pct: inquiryToBookingPct,
        finalized_booking_count: finalizedBookingCount,
        review_avg_raw: reviewCount > 0 ? Number(rawAvg.toFixed(2)) : null,
        review_avg_bayesian: Number(bayesianAvg.toFixed(2)),
        review_count: reviewCount,
        last_active_at: lastActiveAt,
        profile_completeness_pct: profileCompletenessPctValue,
        quality_score: qualityScore,
        couple_trust_score: coupleTrustScore,
        platform_health_score: platformHealthScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id' },
    );

  if (upsertError) {
    throw new Error(
      `vendor-activity: upsert failed for ${vendorProfileId}: ${upsertError.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Trigger wrapper (fire-and-forget, safe for after() / waitUntil)
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget wrapper around `recomputeVendorActivityStats`.
 *
 * Never throws — catches and logs errors so callers can use this inside
 * Next.js `after()` or Cloudflare `waitUntil()` without crashing the
 * request handler.
 *
 * Call this from route handlers after:
 *   - a review is submitted / reply posted
 *   - a booking status changes (contracted → complete, force-majeure filed)
 *   - a vendor replies to a thread (inquiry accepted)
 *   - a vendor logs in (to keep login_decay fresh)
 *
 * Example (inside a Server Action or Route Handler):
 *   ```ts
 *   import { after } from 'next/server';
 *   import { triggerVendorActivityRecompute } from '@/lib/vendor-activity';
 *
 *   // ... do main work ...
 *   after(() => triggerVendorActivityRecompute(vendorProfileId));
 *   ```
 */
export async function triggerVendorActivityRecompute(vendorProfileId: string): Promise<void> {
  try {
    await recomputeVendorActivityStats(vendorProfileId);
  } catch (err) {
    // Log but never propagate — this is a background enrichment path.
    // The scores will be stale until the next trigger fires.
    console.error('[vendor-activity] recompute failed for', vendorProfileId, err);
  }
}
