import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAutoReplyGate,
  startOfManilaDayIso,
  type AutoReplyGateInput,
} from './inbox-decision';

function input(p: Partial<AutoReplyGateInput> = {}): AutoReplyGateInput {
  return {
    flagEnabled: true,
    senderRole: 'couple',
    config: { enabled: true, dailyReplyCap: 30 },
    repliesToday: 0,
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

test('no vendor_bot_config row → never (strictly opt-in)', () => {
  const gate = evaluateAutoReplyGate(input({ config: null }));
  assert.deepEqual(gate, { run: false, reason: 'no_config' });
});

test('bot disabled → never', () => {
  const gate = evaluateAutoReplyGate(input({ config: { enabled: false, dailyReplyCap: 30 } }));
  assert.deepEqual(gate, { run: false, reason: 'bot_disabled' });
});

test('daily cap reached → never (count == cap blocks)', () => {
  const gate = evaluateAutoReplyGate(
    input({ config: { enabled: true, dailyReplyCap: 30 }, repliesToday: 30 }),
  );
  assert.deepEqual(gate, { run: false, reason: 'cap_reached' });
});

test('cap 0 → bot never replies', () => {
  const gate = evaluateAutoReplyGate(
    input({ config: { enabled: true, dailyReplyCap: 0 }, repliesToday: 0 }),
  );
  assert.deepEqual(gate, { run: false, reason: 'cap_reached' });
});

test('couple + enabled + under cap → runs', () => {
  const gate = evaluateAutoReplyGate(
    input({ config: { enabled: true, dailyReplyCap: 30 }, repliesToday: 29 }),
  );
  assert.deepEqual(gate, { run: true });
});

// ── startOfManilaDayIso ─────────────────────────────────────────────────────

test('start of Manila day — evening UTC is already the NEXT Manila day', () => {
  // 2026-07-19T20:00Z = 2026-07-20 04:00 Manila → day started 2026-07-19T16:00Z.
  assert.equal(
    startOfManilaDayIso(new Date('2026-07-19T20:00:00Z')),
    '2026-07-19T16:00:00.000Z',
  );
});

test('start of Manila day — morning UTC is the same Manila day', () => {
  // 2026-07-19T10:00Z = 18:00 Manila on Jul 19 → day started 2026-07-18T16:00Z.
  assert.equal(
    startOfManilaDayIso(new Date('2026-07-19T10:00:00Z')),
    '2026-07-18T16:00:00.000Z',
  );
});

test('start of Manila day — exact Manila midnight maps to itself', () => {
  assert.equal(
    startOfManilaDayIso(new Date('2026-07-18T16:00:00Z')),
    '2026-07-18T16:00:00.000Z',
  );
});
