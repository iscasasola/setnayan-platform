/**
 * 💳 RW-20 / F-W1-75 (walk 13 Nov 2026): every place that tells a supplier about the booking fee says the shipped rule,
 * from the rule's own module — never "due after the day" (no code does that) and never a bare "Free until …" that
 * reads as "no fee".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOOKING_FEE_CHARGED_WHEN, FIRST_BOOKING_ON_US } from './booking-fee-lock';
import { TOURS } from './tours';
import { vendorDayOfFreeUntilLabel } from './vendor-dayof-free-until';
import { stripComments } from './strip-comments';

const all = () => JSON.stringify(TOURS);

// (retired 16 Nov 2026, W1-B14) the Money and Hub page tours whose fee words these two tests held were deleted with
// the other supplier page tours, and `bookingFeeTourLine` with them. What still holds: no tour states a fee rule of its own.
test('no tour says the fee is due after the day, or states a day-opens rule of its own', () => {
  assert.ok(all().length > 1000, 'anti-vacuity: the tours were not read');
  assert.doesNotMatch(all(), /due after the day/i);
  assert.doesNotMatch(all(), /A day opens once its booking fee is paid/);
});

test('the fee bill says the same "when" sentence', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'booking-fee-disclosure.ts'), 'utf8'));
  assert.match(src, /`\$\{BOOKING_FEE_CHARGED_WHEN\} Pay it the same way/);
});

test('"Free until" says what is free — the day-of tools — and that the fee is separate', () => {
  const label = vendorDayOfFreeUntilLabel('2026-12-31T23:59:59+08:00');
  assert.equal(label, 'Your day-of tools are free until December 31, 2026. The booking fee is separate.');
});
