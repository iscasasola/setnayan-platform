/**
 * Setnayan AI per-user term-pass math (node:test via tsx).
 *
 * Locks the two pure helpers that turn a paid order into an entitlement window:
 * cycles-from-amount, and the extend-from-the-later-of-now/current rule (so
 * early re-ups stack and lapsed ones start fresh).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_SUB_CYCLE_DAYS,
  AI_SUB_MAX_CYCLES,
  cyclesFromAmount,
  extendUserAiSubscription,
  parseCycles,
  reverseUserAiSubscriptionWindow,
} from './setnayan-ai-subscription';

const DAY = 24 * 60 * 60 * 1000;
const CYCLE = AI_SUB_CYCLE_DAYS * DAY;
const NOW = new Date('2026-01-01T00:00:00.000Z');

test('parseCycles: accepts positive whole numbers, clamps to the max, rejects junk', () => {
  assert.equal(parseCycles(1), 1);
  assert.equal(parseCycles('6'), 6);
  assert.equal(parseCycles(AI_SUB_MAX_CYCLES + 5), AI_SUB_MAX_CYCLES); // clamped
  assert.equal(parseCycles(0), null);
  assert.equal(parseCycles(-3), null);
  assert.equal(parseCycles(2.5), null);
  assert.equal(parseCycles('abc'), null);
  assert.equal(parseCycles(null), null);
  assert.equal(parseCycles(undefined), null);
});

test('cyclesFromAmount: paid amount ÷ unit price, min 1, rounded', () => {
  assert.equal(cyclesFromAmount(499, 499), 1);
  assert.equal(cyclesFromAmount(1497, 499), 3); // 3 × 28-day cycles
  assert.equal(cyclesFromAmount(2994, 499), 6); // 6 cycles (≈ a 6-month wedding)
  assert.equal(cyclesFromAmount(250, 499), 1); // underpay still grants ≥ 1
});

test('cyclesFromAmount: guards zero/invalid inputs', () => {
  assert.equal(cyclesFromAmount(0, 499), 0);
  assert.equal(cyclesFromAmount(-100, 499), 0);
  assert.equal(cyclesFromAmount(null, 499), 0);
  assert.equal(cyclesFromAmount(499, 0), 1); // can't divide → one cycle
  assert.equal(cyclesFromAmount(499, null), 1);
});

test('extend: no existing window → now + cycles × 28 days', () => {
  const out = extendUserAiSubscription(null, 1, NOW);
  assert.equal(out.getTime() - NOW.getTime(), CYCLE);
});

test('extend: expired window → starts fresh from now', () => {
  const out = extendUserAiSubscription('2025-12-01T00:00:00.000Z', 1, NOW);
  assert.equal(out.getTime() - NOW.getTime(), CYCLE);
});

test('extend: active future window → STACKS from current expiry', () => {
  const future = new Date('2026-02-01T00:00:00.000Z');
  const out = extendUserAiSubscription(future, 1, NOW);
  assert.equal(out.getTime() - future.getTime(), CYCLE);
});

test('extend: multiple cycles multiply the 28-day unit', () => {
  const out = extendUserAiSubscription(null, 2, NOW);
  assert.equal(out.getTime() - NOW.getTime(), 2 * CYCLE);
});

test('extend: zero cycles is a no-op (returns the later of now/current)', () => {
  assert.equal(extendUserAiSubscription(null, 0, NOW).getTime(), NOW.getTime());
  const future = new Date('2026-03-01T00:00:00.000Z');
  assert.equal(
    extendUserAiSubscription(future, 0, NOW).getTime(),
    future.getTime(),
  );
});

test('extend: invalid current date is treated as no window', () => {
  const out = extendUserAiSubscription('not-a-date', 1, NOW);
  assert.equal(out.getTime() - NOW.getTime(), CYCLE);
});

// ---------------------------------------------------------------------------
// reverseUserAiSubscriptionWindow — refund/reject rolls back the per-user
// window the term-pass order stamped (AUTHZ/lifecycle fix: "refund the money,
// keep the sub" hole in lib/sku-activation.ts deactivateOrderSku).
// ---------------------------------------------------------------------------

test('reverse: this order is the tail → subtract its cycles from active_until', () => {
  const until = new Date(NOW.getTime() + 2 * CYCLE); // granted 2 cycles from now
  const out = reverseUserAiSubscriptionWindow({
    currentActiveUntil: until,
    lastOrderId: 'o1',
    orderId: 'o1',
    cycles: 2,
    now: NOW,
  });
  assert.ok(out, 'expected a rollback date');
  assert.equal(out!.getTime(), NOW.getTime()); // 2 cycles removed → back to now
});

test('reverse: a LATER re-up owns the tail → no-op (never clobber a paid cycle)', () => {
  const until = new Date(NOW.getTime() + 3 * CYCLE);
  const out = reverseUserAiSubscriptionWindow({
    currentActiveUntil: until,
    lastOrderId: 'o2', // a newer order stacked on top
    orderId: 'o1',
    cycles: 1,
    now: NOW,
  });
  assert.equal(out, null);
});

test('reverse: no window → no-op', () => {
  assert.equal(
    reverseUserAiSubscriptionWindow({
      currentActiveUntil: null,
      lastOrderId: 'o1',
      orderId: 'o1',
      cycles: 1,
      now: NOW,
    }),
    null,
  );
});

test('reverse: zero/negative cycles → no-op', () => {
  const until = new Date(NOW.getTime() + CYCLE);
  assert.equal(
    reverseUserAiSubscriptionWindow({ currentActiveUntil: until, lastOrderId: 'o1', orderId: 'o1', cycles: 0, now: NOW }),
    null,
  );
  assert.equal(
    reverseUserAiSubscriptionWindow({ currentActiveUntil: until, lastOrderId: 'o1', orderId: 'o1', cycles: -2, now: NOW }),
    null,
  );
});

test('reverse: rollback may land in the PAST (window fully consumed) → gate reads inactive', () => {
  const until = new Date(NOW.getTime() + 1 * CYCLE); // only 1 cycle of runway left
  const out = reverseUserAiSubscriptionWindow({
    currentActiveUntil: until,
    lastOrderId: 'o1',
    orderId: 'o1',
    cycles: 2, // this order granted 2 → removing them lands before now
    now: NOW,
  });
  assert.ok(out);
  assert.ok(out!.getTime() < NOW.getTime());
  assert.equal(out!.getTime(), NOW.getTime() - CYCLE);
});
