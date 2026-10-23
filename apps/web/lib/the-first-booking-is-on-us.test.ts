/**
 * THE FIRST BOOKING IS ON US — ONE, NOT FIVE.
 *
 * ⚖ OWNER, 2026-10-23, verbatim: *"Your first booking is on us. Not 5. Then the
 * first 2000 bookings is also free."*
 *
 * Three properties, each one a way the old rule could survive the new one:
 *
 *   1 · THE MONEY. `decideLockFee` — the pure rule the SQL RPC mirrors — waives
 *       booking #1 and BILLS booking #2 for a supplier with no launch offer. The
 *       SQL itself (and the launch offer still waiving inside its cap) is held
 *       by `tests/db/the-first-booking-is-on-us.db.test.ts`.
 *   2 · NOTHING ALREADY GIVEN IS TAKEN BACK. A frozen booking keeps the answer
 *       it was frozen with: the standing reads `is_free_booking` off the ledger
 *       rather than re-asking `isFreeBooking(ordinal)`, and a receipt for an old
 *       booking 2…5 says it stays free.
 *   3 · THE WORDS. No shipped string may name a COUNT of free bookings — "first
 *       5", "five free bookings", "your 6th booking", or the limit interpolated
 *       after "first" (which rendered "your first 1 are free"). It scans
 *       `app/` + `lib/` with comments removed by the one string-aware lexer, so
 *       prose explaining the history is not convicted — only what renders.
 *
 * SABOTAGE (2026-10-23): FREE_BOOKING_LIMIT back to 5 → tests 1 + 4 RED;
 * restore `Your first 5 booked customers are free` on the booking-fees page →
 * test 3 RED naming that file; drop the `is_free_booking` read from
 * `resolveBookingFeeStanding` → test 2 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  FIRST_BOOKING_ON_US,
  FREE_BOOKING_LIMIT,
  decideLockFee,
  isFreeBooking,
} from './booking-fee-lock';
import { waivedFeeCopy, bookingFeeForecast } from './booking-fee-disclosure';
import { BOOKING_FEE } from './booking-fee';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

test('1 · the money: booking #1 is waived, booking #2 is billed (no launch offer)', () => {
  const first = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 1, agreedTotalPhp: 100_000 });
  assert.deepEqual(first, { charge: true, free: true, feePhp: 0, createOrder: false }, 'the first booking was not waived');

  const second = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 2, agreedTotalPhp: 100_000 });
  assert.equal(second.free, false, 'booking #2 was still free — the old five-booking rule is back');
  assert.equal(second.charge, true);
  assert.ok(second.feePhp > 0, 'booking #2 carried no fee');
  assert.equal(second.createOrder, true, 'booking #2 issued no order to pay');

  assert.equal(isFreeBooking(1), true);
  assert.equal(isFreeBooking(2), false);
  assert.equal(isFreeBooking(5), false, 'the 5th booking is free again');
});

test('2 · a booking frozen free under the old rule stays free — read off the ledger, never re-derived', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/booking-fee-disclosure.server.ts'), 'utf8'));
  // The ledger read must ask for the frozen answer…
  assert.match(
    src,
    /\.from\('booking_fee_ledger'\)\s*\.select\('[^']*\bis_free_booking\b[^']*'\)/,
    'resolveBookingFeeStanding no longer reads is_free_booking — a frozen booking 3 would be re-judged as billable',
  );
  // …and use it when the ordinal is frozen.
  assert.match(src, /ordinalIsFrozen\s*\?\s*frozenFree\b/, 'the frozen answer is read but not used');

  // The receipt for an old booking 2…5 says it stays free, never "billed".
  const old = waivedFeeCopy({
    chargeId: 'c', reason: 'free5', eventId: null, coupleName: null,
    computedPhp: 508.5, ordinal: 3, waivedOn: null,
  });
  assert.match(old.detail, /stays free/, `an old waived booking 3 reads: ${old.detail}`);
  assert.doesNotMatch(old.detail, /\b(5|five)\b/i, `the receipt still counts five: ${old.detail}`);

  // A frozen free booking 3 in the forecast keeps its waived line.
  const fc = bookingFeeForecast(
    { kind: 'free', ordinal: 3, ordinalIsFrozen: true, schedule: BOOKING_FEE },
    50_000,
  );
  assert.ok(fc && /waived/.test(fc.headline), `a frozen free booking 3 forecast: ${fc?.headline}`);
});

/** Copy that names a COUNT of free bookings. Property, not a sentence. */
const COUNTED_FREE = [
  // "first 5 bookings", "first five Setnayan-sourced bookings are free", "First 5 free"
  /\bfirst\s+(?:5|five)\b(?=[^.\n<>]{0,40}\b(?:bookings?|booked|clients?|customers?|free|on us)\b)/i,
  // "five free bookings", "5 free bookings"
  /\b(?:5|five)\s+free\s+bookings?\b/i,
  // "free until your 6th booking", "From your 6th booking"
  /\b(?:6th|sixth)\s+booking\b/i,
  // the limit interpolated as a count: `first ${FREE_BOOKING_LIMIT}`, `first {FREE_BOOKING_LIMIT}`,
  // `first ${formatCount(FREE_BOOKING_LIMIT)}`, `${FREE_BOOKING_LIMIT} free bookings`
  /\bfirst\s+\$?\{[^}]*FREE_BOOKING_LIMIT[^}]*\}/,
  /\$?\{[^}]*FREE_BOOKING_LIMIT[^}]*\}\s+free\b/,
  /\$\{\s*FREE_BOOKING_LIMIT\s*\+\s*1\s*\}th\b/,
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('3 · no shipped string names a count of free bookings', () => {
  const files = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))];
  assert.ok(files.length > 1000, `scanned only ${files.length} files — the walk is broken`);
  const hits: string[] = [];
  for (const f of files) {
    const code = stripComments(readFileSync(f, 'utf8'));
    if (!/five|\b5\b|6th|sixth|FREE_BOOKING_LIMIT/i.test(code)) continue;
    code.split('\n').forEach((line, i) => {
      for (const re of COUNTED_FREE) {
        if (re.test(line)) {
          hits.push(`${relative(WEB, f)}:${i + 1}  ${line.trim().slice(0, 140)}`);
          break;
        }
      }
    });
  }
  assert.deepEqual(hits, [], `copy still counts free bookings — say "${FIRST_BOOKING_ON_US}":\n${hits.join('\n')}`);
});

