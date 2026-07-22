import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAddonDeactivationExpiry } from './vendor-addon-deactivation';

// Fixed clock so the "expire now" branch is deterministic.
const NOW = Date.parse('2026-07-22T00:00:00.000Z');
const NOW_ISO = new Date(NOW).toISOString();

// A window this order stamped, and a LATER window a renewal stacked on top.
const THIS_ORDER_EXPIRY = '2026-08-19T00:00:00.000Z'; // now + 28d
const STACKED_EXPIRY = '2026-09-16T00:00:00.000Z'; // a later cycle

test('reversal EXPIRES the window when this order owns the current one', () => {
  // current === what this order stamped → this order owns the live window → expire.
  assert.equal(
    resolveAddonDeactivationExpiry(THIS_ORDER_EXPIRY, THIS_ORDER_EXPIRY, NOW),
    NOW_ISO,
  );
});

test('reversal is a NO-OP when a later cycle has since stacked on top', () => {
  // A renewal extended the window past this order's stamp → a DIFFERENT order owns
  // it now → never clobber it.
  assert.equal(
    resolveAddonDeactivationExpiry(STACKED_EXPIRY, THIS_ORDER_EXPIRY, NOW),
    STACKED_EXPIRY,
  );
});

test('reversal is a NO-OP when the grant cannot be attributed to this order', () => {
  // No ledger stamp for this order → we can't prove it owns the window → keep it.
  assert.equal(
    resolveAddonDeactivationExpiry(THIS_ORDER_EXPIRY, null, NOW),
    THIS_ORDER_EXPIRY,
  );
});

test('reversal is a NO-OP when nothing is active (no current window)', () => {
  assert.equal(resolveAddonDeactivationExpiry(null, THIS_ORDER_EXPIRY, NOW), null);
  assert.equal(resolveAddonDeactivationExpiry(undefined, THIS_ORDER_EXPIRY, NOW), null);
});

test('a lapsed window that this order stamped still expires to now (idempotent)', () => {
  // Even a past expiry, if it matches this order, resets to now — harmless + the
  // gate already reads it as inactive. Confirms exact-match wins regardless of past/future.
  const PAST = '2026-07-01T00:00:00.000Z';
  assert.equal(resolveAddonDeactivationExpiry(PAST, PAST, NOW), NOW_ISO);
});

test('defaults nowMs to Date.now() when omitted (smoke — returns an ISO string)', () => {
  const out = resolveAddonDeactivationExpiry(THIS_ORDER_EXPIRY, THIS_ORDER_EXPIRY);
  assert.equal(typeof out, 'string');
  assert.ok(!Number.isNaN(Date.parse(out as string)));
});
