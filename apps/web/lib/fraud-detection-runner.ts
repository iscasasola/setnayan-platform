import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  scoreVendor,
  FRAUD_SIGNAL_TYPES,
  VELOCITY_WINDOW_HOURS,
  type FraudSignalType,
  type SignalScore,
  type VelocityReviewer,
  type ReviewerFootprint,
} from '@/lib/fraud-detection';

/**
 * Fraud-detection RUNNER — SERVER-ONLY I/O orchestration around the pure
 * vendor-level scorers in lib/fraud-detection.ts. Fetches a vendor's data,
 * scores the five § 4 signals, and UPSERTs each into `fraud_signals`, then
 * refreshes the `vendor_fraud_scores` aggregate the Phase-4 queue sorts by.
 *
 * Anti-Fraud & Trust Integrity — Phase 3. Spec:
 * 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 4 + § 6 Phase 3.
 *
 * SCOPE LOCK: DETECT + SCORE ONLY. Nothing here suspends, bans, hides, or
 * mutates a vendor. It writes fraud_signals + refreshes an aggregate matview;
 * that is all. Enforcement (auto-suspend + admin-confirmed wipe) is Phase 4.
 *
 * CRON-FREE (memory: cron-free = after()/waitUntil), mirroring
 * lib/spotlight-awards.ts + lib/review-fraud-screener.ts:
 *   • scoreVendorFraud(vendorProfileId) fires in a Next 15 `after()` task from
 *     the review-create path (submitCoupleReview) — best-effort, fail-soft, so
 *     a scoring hiccup NEVER affects the couple's write.
 *   • runAllFraudScoring() is the full nightly pass — driven by an opportunistic
 *     `after()` piggyback on admin traffic + an admin "Run now" button (the
 *     button itself is Phase 4; the function is exported now).
 *
 * PRIVACY (RA 10173): all reads/writes use the SERVICE-ROLE admin client, which
 * BYPASSES RLS. The real write guard is application-level — ONLY this module
 * constructs that client for fraud scoring. Everything persisted into
 * fraud_signals.evidence is NON-PII (counts/ratios/opaque cluster labels/
 * booleans); this module derives those tallies from personal data but never
 * persists device hashes / IPs / addresses / payment senders / bodies / names.
 */

type Admin = ReturnType<typeof createAdminClient>;

// Booking `source` values that represent a self-imported / host-entered vendor
// row (as opposed to an on-platform marketplace discovery or an invite claim).
// NULL/legacy rows also read as manual. Marketplace + invite + auto-cascade
// paths are EXCLUDED — those are the organic paths.
const IMPORT_LIKE_SOURCES: ReadonlyArray<string> = ['host_manual', 'import', 'admin'];
const ORGANIC_SOURCES: ReadonlyArray<string> = [
  'host_marketplace_search',
  'auto_cascade_from_finalize',
  'invite_claim',
  'vendor_invite',
  'considering_via_compare',
];

const MS_PER_DAY = 86_400_000;

/**
 * Gather the raw data for one vendor and reduce it to the pure scorer's inputs.
 * All the SQL-ish shaping lives here so the scorer stays I/O-free + testable.
 */