test('3b · the scan can hit (each pattern convicts the line it was written for)', () => {
  const samples = [
    'Your first 5 booked customers are free',
    'Your first five Setnayan-sourced bookings are on us',
    "b: 'First 5 free',",
    'It does not use up one of your five free bookings',
    'free until your 6th booking',
    'Your first ${FREE_BOOKING_LIMIT} are free',
    'Your first {FREE_BOOKING_LIMIT} Setnayan-sourced bookings',
    'first ${formatCount(FREE_BOOKING_LIMIT)} bookings',
    'any of your ${FREE_BOOKING_LIMIT} free bookings',
    'From your ${FREE_BOOKING_LIMIT + 1}th booking',
  ];
  for (const s of samples) {
    assert.ok(COUNTED_FREE.some((re) => re.test(s)), `the guard is blind to: ${s}`);
  }
  // …and does not convict the words that are not about free bookings.
  for (const s of ['Engaged over Christmas? Your first five steps', 'Your five main colours', FIRST_BOOKING_ON_US]) {
    assert.ok(!COUNTED_FREE.some((re) => re.test(s)), `the guard convicts an innocent line: ${s}`);
  }
});

test('4 · the copy is written for ONE free booking, so the twin must say one', () => {
  assert.equal(
    FREE_BOOKING_LIMIT,
    1,
    'FREE_BOOKING_LIMIT moved — every "your first booking from Setnayan is on us" sentence is now untrue; change the copy with it',
  );
  assert.equal(FIRST_BOOKING_ON_US, 'Your first booking from Setnayan is on us.');
});
