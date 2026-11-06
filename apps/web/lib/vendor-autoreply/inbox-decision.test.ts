import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAutoReplyGate, type AutoReplyGateInput } from './inbox-decision';

function input(p: Partial<AutoReplyGateInput> = {}): AutoReplyGateInput {
  return {
    flagEnabled: true,
    senderRole: 'couple',
    addonActive: true,
    config: { enabled: true },
    ...p,
  };
}

test('flag off → never (regardless of everything else)', () => {
  const gate = evaluateAutoReplyGate(input({ flagEnabled: false }));
  assert.deepEqual(gate, { run: false, reason: 'flag_off' });
});

test('vendor sender → never (loop-guard: bot posts as vendor)', () => {
  const gate = evaluateAutoReplyGate(input({ senderRole: 'vendor' }));
  assert.deepEqual(gate, { run: false, reason: 'not_couple' });
});

test('system / coordinator senders → never', () => {
  assert.equal(evaluateAutoReplyGate(input({ senderRole: 'system' })).run, false);
  assert.equal(evaluateAutoReplyGate(input({ senderRole: 'coordinator' })).run, false);
});

test('no active Vendor AI add-on → never (the assistant is a paid add-on)', () => {
  const gate = evaluateAutoReplyGate(input({ addonActive: false }));
  assert.deepEqual(gate, { run: false, reason: 'no_addon' });
});

test('add-on gate sits AFTER the flag + loop-guard (flag off still reports flag_off)', () => {
  // A vendor with no add-on AND the flag off reports flag_off, not no_addon —
  // the master switch is checked first.
  assert.deepEqual(
    evaluateAutoReplyGate(input({ flagEnabled: false, addonActive: false })),
    { run: false, reason: 'flag_off' },
  );
});

test('no vendor_bot_config row → never (strictly opt-in)', () => {
  const gate = evaluateAutoReplyGate(input({ config: null }));
  assert.deepEqual(gate, { run: false, reason: 'no_config' });
});

test('bot disabled → never', () => {
  const gate = evaluateAutoReplyGate(input({ config: { enabled: false } }));
  assert.deepEqual(gate, { run: false, reason: 'bot_disabled' });
});

test('couple + enabled → runs (no per-day limit — owner 2026-10-23)', () => {
  assert.deepEqual(evaluateAutoReplyGate(input()), { run: true });
});