async function gatherVendorInputs(
  admin: Admin,
  vendorProfileId: string,
  nowMs: number,
): Promise<{
  inputs: Parameters<typeof scoreVendor>[0];
  windowStart: string;
  windowEnd: string;
} | null> {
  // 1. Trusted, countable reviews for this vendor (receipt-backed only — the
  //    same provenance gate the trusted-stat view applies).
  const { data: reviewRows } = await admin
    .from('vendor_reviews')
    .select('review_id, couple_user_id, event_id, rating_overall, created_at')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('booked_through_setnayan', true);
  const reviews = (reviewRows ?? []) as {
    review_id: string;
    couple_user_id: string | null;
    event_id: string;
    rating_overall: number;
    created_at: string;
  }[];

  const reviewerIds = Array.from(
    new Set(reviews.map((r) => r.couple_user_id).filter((id): id is string => !!id)),
  );

  // 2. Identity clusters for the reviewing couples (Phase-2 store).
  const clusterByUser = new Map<string, string>();
  if (reviewerIds.length > 0) {
    const { data: clusterRows } = await admin
      .from('identity_clusters')
      .select('user_id, cluster_id')
      .in('user_id', reviewerIds);
    for (const row of (clusterRows ?? []) as { user_id: string; cluster_id: string }[]) {
      clusterByUser.set(row.user_id, String(row.cluster_id));
    }
  }

  // 3. Reviewer account ages (users.created_at) for the velocity signal.
  const createdAtByUser = new Map<string, number>();
  if (reviewerIds.length > 0) {
    const { data: userRows } = await admin
      .from('users')
      .select('user_id, created_at')
      .in('user_id', reviewerIds);
    for (const row of (userRows ?? []) as { user_id: string; created_at: string }[]) {
      createdAtByUser.set(row.user_id, new Date(row.created_at).getTime());
    }
  }

  // 4. Reviewer footprint for graph_isolation: how many event_vendors links and
  //    how many distinct events each reviewer has (across ALL their events).
  //    An account whose ONLY marketplace touch is this vendor is isolated.
  const footprintByUser = new Map<string, ReviewerFootprint>();
  if (reviewerIds.length > 0) {
    // The events each reviewer is a couple-member on.
    const { data: memberRows } = await admin
      .from('event_members')
      .select('user_id, event_id')
      .eq('member_type', 'couple')
      .in('user_id', reviewerIds);
    const eventsByUser = new Map<string, Set<string>>();
    for (const row of (memberRows ?? []) as { user_id: string; event_id: string }[]) {
      if (!eventsByUser.has(row.user_id)) eventsByUser.set(row.user_id, new Set());
      eventsByUser.get(row.user_id)!.add(row.event_id);
    }
    // The distinct vendor links across those events.
    const allEventIds = Array.from(
      new Set(Array.from(eventsByUser.values()).flatMap((s) => Array.from(s))),
    );
    const vendorLinksByEvent = new Map<string, number>();
    if (allEventIds.length > 0) {
      const { data: evRows } = await admin
        .from('event_vendors')
        .select('event_id')
        .in('event_id', allEventIds);
      for (const row of (evRows ?? []) as { event_id: string }[]) {
        vendorLinksByEvent.set(
          row.event_id,
          (vendorLinksByEvent.get(row.event_id) ?? 0) + 1,
        );
      }
    }
    for (const uid of reviewerIds) {
      const events = eventsByUser.get(uid) ?? new Set<string>();
      const totalVendorLinks = Array.from(events).reduce(
        (acc, eid) => acc + (vendorLinksByEvent.get(eid) ?? 0),
        0,
      );
      footprintByUser.set(uid, {
        totalVendorLinks,
        // "other events" = events beyond the one they reviewed. We approximate
        // per-reviewer with their total distinct events minus 1 (the reviewed
        // one). Floors at 0.
        otherEventCount: Math.max(0, events.size - 1),
      });
    }
  }

  // 5. Imported bookings for import_spike: host_manual/import/NULL-source
  //    delivered/complete bookings linked to this vendor, classified as
  //    "unbacked" when they have NEITHER a matched payment NOR an arm's-length
  //    couple (a couple-roster member who is NOT the vendor owner/team).
  const { data: bookingRows } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, source, status')
    .eq('linked_vendor_profile_id', vendorProfileId)
    .in('status', ['delivered', 'complete']);
  const bookings = (bookingRows ?? []) as {
    vendor_id: string;
    event_id: string;
    source: string | null;
    status: string;
  }[];

  const importedBookings = bookings.filter(
    (b) => !ORGANIC_SOURCES.includes(b.source ?? '')
      && (b.source == null || IMPORT_LIKE_SOURCES.includes(b.source)),
  );

  // Vendor owner id (for the arm's-length check).
  const { data: profileRow } = await admin
    .from('vendor_profiles')
    .select('user_id')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const vendorOwnerId = (profileRow as { user_id: string | null } | null)?.user_id ?? null;

  let unbackedImportedCount = 0;
  for (const b of importedBookings) {
    // (a) reconciled payment path — any matched payment on an order for this event.
    const { data: orderRows } = await admin
      .from('orders')
      .select('order_id')
      .eq('event_id', b.event_id);
    const orderIds = ((orderRows ?? []) as { order_id: string }[]).map((o) => o.order_id);
    let hasReconciledPayment = false;
    if (orderIds.length > 0) {
      const { count } = await admin
        .from('payments')
        .select('payment_id', { count: 'exact', head: true })
        .in('order_id', orderIds)
        .eq('status', 'matched');
      hasReconciledPayment = (count ?? 0) > 0;
    }

    // (b) arm's-length couple path — a couple-roster member who is NOT the vendor
    //     owner. (Full team/internal exclusion lives in the vetted stat views;
    //     here we use the owner check as the cheap arm's-length proxy.)
    const { data: coupleRows } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', b.event_id)
      .eq('member_type', 'couple');
    const coupleIds = ((coupleRows ?? []) as { user_id: string }[]).map((m) => m.user_id);
    const hasArmsLengthCouple = coupleIds.some((id) => id && id !== vendorOwnerId);

    // Unbacked = BOTH paths missing (§ 3 rule 2).
    if (!hasReconciledPayment && !hasArmsLengthCouple) unbackedImportedCount += 1;
  }

  // ── Reduce to the pure scorer inputs ──────────────────────────────────────

  // ring — one cluster label per trusted review (fall back to the raw user id
  // as its own singleton when the clusters matview has no row yet).
  const clusterIds = reviews
    .map((r) =>
      r.couple_user_id
        ? clusterByUser.get(r.couple_user_id) ?? r.couple_user_id
        : null,
    )
    .filter((c): c is string => !!c);

  // velocity — one entry per review with an identifiable reviewer.
  const velocityReviewers: VelocityReviewer[] = reviews
    .filter((r) => r.couple_user_id)
    .map((r) => {
      const createdMs = createdAtByUser.get(r.couple_user_id as string);
      const reviewedMs = new Date(r.created_at).getTime();
      const ageDays =
        createdMs != null ? Math.floor((reviewedMs - createdMs) / MS_PER_DAY) : 9999;
      return {
        reviewedAtMs: reviewedMs,
        accountAgeDaysAtReview: ageDays,
        ratingOverall: r.rating_overall,
      };
    });

  // graph_isolation — one footprint per DISTINCT reviewer.
  const footprints: ReviewerFootprint[] = reviewerIds.map(
    (uid) => footprintByUser.get(uid) ?? { totalVendorLinks: 0, otherEventCount: 0 },
  );

  // rating_shape — every trusted review's overall rating.
  const ratings = reviews.map((r) => r.rating_overall);

  const windowEndMs = nowMs;
  const windowStartMs = windowEndMs - VELOCITY_WINDOW_HOURS * 3600_000;

  return {
    inputs: {
      ring: { clusterIds },
      velocity: { reviewers: velocityReviewers, windowEndMs },
      graph_isolation: { reviewers: footprints },
      import_spike: {
        unbackedImportedCount,
        totalImportedCount: importedBookings.length,
      },
      rating_shape: { ratings },
    },
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
  };
}

