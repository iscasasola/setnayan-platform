import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  scoreReviewFraud,
  BURST_WINDOW_HOURS,
  REVIEW_FRAUD_FLAG_THRESHOLD,
} from '@/lib/review-fraud-scoring';

/**
 * Review-fraud screener — SERVER-ONLY I/O orchestration around the pure scorer
 * in lib/review-fraud-scoring.ts (velocity/burst · rating anomaly · reviewer
 * device-linkage). Signals BEYOND the 5-signal self-review hard-gate
 * (lib/self-review-gate.ts + 20260515030000_self_review_gate.sql). NO LLM.
 *
 * WHERE IT RUNS: server-side, in a Next `after()` task fired the moment a couple
 * submits a review (app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts
 * → submitCoupleReview). NO polling cron. Best-effort + fail-soft: any throw is
 * swallowed + Sentry-captured so a screening hiccup never affects the review the
 * couple just left.
 *
 * A flag lands in `integrity_flags` (kind='review_fraud') ONLY when the score
 * >= REVIEW_FRAUD_FLAG_THRESHOLD. Detect-and-review only — the flag NEVER
 * deletes the review or dings the vendor; an admin adjudicates at
 * /admin/integrity-watch.
 *
 * PRIVACY (RA 10173): the `detail` JSONB persisted with a flag carries only
 * NON-PII derived evidence — component scores + small counts + booleans. NO
 * device hashes, NO IPs, NO review bodies, NO reviewer names.
 *
 * TRUST BOUNDARY (honest, mirrors vendor-image-repost-watch): all reads/writes
 * here use the SERVICE-ROLE admin client, which BYPASSES RLS. RLS deny-by-default
 * protects couples/vendors from touching integrity_flags, but it is NOT the guard
 * for THIS code — the real guard is that ONLY the post-review after() task + the
 * admin rescan action ever construct the admin client.
 */

// Re-export the pure scorer surface so consumers can import screener + scoring
// types from one module (the admin page imports the labels/types).
export {
  scoreReviewFraud,
  REVIEW_FRAUD_FLAG_THRESHOLD,
  REVIEW_FRAUD_REASON_LABEL,
} from '@/lib/review-fraud-scoring';
export type {
  ReviewFraudDetail,
  ReviewFraudScore,
} from '@/lib/review-fraud-scoring';

type ReviewRow = {
  review_id: string;
  vendor_profile_id: string;
  couple_user_id: string | null;
  rating_overall: number;
  created_at: string;
};

/**
 * Count OTHER reviewers of the SAME vendor who share ANY device fingerprint with
 * `reviewerUserId`. Reuses the exact linkage substrate the self-review gate uses
 * (public.user_devices.device_hash). Returns the count of DISTINCT peer reviewer
 * user_ids — never the hashes themselves, so nothing PII is surfaced.
 */
async function countSharedDevicePeers(
  admin: ReturnType<typeof createAdminClient>,
  reviewerUserId: string,
  peerCoupleIds: ReadonlyArray<string>,
): Promise<number> {
  const peerIds = peerCoupleIds.filter((id) => id && id !== reviewerUserId);
  if (peerIds.length === 0) return 0;

  // Devices belonging to the reviewer.
  const { data: myDevices } = await admin
    .from('user_devices')
    .select('device_hash')
    .eq('user_id', reviewerUserId);
  const myHashes = new Set(
    ((myDevices ?? []) as { device_hash: string }[]).map((d) => d.device_hash),
  );
  if (myHashes.size === 0) return 0;

  // Devices belonging to the OTHER reviewers of this vendor.
  const { data: peerDevices } = await admin
    .from('user_devices')
    .select('user_id, device_hash')
    .in('user_id', peerIds);

  const shared = new Set<string>();
  for (const row of (peerDevices ?? []) as {
    user_id: string;
    device_hash: string;
  }[]) {
    if (myHashes.has(row.device_hash)) shared.add(row.user_id);
  }
  return shared.size;
}

/**
 * Screen ONE just-submitted review and, if it scores >= threshold, upsert a
 * review_fraud row into integrity_flags for the /admin/integrity-watch queue.
 *
 * Best-effort + fail-soft — every path swallows + Sentry-captures its error so
 * the caller's review write is never affected. Idempotent: deduped on
 * subject_review_id (partial unique index), so re-screening the same review
 * refreshes an OPEN flag's score in place, and never re-opens a resolved one.
 */
