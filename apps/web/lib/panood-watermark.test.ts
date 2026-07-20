/**
 * Live Studio overlay-decision invariants (Node built-in test runner, run via tsx).
 *
 * This is the paywall AND a wedding-day safety device, so both directions are pinned:
 *
 *   1. FAILS CLOSED — every non-affirmative state draws the overlay. An entitlement lookup that
 *      errors passes paid:false and lands on 'unpaid', which is exactly what the couple already
 *      saw before buying, so a transient failure never changes the screen mid-setup.
 *   2. ONE INSTANT — the overlay clears and the 24h window opens at the same moment: the first
 *      press-live on a paid event. Paying early costs nothing.
 *   3. NEVER INTERRUPT A BROADCAST — if the window lapses while still on air, the overlay stays
 *      OFF. Slamming a logo over a paying couple's ceremony is the worst outcome in the design;
 *      the window bites at the NEXT press-live instead.
 *   4. RE-PRESS CANNOT MOVE THE WINDOW — it is anchored to firstLiveAt, so toggling live off and
 *      on again neither restarts nor extends anything.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideWatermark,
  canStartBroadcast,
  isWindowEndingSoon,
  PANOOD_WINDOW_HOURS,
  WATERMARK_COPY,
  type WatermarkInput,
} from './panood-watermark';

const T0 = new Date('2026-08-15T06:00:00.000Z'); // 6am — hair and makeup, when a PH wedding starts
const hoursAfter = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const input = (over: Partial<WatermarkInput> = {}): WatermarkInput => ({
  paid: true,
  firstLiveAt: T0,
  isLive: true,
  now: T0,
  ...over,
});

/* ── 1. Fails closed ──────────────────────────────────────────────────────── */

test('unpaid always draws the overlay, however live it is', () => {
  const d = decideWatermark(input({ paid: false, isLive: true, now: hoursAfter(1) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'unpaid');
  assert.equal(d.expiresAt, null);
});

test('an unparseable firstLiveAt degrades to awaiting-go-live, not to a free pass', () => {
  const d = decideWatermark(input({ firstLiveAt: 'not-a-date' }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'awaiting-go-live');
});

/* ── 2. One instant does both things ──────────────────────────────────────── */

test('paid but never pressed live keeps the overlay — buying early costs nothing', () => {
  const d = decideWatermark(input({ firstLiveAt: null, isLive: false, now: hoursAfter(500) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'awaiting-go-live');
  assert.equal(d.expiresAt, null, 'no clock may start before the first press-live');
});

test('pressing live on a paid event clears the overlay and opens the window', () => {
  const d = decideWatermark(input({ now: T0 }));
  assert.equal(d.overlay, false);
  assert.equal(d.reason, 'window-open');
  assert.equal(d.expiresAt, hoursAfter(PANOOD_WINDOW_HOURS).toISOString());
});

test('the window covers a full PH wedding day — 6am prep to a midnight reception', () => {
  // ~18 hours end to end, comfortably inside 24.
  const atReceptionEnd = decideWatermark(input({ now: hoursAfter(18) }));
  assert.equal(atReceptionEnd.overlay, false);
  assert.equal(atReceptionEnd.reason, 'window-open');
});

/* ── 3. Never interrupt a broadcast ───────────────────────────────────────── */

test('window lapsing mid-broadcast does NOT restore the overlay', () => {
  const d = decideWatermark(input({ isLive: true, now: hoursAfter(30) }));
  assert.equal(d.overlay, false, 'a paying couple must never gain a logo mid-ceremony');
  assert.equal(d.reason, 'expired-broadcasting');
});

test('once off air, an expired window does restore the overlay', () => {
  const d = decideWatermark(input({ isLive: false, now: hoursAfter(30) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'expired');
});

test('an expired window blocks the NEXT broadcast — that is where it bites', () => {
  assert.equal(canStartBroadcast(input({ isLive: false, now: hoursAfter(30) })), false);
  assert.equal(canStartBroadcast(input({ isLive: true, now: hoursAfter(30) })), false);
});

test('canStartBroadcast allows a first press and a re-press inside the window', () => {
  assert.equal(canStartBroadcast(input({ firstLiveAt: null, isLive: false })), true);
  assert.equal(canStartBroadcast(input({ isLive: false, now: hoursAfter(5) })), true);
});

test('unpaid cannot start a broadcast', () => {
  assert.equal(canStartBroadcast(input({ paid: false, firstLiveAt: null, isLive: false })), false);
});

/* ── 4. Re-press cannot move the window ───────────────────────────────────── */

test('expiry is anchored to the FIRST press — toggling live off and on cannot extend it', () => {
  const first = decideWatermark(input({ now: hoursAfter(1) }));
  // Operator stops, then restarts 10 hours later. firstLiveAt is unchanged by design.
  const afterRestart = decideWatermark(input({ now: hoursAfter(11) }));
  assert.equal(afterRestart.expiresAt, first.expiresAt, 'a re-press must not move the window');
  assert.equal(afterRestart.reason, 'window-open');
});

/* ── Countdown + copy ─────────────────────────────────────────────────────── */

test('minutesRemaining counts down and floors', () => {
  assert.equal(decideWatermark(input({ now: T0 })).minutesRemaining, 24 * 60);
  assert.equal(decideWatermark(input({ now: hoursAfter(23.5) })).minutesRemaining, 30);
});

test('ending-soon fires only inside the last hour of an open window', () => {
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(12) }))), false);
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(23.5) }))), true);
  // Not "ending soon" once it has already expired — that is a different message.
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(30) }))), false);
});

test('every reason has operator-facing copy', () => {
  for (const reason of [
    'unpaid',
    'awaiting-go-live',
    'window-open',
    'expired-broadcasting',
    'expired',
  ] as const) {
    assert.ok(WATERMARK_COPY[reason]?.badge, `missing badge for ${reason}`);
    assert.ok(WATERMARK_COPY[reason]?.detail, `missing detail for ${reason}`);
  }
});

test('a custom window length is honoured', () => {
  const d = decideWatermark(input({ windowHours: 48, now: hoursAfter(30) }));
  assert.equal(d.overlay, false);
  assert.equal(d.reason, 'window-open');
});
