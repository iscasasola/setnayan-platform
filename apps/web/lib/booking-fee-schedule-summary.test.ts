/**
 * `bookingFeeScheduleSummary()` — the vendor-facing one-liner that goes into the
 * booking-fee `orders.description` (a MONEY DOCUMENT: the vendor reads it in
 * /vendor-dashboard/booking-fees, ops read it in /admin/payments).
 *
 * WHY THIS SUITE EXISTS: that description used to hard-code "(5%)". Since the
 * 2026-07-25 taper the fee is 5% on the first ₱100,000 and 1% above, so the
 * literal was wrong on EVERY booking over ₱100,000 — ₱1,000,000 is billed
 * ₱14,000 (1.40%), not ₱50,000. The fix derives the copy from `BOOKING_FEE`;
 * these tests exist so the copy can never drift from the math again.
 *
 * Expected values are DERIVED from `BOOKING_FEE`, never typed in, so a future
 * reprice moves the suite with it instead of being blocked by it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BOOKING_FEE, bookingFeePhp, bookingFeeScheduleSummary } from './booking-fee';

test('renders the schedule for the CURRENT constants', () => {
  assert.equal(
    bookingFeeScheduleSummary(),
    '5% of the first ₱100,000, then 1%, minimum ₱50',
  );
});

test('no floating-point noise in the percentages (0.025 → "2.5%", never "2.5000000000000004%")', () => {
  // rate × 100 is a float multiply; an unformatted `${rate * 100}%` is one
  // reprice away from printing 2.5000000000000004% on a vendor's invoice.
  assert.doesNotMatch(bookingFeeScheduleSummary(), /\d+\.\d{3,}/);
});

test('every amount carries the ₱ sign and thousands separators', () => {
  const summary = bookingFeeScheduleSummary();
  assert.match(summary, /₱100,000/);
  assert.match(summary, /₱50\b/);
  // No bare 6-digit run — that would mean an unformatted 100000 slipped through.
  assert.doesNotMatch(summary, /\d{4,}/);
});

/**
 * THE PIN. Not "does the string look right" but "is every claim in the string
 * TRUE of the function that actually bills the vendor". Each expectation is
 * computed from BOOKING_FEE, so it tracks a reprice rather than blocking one.
 */
test('PIN: the summary agrees with bookingFeePhp at the band, the tail, and the floor', () => {
  const { rate, tailRate, tier1LimitPhp, minPhp } = BOOKING_FEE;
  const summary = bookingFeeScheduleSummary();

  // 1. "X% of the first ₱N" — the head rate holds exactly AT the band edge.
  assert.equal(
    bookingFeePhp(tier1LimitPhp),
    tier1LimitPhp * rate,
    'the head rate the summary advertises must be what the band edge is billed',
  );

  // 2. "then Y%" — above the edge, only the TAIL rate applies to the excess.
  //    (₱300,000 → ₱7,000 and ₱1,000,000 → ₱14,000 under today's constants.)
  for (const multiple of [3, 10, 100]) {
    const proposal = tier1LimitPhp * multiple;
    const expected = tier1LimitPhp * rate + (proposal - tier1LimitPhp) * tailRate;
    assert.equal(
      bookingFeePhp(proposal),
      expected,
      `₱${proposal} must bill the head rate on the first band and the tail rate above it`,
    );
  }

  // 3. "minimum ₱M" — the floor really does bind at the small end. This is the
  //    half that is easy to drop: below minPhp/rate the EFFECTIVE rate exceeds
  //    the headline (a ₱200 booking pays ₱50 = 25%), so a summary that omits
  //    the minimum is wrong at the small end the way "(5%)" was at the large.
  const smallProposal = minPhp * 4; // ₱200 — safely inside the floor zone
  assert.ok(
    smallProposal < minPhp / rate,
    'probe must sit below the floor crossover for this assertion to mean anything',
  );
  assert.equal(bookingFeePhp(smallProposal), minPhp, 'the floor the summary names must bind');
  assert.ok(
    bookingFeePhp(smallProposal) / smallProposal > rate,
    'below the crossover the effective rate EXCEEDS the headline — hence "minimum"',
  );

  // 4. And the string actually names all four constants it is claiming.
  for (const token of ['5%', '1%', '₱100,000', '₱50']) {
    assert.ok(summary.includes(token), `summary must name ${token}`);
  }
});

/**
 * THE REGRESSION GUARD. This exists because the shipped order description was
 * the literal 'Setnayan booking fee (5%) — …', which misstated the rate on
 * EVERY booking above ₱100,000. Re-typing any fixed rate into that money
 * document — "(5%)", "(5% then 1%)" — reintroduces the same class of bug at the
 * next reprice, so the parenthetical must come from bookingFeeScheduleSummary().
 */
test('GUARD: the order description is derived, never a hard-coded rate', () => {
  const src = readFileSync(new URL('./booking-fee-lock.server.ts', import.meta.url), 'utf8');

  const descLine = src.split('\n').find((l) => l.includes('description:'));
  assert.ok(descLine, 'collectBookingFeeAtLock must still set an order description');
  assert.match(
    descLine,
    /\$\{bookingFeeScheduleSummary\(\)\}/,
    'the description parenthetical must be interpolated from bookingFeeScheduleSummary()',
  );

  // No hard-coded percentage anywhere in the fee-order writer's CODE. Comments
  // may (and do) quote worked rates while explaining the bug; only what ships
  // in a string is under test, so comment lines are stripped first.
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
  assert.doesNotMatch(
    code,
    /\(\s*\d+(\.\d+)?\s*%/,
    'a literal "(5%)"-style rate must never be typed into the money document again',
  );

  // The wording either side of the parenthetical is unchanged (em dash + SLA).
  assert.match(descLine, /Setnayan booking fee \(/);
  assert.match(descLine, /— up for verification, confirmation within 24 hrs/);
});
