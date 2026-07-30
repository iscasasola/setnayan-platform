/**
 * SEC-4b · the ownership RULE, exercised rather than read.
 *
 * This closes the gap #3930 stated openly: that PR's tests are a source scan.
 * They prove the gate is installed in all four `vendor_*__<id>` hooks and
 * installed before each hook's first write — but never that the comparison
 * actually refuses a mismatched pair, because `lib/sku-activation.ts` cannot be
 * imported by a test (it reaches `server-only` transitively through the
 * concierge actions). Splitting the decision into a pure module fixes that.
 *
 * Coverage is now honest in both halves:
 *   • the rule is right      → this file
 *   • the rule is called, before anything is written → activation-ownership-gate.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  orderMayProvisionVendorTarget,
  vendorTargetRefusalMessage,
} from './vendor-target-ownership';

const A = 'a1b2c3d4-1111-4111-8111-aaaabbbbcccc';
const B = 'e5f6a7b8-2222-4222-8222-ddddeeeeffff';

/* ── the one case that is allowed ──────────────────────────────────────────── */

test('ALLOWS when the order and the target belong to the same vendor', () => {
  assert.equal(orderMayProvisionVendorTarget(A, A), true);
});

/* ── every refusal ─────────────────────────────────────────────────────────── */

test('REFUSES the cross-tenant case — the whole point', () => {
  assert.equal(
    orderMayProvisionVendorTarget(A, B),
    false,
    "vendor A's order provisioned vendor B's object",
  );
});

test('REFUSES when the order has NO vendor — the couple-checkout case', () => {
  // Couple-side checkout pins orders.vendor_profile_id to NULL. This is the
  // branch that stops a couple-minted row (or a comp grant, or a hand-inserted
  // row) from provisioning any vendor object at all.
  assert.equal(orderMayProvisionVendorTarget(null, B), false);
  assert.equal(orderMayProvisionVendorTarget(undefined, B), false);
});

test('REFUSES when the TARGET owner is unknown', () => {
  // The resolvers return null when the branch/charge does not exist. "I could
  // not find the owner" must not read as permission, or a typo'd id becomes a
  // skeleton key.
  assert.equal(orderMayProvisionVendorTarget(A, null), false);
  assert.equal(orderMayProvisionVendorTarget(A, undefined), false);
});

test('REFUSES null-vs-null — two unknowns are not a match', () => {
  // The most dangerous plausible bug: a `===` on two nulls is TRUE in JS. A
  // couple-minted order (null) against an unresolvable target (null) would then
  // sail straight through.
  assert.equal(orderMayProvisionVendorTarget(null, null), false);
  assert.equal(orderMayProvisionVendorTarget(undefined, undefined), false);
});

test('REFUSES empty and whitespace-only ids', () => {
  // A blank is as absent as a null, and `'' === ''` is another true-by-accident.
  for (const blank of ['', '   ', '\t', '\n']) {
    assert.equal(orderMayProvisionVendorTarget(blank, blank), false, `${JSON.stringify(blank)} matched itself`);
    assert.equal(orderMayProvisionVendorTarget(blank, A), false);
    assert.equal(orderMayProvisionVendorTarget(A, blank), false);
  }
});

test('surrounding whitespace does not change identity', () => {
  // Trimmed on both sides, so a padded id is still the same vendor — but only
  // the same one.
  assert.equal(orderMayProvisionVendorTarget(` ${A} `, A), true);
  assert.equal(orderMayProvisionVendorTarget(` ${A} `, B), false);
});

test('comparison is EXACT — no case folding, no prefix match', () => {
  // These are DB-minted UUIDs, never user input, so a looser compare could only
  // widen the gate.
  assert.equal(orderMayProvisionVendorTarget(A.toUpperCase(), A), false);
  assert.equal(orderMayProvisionVendorTarget(A, `${A}-extra`), false);
  assert.equal(orderMayProvisionVendorTarget(A.slice(0, 8), A), false);
});

test('non-string junk is refused rather than coerced', () => {
  // Defensive: these come off a `.select()` whose row shape is cast, not
  // validated, so a schema change could deliver something unexpected.
  for (const junk of [0, 1, {}, [], true, false, NaN] as unknown[]) {
    assert.equal(
      orderMayProvisionVendorTarget(junk as string, junk as string),
      false,
      `${String(junk)} was accepted`,
    );
  }
});

/* ── the refusal message ───────────────────────────────────────────────────── */

test('the refusal message names both sides, for triage', () => {
  // It lands in a server log and in Sentry; being able to tell a
  // misconfiguration from an attack is the whole reason it carries ids.
  const msg = vendorTargetRefusalMessage({
    orderId: 'ord-1',
    serviceKey: 'vendor_additional_branch__br-9',
    orderVendorProfileId: A,
    targetVendorProfileId: B,
  });
  assert.match(msg, /SEC-4b/);
  assert.match(msg, /ord-1/);
  assert.match(msg, /vendor_additional_branch__br-9/);
  assert.ok(msg.includes(A) && msg.includes(B), 'both vendor ids must appear');
  assert.match(msg, /Refusing to activate/);
});

test('the message renders absent ids readably, not as "undefined"', () => {
  const msg = vendorTargetRefusalMessage({
    orderId: 'ord-2',
    serviceKey: 'vendor_extra_seat__x',
    orderVendorProfileId: null,
    targetVendorProfileId: undefined,
  });
  assert.match(msg, /vendor_profile_id=null/);
  assert.match(msg, /belongs to vendor unknown/);
  assert.ok(!msg.includes('undefined'), 'a raw undefined leaked into the log line');
});
