import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOOKING_FEE, bookingFeeCapPhp, bookingFeeLockPointPhp, bookingFeePhp } from '@/lib/booking-fee';
import { FEE_STOPS, FEE_STOP_START, feeRulerStops } from './_components/supplier-front-data';

/**
 * 🔒 THE ₱100,000 LOCK ON THE FEE RULER (owner 20 Nov: "return the booking fee line bar … show them the 100,000 lock";
 * drawing `prototypes/for_suppliers_2026-11-20/`). The lock is live in this PR (`platform_settings.booking_fee_cap_php`),
 * so the ruler draws it: a stop at the booking price where the fee first reaches the cap, a tick on the bar there, a
 * "₱100,000 lock" flag, and a lock on every stop at the cap. No fee and no lock point is typed: both come from the schedule.
 */
const CLIENT = readFileSync(join(__dirname, '_components/supplier-front-client.tsx'), 'utf8');

test('the lock point is where the fee first reaches the cap — read from the schedule, never typed', () => {
  const at = bookingFeeLockPointPhp(BOOKING_FEE);
  assert.ok(at !== null);
  assert.equal(bookingFeePhp(at, BOOKING_FEE), bookingFeeCapPhp(BOOKING_FEE));
  assert.ok(bookingFeePhp(at - 1, BOOKING_FEE) < bookingFeeCapPhp(BOOKING_FEE));
  // Moves with the schedule (an edited cap or tail rate moves the stop, no edit here).
  const other = { ...BOOKING_FEE, capPhp: 50_000 };
  assert.equal(bookingFeePhp(bookingFeeLockPointPhp(other)!, other), 50_000);
  assert.ok(!(FEE_STOPS as readonly number[]).includes(at), 'the lock point is typed into FEE_STOPS');
});

test('the drawing: 26 stops, the lock stop at 80% of the bar, opening on ₱300,000', () => {
  const stops = feeRulerStops(BOOKING_FEE);
  assert.equal(stops.length, 26);
  const i = stops.findIndex((s) => s.lockPoint);
  assert.equal(i / (stops.length - 1), 0.8);
  assert.equal(stops[FEE_STOP_START]!.v, 300_000);
  for (const s of stops) assert.equal(s.locked, s.fee >= bookingFeeCapPhp(BOOKING_FEE), String(s.v));
  assert.ok(stops.filter((s) => s.locked).length >= 2, 'anti-vacuity: no stop past the lock');
});

test('the ruler draws the flag, the tick and a lock on the locked stops — and hides them when a switch makes it free', () => {
  assert.match(CLIENT, /feeRulerStops\(schedule\)/);
  assert.match(CLIENT, /bookingFeeCapAmount\(schedule\)\} lock/);
  assert.match(CLIENT, /className=\{s\.fxTick\}/);
  assert.match(CLIENT, /p\.locked \? <Lock/);
  assert.match(CLIENT, /\{free \? \(\s*<span className=\{s\.fxFree\}/);
});
