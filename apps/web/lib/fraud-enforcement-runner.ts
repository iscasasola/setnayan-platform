import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  FRAUD_AUTOSUSPEND_THRESHOLD,
  FRAUD_AUTOSUSPEND_MIN_SIGNALS,
  deriveVendorFraudState,
  shouldAutoSuspend,
  type FraudEnforcementAction,
} from '@/lib/fraud-enforcement';

/**
 * Fraud ENFORCEMENT runner — SERVER-ONLY orchestration for the ONE allowed
 * automated action (auto-suspend) + the shared audit-write + the freeze-set
 * reader. The irreversible wipe+ban is NOT here — it is admin-confirmed and
 * lives in app/admin/fraud/actions.ts (routed through the two-admin gate).
 *
 * Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 5.
 *
 * SCOPE LOCK: the only mutation this module performs autonomously is the
 * REVERSIBLE auto-suspend (hide + freeze, NO data loss). It NEVER bans, wipes,
 * or voids data — that is admin-confirmed only.
 *
 * PRIVACY (RA 10173): reads/writes use the SERVICE-ROLE admin client. The audit
 * evidence snapshot carries only NON-PII derived tallies (open signal types +
 * scores + evidence blobs, aggregate score), mirroring fraud_signals.evidence.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Write one row to fraud_enforcement_audit. actorUserId NULL = system (the
 * auto-suspend). Best-effort + fail-soft: a failed audit write logs to Sentry
 * but never rolls back the enforcement action it records.
 */
export async function writeFraudEnforcementAudit(
  admin: Admin,
  row: {
    vendorProfileId: string;
    action: FraudEnforcementAction;
    actorUserId: string | null;
    reason?: string | null;
    evidenceSnapshot?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await admin.from('fraud_enforcement_audit').insert({
      vendor_profile_id: row.vendorProfileId,
      action: row.action,
      actor_user_id: row.actorUserId,
      reason: row.reason ?? null,
      evidence_snapshot: row.evidenceSnapshot ?? {},
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[fraud-enforcement audit] insert failed', error.message);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-enforcement-audit' } });
  }
}

/**
 * Build the NON-PII evidence snapshot for an enforcement audit row from a
 * vendor's OPEN fraud_signals + its aggregate score. Read-only.
 */
export async function buildFraudEvidenceSnapshot(
  admin: Admin,
  vendorProfileId: string,
): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = { captured_at: new Date().toISOString() };
  try {
    const { data: signalRows } = await admin
      .from('fraud_signals')
      .select('signal_type, score, evidence, window_start, window_end')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'open');
    snapshot.open_signals = (signalRows ?? []).map((s) => {
      const r = s as {
        signal_type: string;
        score: number;
        evidence: Record<string, unknown>;
        window_start: string;
        window_end: string;
      };
      return {
        signal_type: r.signal_type,
        score: r.score,
        evidence: r.evidence,
        window_start: r.window_start,
        window_end: r.window_end,
      };
    });

    const { data: aggRow } = await admin
      .from('vendor_fraud_scores')
      .select('max_open_score, sum_open_score, open_signal_count, open_signal_types')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (aggRow) snapshot.aggregate = aggRow;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'fraud-enforcement-snapshot' },
      extra: { vendorProfileId },
    });
  }
  return snapshot;
}

/**
 * AUTO-SUSPEND evaluation for ONE vendor — the single automated action § 5
 * permits. Idempotent + fail-soft.
 *
 * Reads the vendor's current fraud state + its aggregate open-signal score,
 * and, IFF `shouldAutoSuspend` says so (aggregate ≥ FRAUD_AUTOSUSPEND_THRESHOLD
 * AND currently active), atomically:
 *   1. sets fraud_suspended_at = now + flips public_visibility → 'hidden'
 *      (the freeze — hides the vendor + freezes its badges), guarded on the row
 *      STILL being un-suspended so a concurrent run can't double-apply, and
 *   2. writes an `auto_suspend` audit row (actor = system/NULL) with an
 *      evidence snapshot.
 *
 * NEVER bans, NEVER wipes, NEVER voids data. Returns whether it suspended.
 */
