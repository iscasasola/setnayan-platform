/**
 * Unit suite for the per-plan-group category state machine
 * (`resolveCategoryState`). Load-bearing invariants:
 *   • Explore Replan slice A: an explicit decision='complete' resolves to
 *     'done' even when no vendor row has reached delivered/complete — the
 *     couple's "I'm done with this category" outranks the status derivation.
 *   • 'excluded' / 'deferred' still win over everything, unchanged.
 *   • A null decision leaves the vendor-status derivation untouched.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCategoryState } from './checklist-state';

// ── 'complete' (Explore Replan slice A) ─────────────────────────────────────

test("'complete' resolves to done with no vendors at all", () => {
  assert.equal(resolveCategoryState({ decision: 'complete' }, []), 'done');
});

test("'complete' resolves to done even while vendors are mid-flight", () => {
  // Without the decision these would be 'searching' / 'in_progress' — the
  // explicit "I'm done" outranks the vendor-status derivation.
  assert.equal(
    resolveCategoryState({ decision: 'complete' }, [
      { status: 'shortlisted' },
      { status: 'shortlisted' },
    ]),
    'done',
  );
  assert.equal(
    resolveCategoryState({ decision: 'complete' }, [{ status: 'contracted' }]),
    'done',
  );
});

// ── 'excluded' / 'deferred' still win, as before ────────────────────────────

test("'excluded' outranks 'complete'-worthy vendor rows", () => {
  assert.equal(
    resolveCategoryState({ decision: 'excluded' }, [{ status: 'delivered' }]),
    'excluded',
  );
});

test("'deferred' outranks the vendor-status derivation", () => {
  assert.equal(
    resolveCategoryState({ decision: 'deferred' }, [{ status: 'contracted' }]),
    'deferred',
  );
});

// ── null decision — derivation unchanged by slice A ─────────────────────────

test('null decision leaves the vendor-status derivation intact', () => {
  assert.equal(resolveCategoryState(null, []), 'not_started');
  assert.equal(resolveCategoryState(null, [{ status: 'considering' }]), 'needs_more_options');
  assert.equal(resolveCategoryState(null, [{ status: 'shortlisted' }]), 'one_option');
  assert.equal(
    resolveCategoryState(null, [{ status: 'shortlisted' }, { status: 'shortlisted' }]),
    'searching',
  );
  assert.equal(resolveCategoryState(null, [{ status: 'deposit_paid' }]), 'in_progress');
  assert.equal(resolveCategoryState(null, [{ status: 'delivered' }]), 'done');
});

test("a vendor row at status 'complete' still derives done without any decision", () => {
  // The vendor_status enum has its own 'complete' — distinct from the
  // decision value of the same name. Both land on 'done'; neither shadows
  // the other.
  assert.equal(resolveCategoryState(null, [{ status: 'complete' }]), 'done');
});
