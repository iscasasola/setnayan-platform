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
import { bookingFeeTourLine, TOURS } from './tours';
import { vendorDayOfFreeUntilLabel } from './vendor-dayof-free-until';
import { stripComments } from './strip-comments';

const all = () => JSON.stringify(TOURS);

test('the Money tour says when the fee is charged, from the lock — and nothing when the fee is off', () => {
  assert.equal(
    bookingFeeTourLine(true),
    `One booking fee per booking from Setnayan. ${BOOKING_FEE_CHARGED_WHEN} ${FIRST_BOOKING_ON_US} Your own clients are always free.`,
  );
  assert.equal(bookingFeeTourLine(false), 'No booking fee is charged right now. Your own clients are always free.');
  assert.doesNotMatch(all(), /due after the day/i);
  const src = stripComments(readFileSync(join(import.meta.dirname, 'tours.ts'), 'utf8'));
  assert.match(src, /body: bookingFeeTourLine\(isBookingFeeEnabled\(\)\),/);
});

test('the Hub tour states no fee rule of its own — a waiting day says so on its row', () => {
  assert.doesNotMatch(all(), /A day opens once its booking fee is paid/);
  assert.match(all(), /A day that is waiting on its booking fee says so on its row\./);
});

test('the fee bill says the same "when" sentence', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'booking-fee-disclosure.ts'), 'utf8'));
  assert.match(src, /`\$\{BOOKING_FEE_CHARGED_WHEN\} Pay it the same way/);
});

test('"Free until" says what is free — the day-of tools — and that the fee is separate', () => {
  const label = vendorDayOfFreeUntilLabel('2026-12-31T23:59:59+08:00');
  assert.equal(label, 'Your day-of tools are free until December 31, 2026. The booking fee is separate.');
});