/**
 * Score ONE vendor's five fraud signals and UPSERT them into fraud_signals.
 * Idempotent per (vendor, signal_type, window_start) — re-running refreshes the
 * row's score/evidence in place (never stacks duplicates), and never touches an
 * admin-resolved (dismissed/actioned) row's status.
 *
 * Best-effort + fail-soft: every path swallows + Sentry-captures its error so a
 * caller's user write (a review submit) is never affected. Returns the scores
 * (mainly for the full-pass summary + tests of the runner shape).
 */
export async function scoreVendorFraud(
  vendorProfileId: string,
  opts: { now?: Date; refreshAggregate?: boolean } = {},
): Promise<Partial<Record<FraudSignalType, number>>> {
  const summary: Partial<Record<FraudSignalType, number>> = {};
  try {
    const admin = createAdminClient();
    const nowMs = (opts.now ?? new Date()).getTime();
    const gathered = await gatherVendorInputs(admin, vendorProfileId, nowMs);
    if (!gathered) return summary;

    const scores = scoreVendor(gathered.inputs);

    for (const type of FRAUD_SIGNAL_TYPES) {
      const result: SignalScore = scores[type];
      summary[type] = result.score;

      // Upsert on the dedup key. We DON'T overwrite an admin-resolved row's
      // status; the UPSERT sets status back toward 'open' ONLY on a fresh insert
      // (default). On conflict we update score/evidence/detected_at + window_end
      // but leave status/resolution untouched so P4 decisions stick.
      const { data: existing } = await admin
        .from('fraud_signals')
        .select('id, status')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('signal_type', type)
        .eq('window_start', gathered.windowStart)
        .maybeSingle();

      if (existing) {
        await admin
          .from('fraud_signals')
          .update({
            score: result.score,
            evidence: result.evidence,
            detected_at: new Date(nowMs).toISOString(),
            window_end: gathered.windowEnd,
          })
          .eq('id', (existing as { id: number }).id);
      } else {
        await admin.from('fraud_signals').insert({
          vendor_profile_id: vendorProfileId,
          signal_type: type,
          score: result.score,
          evidence: result.evidence,
          detected_at: new Date(nowMs).toISOString(),
          window_start: gathered.windowStart,
          window_end: gathered.windowEnd,
        });
      }
    }

    if (opts.refreshAggregate !== false) {
      await admin.rpc('refresh_vendor_fraud_scores');
      // Phase 4 (§ 5): the ONE allowed automated action. After the aggregate is
      // fresh, evaluate THIS vendor for the reversible auto-suspend. Idempotent
      // + fail-soft inside maybeAutoSuspendVendor — never re-suspends, never
      // bans/wipes/voids. Only runs on the single-vendor path; the full pass
      // sweeps once at the end via runAutoSuspendSweep. Deferred import so this
      // DETECT module doesn't hard-couple to the enforcement runner at load.
      const { maybeAutoSuspendVendor } = await import('@/lib/fraud-enforcement-runner');
      await maybeAutoSuspendVendor(admin, vendorProfileId);
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'fraud-detection-runner' },
      extra: { vendorProfileId },
    });
  }
  return summary;
}