export async function maybeAutoSuspendVendor(
  admin: Admin,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const { data: vendorRow } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, fraud_suspended_at, fraud_banned_at, public_visibility')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (!vendorRow) return false;

    const v = vendorRow as {
      fraud_suspended_at: string | null;
      fraud_banned_at: string | null;
      public_visibility: string | null;
    };
    const state = deriveVendorFraudState(v);

    const { data: aggRow } = await admin
      .from('vendor_fraud_scores')
      .select('sum_open_score, open_signal_count, open_signal_types')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const agg = aggRow as {
      sum_open_score: number | null;
      open_signal_count: number | null;
      open_signal_types: string[] | null;
    } | null;
    const aggregate = agg?.sum_open_score ?? 0;
    // Distinct open signal types — the corroboration input for the ≥2-signal
    // guard. Prefer the precomputed count; fall back to the array length so a
    // matview that only surfaces one of the two columns still gates correctly.
    const distinctSignals =
      typeof agg?.open_signal_count === 'number'
        ? agg.open_signal_count
        : (agg?.open_signal_types?.length ?? 0);

    if (!shouldAutoSuspend(aggregate, distinctSignals, state)) return false;

    // Atomic guarded suspend: only flip a vendor that is STILL un-suspended +
    // un-banned (prevents a concurrent double-apply / re-log). We also stash the
    // prior public_visibility so a future un-suspend can restore it — kept in
    // the audit snapshot rather than a schema column (the un-suspend restores to
    // 'coming_soon', the safe pre-verification default, unless the admin
    // re-verifies; documented in the un-suspend action).
    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await admin
      .from('vendor_profiles')
      .update({ fraud_suspended_at: nowIso, public_visibility: 'hidden' })
      .eq('vendor_profile_id', vendorProfileId)
      .is('fraud_suspended_at', null)
      .is('fraud_banned_at', null)
      .select('vendor_profile_id')
      .maybeSingle();

    if (updErr) {
      Sentry.captureException(updErr, {
        tags: { feature: 'fraud-autosuspend' },
        extra: { vendorProfileId },
      });
      return false;
    }
    // Lost the race (another run suspended/banned first) — nothing to log.
    if (!updated) return false;

    const snapshot = await buildFraudEvidenceSnapshot(admin, vendorProfileId);
    snapshot.threshold = FRAUD_AUTOSUSPEND_THRESHOLD;
    snapshot.aggregate_score_at_action = aggregate;
    snapshot.prior_public_visibility = v.public_visibility;

    await writeFraudEnforcementAudit(admin, {
      vendorProfileId,
      action: 'auto_suspend',
      actorUserId: null, // SYSTEM
      reason: `Auto-suspended: aggregate fraud score ${aggregate} ≥ ${FRAUD_AUTOSUSPEND_THRESHOLD}`,
      evidenceSnapshot: snapshot,
    });

    return true;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'fraud-autosuspend' },
      extra: { vendorProfileId },
    });
    return false;
  }
}

/**
 * Sweep every scored vendor and auto-suspend those over the bar. Called at the
 * END of a fraud scoring pass (after the aggregate matview is refreshed), so
 * the aggregate reflects the freshest signals. Fail-soft per vendor. Returns the
 * count of vendors newly suspended.
 */
export async function runAutoSuspendSweep(admin?: Admin): Promise<number> {
  const client = admin ?? createAdminClient();
  let suspended = 0;
  try {
    // Only vendors WITH an open-signal aggregate at/above the bar AND with the
    // corroboration minimum (≥ FRAUD_AUTOSUSPEND_MIN_SIGNALS distinct open signal
    // types) are candidates — the matview omits vendors with no open signals, so
    // this is a tiny set. maybeAutoSuspendVendor re-checks both conditions via
    // shouldAutoSuspend, so this pre-filter is a narrowing optimization, not the
    // authority: a lone maxed signal is skipped here and never auto-suspends.
    const { data: rows } = await client
      .from('vendor_fraud_scores')
      .select('vendor_profile_id, sum_open_score')
      .gte('sum_open_score', FRAUD_AUTOSUSPEND_THRESHOLD)
      .gte('open_signal_count', FRAUD_AUTOSUSPEND_MIN_SIGNALS);
    for (const row of (rows ?? []) as { vendor_profile_id: string }[]) {
      const didSuspend = await maybeAutoSuspendVendor(client, row.vendor_profile_id);
      if (didSuspend) suspended += 1;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-autosuspend-sweep' } });
  }
  return suspended;
}

/**
 * The set of vendor_profile_ids currently FROZEN by fraud enforcement
 * (suspended OR banned). Defense-in-depth for the public read paths: the
 * enforcement writes also flip public_visibility → 'hidden' (which the
 * marketplace + /v/[slug] already exclude), but callers that read a vendor
 * directly by id, or read badge/stat inputs, can `.not(... in ...)` this set to
 * guarantee a frozen vendor never renders publicly even if a visibility flip
 * lagged.
 *
 * Fail-soft: returns [] on error so a DB hiccup degrades to "freeze nobody
 * extra" (the visibility gate still stands) rather than a 500.
 */
export async function fetchFraudFrozenVendorIds(admin?: Admin): Promise<string[]> {
  const client = admin ?? createAdminClient();
  try {
    const { data, error } = await client
      .from('vendor_profiles')
      .select('vendor_profile_id, fraud_suspended_at, fraud_banned_at')
      .or('fraud_suspended_at.not.is.null,fraud_banned_at.not.is.null');
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[fraud-enforcement] fetchFraudFrozenVendorIds failed:', error.message);
      return [];
    }
    const ids: string[] = [];
    for (const row of (data ?? []) as Array<{
      vendor_profile_id: string;
      fraud_suspended_at: string | null;
      fraud_banned_at: string | null;
    }>) {
      if (deriveVendorFraudState(row) !== 'active') ids.push(row.vendor_profile_id);
    }
    return ids;
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-frozen-ids' } });
    return [];
  }
}
