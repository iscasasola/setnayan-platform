/**
 * the-fee-line-says-it-plainly.test.ts — the owner's 2026-11-04 rewording of
 * the supplier booking-fee line, held to the facts it must keep.
 *
 * Owner, on /for-suppliers: reword "Your first booking from Setnayan is on us —
 * after that 5% of the first ₱100,000, then 1%, minimum ₱50, only on couples we
 * source". Same four facts — first booking free · 5% then 1% above ₱100,000 ·
 * ₱50 minimum · only couples Setnayan brought — now said as
 *
 *   **Your first booking through Setnayan is free.** After that: 5% up to
 *   ₱100,000, 1% above — only on couples who found you here. ⓘ
 *   (ⓘ: "Minimum fee ₱50 per booking. Bookings you bring in yourself are never charged.")
 *
 * 🔑 Every number is DERIVED from the schedule the page read, and pinned here
 * against `bookingFeePhp`, the function that bills — so the words cannot drift
 * from the charge, and a reprice moves the words with it.
 *
 * SABOTAGE (run 2026-11-04): hand-type "5% up to ₱100,000" into
 * booking-fee-line.tsx → RED; drop the minimum from the ⓘ → RED; put the old
 * "only on couples we source" back in vendor-grow-sections.tsx → RED.
 * (2026-11-06: vendor-grow-sections.tsx and vendor-tier-deltas.tsx were deleted
 * with the old /for-suppliers page. The approved page says the fee in its own
 * approved sentence, placed by `bookingFeeFigures` and held by
 * `app/for-suppliers/supplier-front-reads-its-numbers.test.ts`; here it is held
 * to never say the OLD sentence.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  BOOKING_FEE,
  bookingFeeBandsLine,
  bookingFeeMinimumAmount,
  bookingFeePhp,
} from './booking-fee';
import { FIRST_BOOKING_FREE, FREE_BOOKING_LIMIT } from './booking-fee-lock';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The approved /for-suppliers page of 2026-11-06 — the files that draw it. */
const FOR_SUPPLIERS = [
  'app/(shell)/for-suppliers/page.tsx',
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/for-suppliers/_components/supplier-front-client.tsx',
  'app/for-suppliers/_components/supplier-front-data.ts',
] as const;

test('the bands line and the minimum render the CURRENT schedule in the owner’s words', () => {
  assert.equal(bookingFeeBandsLine(BOOKING_FEE), '5% up to ₱100,000, 1% above');
  assert.equal(bookingFeeMinimumAmount(BOOKING_FEE), '₱50');
  assert.equal(FIRST_BOOKING_FREE, 'Your first booking through Setnayan is free.');
  // "first booking" is singular because exactly one booking is free.
  assert.equal(FREE_BOOKING_LIMIT, 1, 'the copy says ONE free booking — change the sentence with the number');
});

test('PIN: every claim in the line is true of the function that bills', () => {
  const { rate, tailRate, tier1LimitPhp, minPhp } = BOOKING_FEE;
  // "5% up to ₱100,000" — the head rate holds exactly at the band edge.
  assert.equal(bookingFeePhp(tier1LimitPhp), tier1LimitPhp * rate);
  // "1% above" — past the edge only the excess takes the tail rate.
  assert.equal(bookingFeePhp(tier1LimitPhp * 3), tier1LimitPhp * rate + tier1LimitPhp * 2 * tailRate);
  // "Minimum fee ₱50" — a tiny booking is billed the floor.
  assert.equal(bookingFeePhp(1), minPhp);
});

test('an edited schedule moves the words — nothing is typed', () => {
  const edited = { ...BOOKING_FEE, rate: 0.04, tailRate: 0.015, tier1LimitPhp: 150_000 };
  assert.equal(bookingFeeBandsLine(edited), '4% up to ₱150,000, 1.5% above');
  assert.equal(bookingFeeMinimumAmount({ ...BOOKING_FEE, minPhp: 75 }), '₱75');
});

test('<BookingFeeLine> derives every number and keeps the minimum behind its ⓘ', () => {
  const src = code('app/_components/booking-fee-line.tsx');
  assert.match(src, /bookingFeeBandsLine\(fee\)/, 'the bands are not read from the schedule');
  assert.match(src, /bookingFeeMinimumAmount\(fee\)/, 'the minimum is not read from the schedule');
  assert.doesNotMatch(src, /\d+\s*%|₱\s*\d/, 'a rate or a peso amount is typed into the fee line');
  assert.match(src, /<InfoTip\b[\s\S]*?Minimum fee \$\{bookingFeeMinimumAmount\(fee\)\} per booking\./, 'the ⓘ lost the minimum');
  assert.match(src, /'Bookings you bring in yourself are never charged\.'/);
  assert.match(src, /'only on couples who found you here\.'/);
  assert.match(src, /\{FIRST_BOOKING_FREE\}/, 'the lead sentence is typed instead of read');
  // NULL = could not read: no rate, no minimum — never the code default.
  assert.doesNotMatch(src, /BOOKING_FEE\b(?!_)/, 'the line can fall back to the code default schedule');
});

test('every surface that drew the old sentence draws the one line', () => {
  const OLD_SENTENCE = /first booking from Setnayan is on us|FIRST_BOOKING_ON_US_CLAUSE\} — after that/;
  for (const rel of ['app/vendor-dashboard/booking-fees/page.tsx']) {
    const src = code(rel);
    assert.match(src, /<BookingFeeLine\b/, `${rel} does not draw <BookingFeeLine>`);
    assert.doesNotMatch(src, OLD_SENTENCE, `${rel} still says the old fee sentence`);
  }
  // The approved /for-suppliers page (2026-11-06) replaced the two old page
  // sections that drew <BookingFeeLine>; it places the live figures in its own
  // approved sentence instead. It must never say the old one.
  for (const rel of FOR_SUPPLIERS) {
    assert.doesNotMatch(code(rel), OLD_SENTENCE, `${rel} still says the old fee sentence`);
  }
  // The old wording's tail is gone from every surface.
  for (const rel of [...FOR_SUPPLIERS, 'app/_components/frontdoor/front-door-feed.tsx']) {
    assert.doesNotMatch(code(rel), /only on couples we source/, `${rel} still says "only on couples we source"`);
  }
});