/**
 * FULL PASS — score EVERY published vendor. This is the "nightly" pass, driven
 * cron-free by an opportunistic after() piggyback on admin traffic + an admin
 * "Run now" (the button is Phase 4; this function is exported now). Refreshes
 * the aggregate ONCE at the end rather than per-vendor. Fail-soft per vendor so
 * one bad vendor never aborts the pass. Returns a summary for the admin toast.
 */
export async function runAllFraudScoring(
  opts: { now?: Date } = {},
): Promise<{ vendorsScanned: number; signalsWritten: number }> {
  const admin = createAdminClient();
  const now = opts.now ?? new Date();

  const { data: vendorRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('is_published', true);
  const vendorIds = ((vendorRows ?? []) as { vendor_profile_id: string }[]).map(
    (v) => v.vendor_profile_id,
  );

  let signalsWritten = 0;
  for (const id of vendorIds) {
    // Skip the per-vendor aggregate refresh; we refresh once at the end.
    const scores = await scoreVendorFraud(id, { now, refreshAggregate: false });
    signalsWritten += Object.keys(scores).length;
  }

  // One aggregate refresh for the whole pass. Fail-soft.
  try {
    await admin.rpc('refresh_vendor_fraud_scores');
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-detection-runner' } });
  }

  // Phase 4 (§ 5): sweep the freshly-scored aggregate and auto-suspend every
  // vendor over the bar (the ONE allowed automated action — reversible, no data
  // loss). Fail-soft per vendor inside the sweep; a scoring pass never bans.
  try {
    const { runAutoSuspendSweep } = await import('@/lib/fraud-enforcement-runner');
    await runAutoSuspendSweep(admin);
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-detection-runner' } });
  }

  return { vendorsScanned: vendorIds.length, signalsWritten };
}

// ---- Opportunistic, cron-free nightly trigger (Next 15 after()) -------------

/**
 * In-process throttle so the after()-driven full pass fires AT MOST once per
 * server instance per calendar day. Best-effort on top of the idempotent UPSERT
 * — even without it a re-run is a cheap no-op. Reset on deploy (module reload),
 * which is fine: at most one extra pass per deploy. Mirrors spotlight-awards.ts.
 */
let lastAutoDay: string | null = null;

function currentDayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Cron-free opportunistic full pass. Call inside a Next 15 `after()` on a
 * high-traffic admin/server surface. Runs the full pass ONCE per day per
 * instance, then short-circuits. Never throws (swallows + logs) so it can't
 * break the request it piggybacks on. If no admin visits, the Phase-4 admin
 * "Run now" button is always the manual fallback.
 */
export async function maybeRunNightlyFraudScoring(now: Date = new Date()): Promise<void> {
  const day = currentDayKey(now);
  if (lastAutoDay === day) return;
  lastAutoDay = day;
  try {
    await runAllFraudScoring({ now });
  } catch (err) {
    lastAutoDay = null; // let a transient failure retry on the next request
    // eslint-disable-next-line no-console
    console.error('[fraud-detection] opportunistic nightly pass failed', err);
  }
}
