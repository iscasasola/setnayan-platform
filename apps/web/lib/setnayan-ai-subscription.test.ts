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
  cyclesFromAmount,
  extendUserAiSubscription,
} from './setnayan-ai-subscription';

const DAY = 24 * 60 * 60 * 1000;
const CYCLE = AI_SUB_CYCLE_DAYS * DAY;
const NOW = new Date('2026-01-01T00:00:00.000Z');

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
