/**
 * THE 20 NOV BOOKING-FEE RULINGS, on the supplier's screens (the SQL half is
 * tests/db/the-20-nov-booking-fee-rulings.db.test.ts).
 *
 *   1 · THE FORECAST a supplier reads before Agree prices every worked example the bill will charge — ₱50,000,
 *       ₱100,000, ₱250,000, a ₱10M booking locked at ₱100,000, an unverified shop's flat rate.
 *   2 · A TICKET is auto-claimed and the copy never says "redeem"; SETNAYAN'S EVERY-NTH booking fee is named, with
 *       what it would have cost, on the forecast and on the receipt.
 *   3 · NO FEE SURFACE PROMISES A FREE FIRST BOOKING. The "first booking is on us" sentences are retired copy, kept
 *       exported only for public pages being rewritten in their own PRs; the bill, the receipt, the forecast, the Plan
 *       row and the Booking fees page may not use them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { BOOKING_FEE } from './booking-fee';
import { bookingFeeForecast, bookingFeeJoinDisclosure, waivedFeeReceiptCopy } from './booking-fee-disclosure';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const billable = (extra: Record<string, unknown> = {}) =>
  ({ kind: 'billable', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE, ...extra }) as const;

test('1 · the forecast prices the worked examples exactly as the bill', () => {
  const cases: Array<[number, string]> = [
    [50_000, '₱2,500.00'],
    [100_000, '₱5,000.00'],
    [250_000, '₱9,500.00'],
    [10_000_000, '₱100,000.00'],
  ];
  for (const [total, fee] of cases) {
    const f = bookingFeeForecast(billable(), total)!;
    assert.ok(f.headline.startsWith(`Booking fee ${fee}`), `₱${total}: ${f.headline}`);
    assert.match(f.headline, /payable/);
    assert.doesNotMatch(f.detail, /first booking .* on us/i, 'a billed booking claimed a free first booking');
  }
  const flat = bookingFeeForecast(billable({ unverified: true }), 250_000)!;
  assert.ok(flat.headline.startsWith('Booking fee ₱12,500.00'), flat.headline);
  assert.match(flat.detail, /5% of the whole booking, minimum ₱50, never more than ₱100,000/);
});

test('2 · a ticket pays by itself; Setnayan’s every-Nth fee is named on the forecast and the receipt', () => {
  const ticket = bookingFeeForecast(billable({ badgeReward: 'next' }), 100_000)!;
  assert.match(ticket.headline, /₱5,000\.00 → ₱0\.00/);
  assert.match(ticket.detail, /used by itself on your next booking with a fee/);
  assert.doesNotMatch(`${ticket.headline} ${ticket.detail}`, /redeem/i);

  const nth = bookingFeeForecast(billable({ ordinalIsFrozen: true, platformFree: 100_000 }), 100_000)!;
  assert.equal(nth.tone, 'good');
  assert.match(nth.headline, /₱5,000\.00 → ₱0\.00 · Setnayan's 100,000th booking fee/);
  assert.match(nth.detail, /ticket you hold was not used/);

  const receipt = waivedFeeReceiptCopy({
    chargeId: 'c', reason: 'platform', eventId: null, coupleName: 'Rosa & Ben',
    computedPhp: 5_000, ordinal: 4, waivedOn: '2026-11-20', platformNumber: 100_000,
  });
  assert.match(receipt.title, /₱5,000\.00 — waived for Rosa & Ben/);
  assert.match(receipt.body, /booking fee number 100,000 on Setnayan — Setnayan's 100,000th/);
  assert.match(receipt.body, /there is nothing to pay/);
});

test('2b · no shipped string tells a supplier to "redeem" a booking fee ticket', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        stripComments(readFileSync(p, 'utf8')).split('\n').forEach((line, i) => {
          if (/redeem/i.test(line) && /(booking fee|fee ticket|free booking)/i.test(line)) {
            hits.push(`${relative(WEB, p)}:${i + 1}  ${line.trim().slice(0, 120)}`);
          }
        });
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(hits, [], 'owner 2026-11-20: tickets are auto-claimed, never redeemed at will');
});

test('3 · no fee surface uses the retired "first booking is on us" sentences', () => {
  const FEE_SURFACES = [
    'lib/booking-fee-disclosure.ts',
    'lib/booking-fee-disclosure.server.ts',
    'lib/booking-fee-lock.server.ts',
    'lib/vendor-plan-rows.ts',
    'app/vendor-dashboard/booking-fees/page.tsx',
    'app/vendor-dashboard/customers/_components/money-segment.tsx',
  ];
  for (const rel of FEE_SURFACES) {
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.doesNotMatch(code, /FIRST_BOOKING_(ON_US|ON_US_CLAUSE|FREE)\b/, `${rel} still uses a retired free-first-booking sentence`);
  }
  // Ship review 20 Nov: the help row, the feature page (EN + TL) and the invite door said it in their own words.
  const COPY_SURFACES = [
    ...FEE_SURFACES,
    'app/vendor-dashboard/settings/settings-rows.ts',
    'lib/feature-pages/suppliers-b.ts',
    'lib/personal-invite-offer.ts',
  ];
  const RETIRED = /first booking (from|through) Setnayan is (on us|free)|first booking is (on us|free)|libre ang una mong booking/i;
  for (const rel of COPY_SURFACES) {
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.doesNotMatch(code, RETIRED, `${rel} still tells a supplier the first booking is free`);
  }
  const join_ = bookingFeeJoinDisclosure(BOOKING_FEE);
  assert.doesNotMatch(join_.detail, /first booking/i);
  assert.doesNotMatch(join_.detail, /always free/i, 'the 16 Nov rule: a supplier-brought client is not always free');
});
