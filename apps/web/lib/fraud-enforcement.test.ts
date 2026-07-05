/**
 * Unit suite for the PURE fraud-enforcement decision logic (Anti-Fraud Phase 4,
 * § 5). Deterministic — no I/O, no clock. Covers:
 *   • the auto-suspend threshold decision (the ONE automated action),
 *   • the derived vendor fraud-state,
 *   • the "frozen vendor excluded" freeze predicate the public read paths use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FRAUD_AUTOSUSPEND_THRESHOLD,
  FRAUD_AUTOSUSPEND_MIN_SIGNALS,
  deriveVendorFraudState,
  isFrozenByFraud,
  shouldAutoSuspend,
} from './fraud-enforcement';
import { VENDOR_FRAUD_ATTENTION_THRESHOLD } from './fraud-detection';

// ── threshold invariant ──────────────────────────────────────────────────────

test('auto-suspend bar sits strictly above the advisory attention bar', () => {
  // The owner-locked model (§ 5): a reversible auto-suspend is a STRONGER signal
  // than "worth an admin's eyes", so its bar must be higher.
  assert.ok(FRAUD_AUTOSUSPEND_THRESHOLD > VENDOR_FRAUD_ATTENTION_THRESHOLD);
});

// ── deriveVendorFraudState ───────────────────────────────────────────────────

test('state: no timestamps → active', () => {
  assert.equal(deriveVendorFraudState({}), 'active');
  assert.equal(
    deriveVendorFraudState({ fraud_suspended_at: null, fraud_banned_at: null }),
    'active',
  );
});

test('state: suspended timestamp only → suspended', () => {
  assert.equal(
    deriveVendorFraudState({ fraud_suspended_at: '2026-07-05T00:00:00Z' }),
    'suspended',
  );
});

test('state: banned wins over suspended', () => {
  assert.equal(
    deriveVendorFraudState({
      fraud_suspended_at: '2026-07-05T00:00:00Z',
      fraud_banned_at: '2026-07-05T01:00:00Z',
    }),
    'banned',
  );
});

// ── isFrozenByFraud (the freeze predicate) ───────────────────────────────────

test('freeze: active vendor is NOT frozen', () => {
  assert.equal(isFrozenByFraud({}), false);
});

test('freeze: suspended vendor IS frozen (hidden + badges frozen)', () => {
  assert.equal(isFrozenByFraud({ fraud_suspended_at: '2026-07-05T00:00:00Z' }), true);
});

test('freeze: banned vendor IS frozen', () => {
  assert.equal(isFrozenByFraud({ fraud_banned_at: '2026-07-05T00:00:00Z' }), true);
});

// A concrete "suspended vendor excluded from badges/marketplace" filter, mirror
// of the exclusion the runner's fetchFraudFrozenVendorIds resolves server-side.
test('freeze: filtering a vendor list drops suspended + banned, keeps active', () => {
  const rows = [
    { id: 'v-active', fraud_suspended_at: null, fraud_banned_at: null },
    { id: 'v-suspended', fraud_suspended_at: '2026-07-05T00:00:00Z', fraud_banned_at: null },
    { id: 'v-banned', fraud_suspended_at: null, fraud_banned_at: '2026-07-05T00:00:00Z' },
  ];
  const visible = rows.filter((r) => !isFrozenByFraud(r)).map((r) => r.id);
  assert.deepEqual(visible, ['v-active']);
});

// ── shouldAutoSuspend (the one automated decision) ───────────────────────────
// Owner-decided "safe" config (2026-07-05): auto-suspend requires BOTH
// score ≥ 95 (FRAUD_AUTOSUSPEND_THRESHOLD) AND ≥ 2 distinct open signal types
// (FRAUD_AUTOSUSPEND_MIN_SIGNALS) — corroboration guard. The signal-count arg is
// the middle parameter: shouldAutoSuspend(score, distinctSignalCount, state).

test('config: threshold is 95 and min-signals is 2 (owner "safe" config)', () => {
  assert.equal(FRAUD_AUTOSUSPEND_THRESHOLD, 95);
  assert.equal(FRAUD_AUTOSUSPEND_MIN_SIGNALS, 2);
});

test('auto-suspend: below the bar → no (even with enough signals)', () => {
  assert.equal(
    shouldAutoSuspend(FRAUD_AUTOSUSPEND_THRESHOLD - 1, FRAUD_AUTOSUSPEND_MIN_SIGNALS, 'active'),
    false,
  );
});

test('auto-suspend: at the bar WITH ≥2 signals → yes', () => {
  assert.equal(
    shouldAutoSuspend(FRAUD_AUTOSUSPEND_THRESHOLD, FRAUD_AUTOSUSPEND_MIN_SIGNALS, 'active'),
    true,
  );
});

test('auto-suspend: above the bar WITH ≥2 signals → yes', () => {
  assert.equal(
    shouldAutoSuspend(FRAUD_AUTOSUSPEND_THRESHOLD + 5, FRAUD_AUTOSUSPEND_MIN_SIGNALS, 'active'),
    true,
  );
});

// ── the ≥2 distinct-signal corroboration guard ───────────────────────────────

test('auto-suspend: score 95 with exactly 2 signals → yes', () => {
  assert.equal(shouldAutoSuspend(95, 2, 'active'), true);
});

test('auto-suspend: score 96 with only 1 signal → NO (needs corroboration)', () => {
  // A lone over-eager heuristic (e.g. rating_shape on an all-5★ legit vendor)
  // must never auto-suspend on its own, no matter how high the single score.
  assert.equal(shouldAutoSuspend(96, 1, 'active'), false);
});

test('auto-suspend: score 94 with 3 signals → NO (below the 95 bar)', () => {
  assert.equal(shouldAutoSuspend(94, 3, 'active'), false);
});

test('auto-suspend: a maxed single signal (100, 1 signal) never auto-suspends', () => {
  assert.equal(shouldAutoSuspend(100, 1, 'active'), false);
});

test('auto-suspend: an advisory-level score (< bar) never auto-suspends', () => {
  // A score that clears the "needs review" attention bar but not the suspend bar
  // must NOT auto-suspend — it only surfaces in the queue.
  assert.equal(
    shouldAutoSuspend(VENDOR_FRAUD_ATTENTION_THRESHOLD, 5, 'active'),
    false,
  );
});

test('auto-suspend: idempotent — already suspended never re-suspends', () => {
  assert.equal(shouldAutoSuspend(100, 3, 'suspended'), false);
});

test('auto-suspend: banned vendor is never (re-)auto-suspended', () => {
  assert.equal(shouldAutoSuspend(100, 3, 'banned'), false);
});

test('auto-suspend: missing/NaN score treated as 0 → no', () => {
  assert.equal(shouldAutoSuspend(null, 3, 'active'), false);
  assert.equal(shouldAutoSuspend(undefined, 3, 'active'), false);
  assert.equal(shouldAutoSuspend(Number.NaN, 3, 'active'), false);
});

test('auto-suspend: missing/NaN signal count treated as 0 → no', () => {
  assert.equal(shouldAutoSuspend(100, null, 'active'), false);
  assert.equal(shouldAutoSuspend(100, undefined, 'active'), false);
  assert.equal(shouldAutoSuspend(100, Number.NaN, 'active'), false);
});
