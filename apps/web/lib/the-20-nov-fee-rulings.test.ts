/**
 * THE 20 NOV BOOKING-FEE RULINGS, on the supplier's screens (the SQL half is
 * tests/db/the-20-nov-booking-fee-rulings.db.test.ts).
 *
 *   1 · THE FORECAST a supplier reads before Agree prices every worked example the bill will charge — ₱50,000,
 *       ₱100,000, ₱250,000, a ₱10M booking locked at ₱100,000, an unverified shop's flat rate.
 *   2 · A TICKET is auto-claimed and the copy never says "redeem"; SETNAYAN'S EVERY-NTH booking fee is named, with
 *       what it would have cost, on the forecast and on the receipt.
 *   3 · NOTHING SHIPPED PROMISES A FREE FIRST BOOKING. The "first booking is on us" constants are deleted and the
 *       whole of app/ and lib/ is scanned for the sentence; three files may say it, each for a stated reason.
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

/**
 * 3 · THE RETIRED PROMISE, EVERYWHERE (ship re-review, 20 Nov: "make guard 3 walk all of app/ and lib/ … for both the
 * retired wording and the constant names"). The three constants are DELETED; every shipped file in app/ and lib/ is
 * scanned with comments stripped. Only the files on ALLOWED may still say it, each with the reason it is true — and a
 * listed file that stops saying it fails until its line is removed, so the list can only shrink.
 */
const RETIRED_NAME = /\bFIRST_BOOKING_(ON_US|ON_US_CLAUSE|FREE|FREE_LABEL)\b/;
// Matched against the code with every run of whitespace collapsed to one space, so a sentence wrapped across JSX lines
// ("…are\n free.") is still one sentence. Re-review 20 Nov: also the plural and "the first one (is) free".
const RETIRED_WORDS =
  /first bookings?[^.'"`]{0,40}\b(on us|is free|are free|free)\b|first one,? (is )?free|unang booking[^.'"`]{0,40}libre|libre ang una mong booking/i;
const oneLine = (code: string) => code.replace(/\s+/g, ' ');
const ALLOWED: Record<string, string> = {
  'lib/booking-fee-disclosure.ts': 'freeBookingSentence — said only of a ledger place FROZEN free before 20 Nov, which stays free',
  'lib/help/supplier-1.ts': 'the help question "is my first booking free?" — its answer now says No',
  'app/dev/open-shop-lab/page.lab.tsx': 'a dev lab page, never shown to a supplier',
  'app/admin/verify/_components/free-booking-match-note.tsx':
    'admin only, PAST tense — a shop that had a free first booking before 20 Nov keeps it; never says one is waiting',
};

test('3 · the retired "first booking free" — no constant, no sentence — anywhere in app/ or lib/', () => {
  const names: string[] = [];
  const words = new Set<string>();
  let scanned = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        scanned += 1;
        const rel = relative(WEB, p);
        const code = stripComments(readFileSync(p, 'utf8'));
        if (RETIRED_NAME.test(code)) names.push(rel);
        if (RETIRED_WORDS.test(oneLine(code))) words.add(rel);
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.ok(scanned > 1000, `the walk read only ${scanned} files — it is broken, not clean`);
  assert.deepEqual(names, [], `a retired free-first-booking constant is used again:\n${names.join('\n')}`);
  const off = [...words].filter((f) => !(f in ALLOWED)).sort();
  assert.deepEqual(off, [], `a supplier is promised a free first booking that billing no longer gives:\n${off.join('\n')}`);
  const stale = Object.keys(ALLOWED).filter((f) => !words.has(f));
  assert.deepEqual(stale, [], `these no longer say it — delete their lines from ALLOWED:\n${stale.join('\n')}`);

  // The sentence is false only for NEW bookings: a ledger place frozen free keeps it (and only that path says it).
  const join_ = bookingFeeJoinDisclosure(BOOKING_FEE);
  assert.doesNotMatch(join_.detail, /first booking/i);
  assert.doesNotMatch(join_.detail, /always free/i, 'the 16 Nov rule: a supplier-brought client is not always free');
});