export async function screenReviewForFraud(reviewId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    // 1. The subject review.
    const { data: subject } = await admin
      .from('vendor_reviews')
      .select('review_id, vendor_profile_id, couple_user_id, rating_overall, created_at')
      .eq('review_id', reviewId)
      .maybeSingle();
    const review = subject as ReviewRow | null;
    if (!review) return;

    // 2. All OTHER reviews for the same vendor (for burst + norm + peer set).
    const { data: siblingsRaw } = await admin
      .from('vendor_reviews')
      .select('review_id, couple_user_id, rating_overall, created_at')
      .eq('vendor_profile_id', review.vendor_profile_id)
      .neq('review_id', reviewId);
    const siblings = (siblingsRaw ?? []) as Omit<ReviewRow, 'vendor_profile_id'>[];

    // Burst — OTHER reviews within the trailing window of this review's created_at.
    const windowStart =
      new Date(review.created_at).getTime() - BURST_WINDOW_HOURS * 3600_000;
    const othersInWindow = siblings.filter(
      (s) => new Date(s.created_at).getTime() >= windowStart,
    ).length;

    // Norm — vendor mean overall across PRIOR reviews (all siblings).
    const priorCount = siblings.length;
    const vendorMean =
      priorCount > 0
        ? siblings.reduce((acc, s) => acc + s.rating_overall, 0) / priorCount
        : null;

    // Peer set — distinct OTHER reviewer user_ids for the device-linkage probe.
    const peerCoupleIds = Array.from(
      new Set(
        siblings
          .map((s) => s.couple_user_id)
          .filter((id): id is string => !!id),
      ),
    );
    const peerReviewerCount = review.couple_user_id
      ? await countSharedDevicePeers(admin, review.couple_user_id, peerCoupleIds)
      : 0;

    // 3. Score (pure).
    const { score, reason, detail } = scoreReviewFraud({
      ratingOverall: review.rating_overall,
      othersInWindow,
      vendorMean,
      priorCount,
      peerReviewerCount,
    });

    if (score < REVIEW_FRAUD_FLAG_THRESHOLD) return; // below the bar — no flag.

    // 4. Upsert the flag (deduped on subject_review_id). Refresh in place on
    //    re-screen, but NEVER re-open a flag an admin already resolved.
    const { data: existing } = await admin
      .from('integrity_flags')
      .select('id, status')
      .eq('subject_review_id', reviewId)
      .eq('kind', 'review_fraud')
      .maybeSingle();

    if (existing) {
      if ((existing as { status: string }).status !== 'open') return;
      await admin
        .from('integrity_flags')
        .update({ score, reason, detail })
        .eq('id', (existing as { id: number }).id);
      return;
    }

    await admin.from('integrity_flags').insert({
      kind: 'review_fraud',
      subject_vendor_id: review.vendor_profile_id,
      subject_review_id: reviewId,
      score,
      reason,
      detail,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'review-fraud-screener' },
      extra: { reviewId },
    });
  }
}

/**
 * Admin backfill — re-screen EVERY existing review against the current scorer.
 * REQUIRED for the queue to have signal at launch: the after() task only screens
 * reviews submitted after this ships. Runs service-side; idempotent (per-review
 * upsert, never re-opens a resolved flag). Returns a summary for the admin UI.
 */
export async function rescanAllReviewsForFraud(): Promise<{
  reviewsScanned: number;
  flagsUpserted: number;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_reviews')
    .select('review_id')
    .order('created_at', { ascending: false })
    .limit(5000);
  const ids = ((data ?? []) as { review_id: string }[]).map((r) => r.review_id);

  let flagsUpserted = 0;
  for (const id of ids) {
    const before = await admin
      .from('integrity_flags')
      .select('id', { count: 'exact', head: true })
      .eq('subject_review_id', id)
      .eq('kind', 'review_fraud');
    await screenReviewForFraud(id);
    const after = await admin
      .from('integrity_flags')
      .select('id', { count: 'exact', head: true })
      .eq('subject_review_id', id)
      .eq('kind', 'review_fraud');
    if ((after.count ?? 0) > (before.count ?? 0)) flagsUpserted += 1;
  }
  return { reviewsScanned: ids.length, flagsUpserted };
}
