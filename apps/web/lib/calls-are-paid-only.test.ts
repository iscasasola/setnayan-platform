/**
 * 📞 CALLS WITH COUPLES ARE FOR PAID SUPPLIERS — ON THEIR OWN SWITCH (owner
 * 2026-10-02, tracker d10: "paid suppliers only, starting now"; controller:
 * its own switch, the shared VENDOR_TIER_FEATURE_GATE untouched).
 *
 * SABOTAGE (run 2026-10-02): restoring the short-circuit
 * `if (!isVendorFeatureGateEnabled()) return true;` in `threadCallsAllowed`
 * (i.e. open while the shared gate is off, as before) turns test 1 red
 * ("a free supplier can call with the env unset").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callsArePaidOnly, threadCallsAllowed } from './thread-calls-rule';
import { stripComments } from './strip-comments';

function withEnv(v: string | undefined, fn: () => void): void {
  const prevCalls = process.env.VENDOR_CALLS_PAID_ONLY;
  const prevGate = process.env.VENDOR_TIER_FEATURE_GATE;
  try {
    if (v === undefined) delete process.env.VENDOR_CALLS_PAID_ONLY;
    else process.env.VENDOR_CALLS_PAID_ONLY = v;
    // The shared tier gate stays OFF, as in production — it must not matter.
    delete process.env.VENDOR_TIER_FEATURE_GATE;
    fn();
  } finally {
    if (prevCalls === undefined) delete process.env.VENDOR_CALLS_PAID_ONLY;
    else process.env.VENDOR_CALLS_PAID_ONLY = prevCalls;
    if (prevGate === undefined) delete process.env.VENDOR_TIER_FEATURE_GATE;
    else process.env.VENDOR_TIER_FEATURE_GATE = prevGate;
  }
}

test('1 · env unset: free and verified are refused, Solo and up may call', () => {
  withEnv(undefined, () => {
    assert.equal(callsArePaidOnly(), true);
    for (const t of ['free', 'verified', null, undefined, 'nonsense']) {
      assert.equal(threadCallsAllowed(t), false, `a ${String(t)} supplier can call with the env unset`);
    }
    for (const t of ['solo', 'pro', 'enterprise']) {
      assert.equal(threadCallsAllowed(t), true, `a ${t} supplier is refused`);
    }
  });
});

test('2 · the kill switch reopens calls for everyone', () => {
  for (const v of ['0', 'false', 'FALSE', 'off', ' Off ']) {
    withEnv(v, () => {
      assert.equal(callsArePaidOnly(), false, `"${v}" must reopen calls`);
      assert.equal(threadCallsAllowed('free'), true);
    });
  }
  for (const v of ['', '1', 'true', 'yes']) {
    withEnv(v, () => assert.equal(threadCallsAllowed('free'), false, `"${v}" must keep calls paid-only`));
  }
});

test('3 · the server gate asks this rule, not the shared tier switch', () => {
  const gate = stripComments(readFileSync(join(import.meta.dirname, 'thread-calls-gate.ts'), 'utf8'));
  assert.match(gate, /return threadCallsAllowed\(tier\);/);
  assert.ok(!/isVendorFeatureGateEnabled/.test(gate), 'calls ride the shared tier switch again');
  const rule = stripComments(readFileSync(join(import.meta.dirname, 'thread-calls-rule.ts'), 'utf8'));
  assert.ok(!/VENDOR_TIER_FEATURE_GATE|isVendorFeatureGateEnabled/.test(rule), 'the rule reads the shared switch');
});
