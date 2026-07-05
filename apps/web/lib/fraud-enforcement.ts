/**
 * Fraud ENFORCEMENT — shared constants, types, and PURE decision logic for
 * Phase 4 of the anti-fraud workstream. No I/O here (so it's importable by both
 * client + server + tests); the server-only orchestration lives in
 * lib/fraud-enforcement-runner.ts and app/admin/fraud/actions.ts.
 *
 * Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 5 (Enforcement),
 *       § 6 Phase 4.
 *
 * OWNER-LOCKED TWO-STAGE MODEL (§ 5, 2026-07-05):
 *   • AUTO-SUSPEND — reversible, SYSTEM-initiated. Fires when a vendor's
 *     aggregate fraud score crosses FRAUD_AUTOSUSPEND_THRESHOLD. Hides the
 *     vendor + freezes badges; destroys NO data. One admin action reverses it.
 *   • WIPE + BAN — irreversible, ADMIN-CONFIRMED ONLY, NEVER automated. A human
 *     admin confirms (routed through the two-admin approval gate). Voids the
 *     ring's reviews/events, tombstones + permanently bans the vendor. Appeal
 *     routes to the help-center ticket queue.
 */

import { VENDOR_FRAUD_ATTENTION_THRESHOLD } from '@/lib/fraud-detection';

/**
 * The HIGH-confidence aggregate score at/above which the SYSTEM auto-suspends a
 * vendor (reversible). Deliberately well ABOVE the Phase-3 advisory
 * `VENDOR_FRAUD_ATTENTION_THRESHOLD` (60 — "worth an admin's eyes") so an
 * auto-suspend only fires on a strong, multi-signal or maxed-single-signal
 * picture, never on a borderline "needs review" score.
 *
 * The aggregate compared against this is `sum_open_score` from
 * `vendor_fraud_scores` (the summed open-signal score, clamped to 100), so a
 * vendor tripping several detectors reaches the bar faster than one tripping a
 * single moderate signal. A lone maxed detector (score 100) also clears it.
 *
 * NOT hardcoded into the queue UI — the queue surfaces the aggregate + this bar
 * so an admin can see why a vendor did (or didn't) auto-suspend.
 */
export const FRAUD_AUTOSUSPEND_THRESHOLD = 90;

// Sanity: the auto-suspend bar must sit strictly above the advisory bar, or the
// "reversible suspend is a stronger signal than needs-review" invariant breaks.
// This is a compile-time-ish guard executed at module load (cheap, once).
if (FRAUD_AUTOSUSPEND_THRESHOLD <= VENDOR_FRAUD_ATTENTION_THRESHOLD) {
  throw new Error(
    'FRAUD_AUTOSUSPEND_THRESHOLD must be strictly greater than VENDOR_FRAUD_ATTENTION_THRESHOLD',
  );
}

/** The four audited enforcement actions (mirrors the DB enum). */
export type FraudEnforcementAction =
  | 'auto_suspend'
  | 'unsuspend'
  | 'dismiss'
  | 'ban_wipe';

export const FRAUD_ENFORCEMENT_ACTIONS: readonly FraudEnforcementAction[] = [
  'auto_suspend',
  'unsuspend',
  'dismiss',
  'ban_wipe',
] as const;

export const FRAUD_ENFORCEMENT_ACTION_LABEL: Record<FraudEnforcementAction, string> = {
  auto_suspend: 'Auto-suspended (system)',
  unsuspend: 'Un-suspended',
  dismiss: 'Dismissed (false positive)',
  ban_wipe: 'Wiped + permanently banned',
};

/**
 * The enforcement state a vendor is in, DERIVED from the three fraud_* columns.
 * A single derived value keeps the freeze checks + queue badges consistent.
 *   • 'banned'    — fraud_banned_at set (irreversible)
 *   • 'suspended' — fraud_suspended_at set, not banned (reversible)
 *   • 'active'    — neither
 */
export type VendorFraudState = 'active' | 'suspended' | 'banned';

export type VendorFraudStateInput = {
  fraud_suspended_at?: string | null;
  fraud_banned_at?: string | null;
};

/**
 * Derive the enforcement state from a vendor row's fraud_* columns. Banned wins
 * over suspended (a banned vendor may also carry the earlier suspend timestamp).
 */
export function deriveVendorFraudState(row: VendorFraudStateInput): VendorFraudState {
  if (row.fraud_banned_at) return 'banned';
  if (row.fraud_suspended_at) return 'suspended';
  return 'active';
}

/**
 * Is this vendor FROZEN from every public surface (marketplace card, badges,
 * public star average, /v/[slug])? True for BOTH suspended + banned. The
 * enforcement writes ALSO flip public_visibility to 'hidden', so most public
 * read paths already exclude these vendors — this is the explicit,
 * defense-in-depth predicate the badge/stat inputs use.
 */
export function isFrozenByFraud(row: VendorFraudStateInput): boolean {
  return deriveVendorFraudState(row) !== 'active';
}

/**
 * PURE auto-suspend decision. Given a vendor's aggregate open-signal score and
 * whether it is ALREADY suspended/banned, decide whether the SYSTEM should
 * auto-suspend it now.
 *
 * Idempotent by construction: returns false when the vendor is already
 * suspended or banned (never re-suspends, never downgrades a ban), so the runner
 * can call it unconditionally.
 *
 * @param aggregateScore  vendor_fraud_scores.sum_open_score (0..100), or 0/undefined when the vendor has no open signal row.
 * @param currentState    the vendor's derived fraud state.
 */
export function shouldAutoSuspend(
  aggregateScore: number | null | undefined,
  currentState: VendorFraudState,
): boolean {
  if (currentState !== 'active') return false;
  const score = typeof aggregateScore === 'number' && Number.isFinite(aggregateScore)
    ? aggregateScore
    : 0;
  return score >= FRAUD_AUTOSUSPEND_THRESHOLD;
}
