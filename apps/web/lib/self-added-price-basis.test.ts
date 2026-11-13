/**
 * 🧾 Price basis v2 (lib/self-added-price-basis.ts) — the couple records what was agreed (`v2.html`), and the claim
 * door's pre-fill. Honest: a number not recorded is null / an empty box, never 0 or ₱0.
 *
 * Run (from apps/web): tsx --test lib/self-added-price-basis.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  afterClaim,
  agreedCountFromRow,
  agreedSuffix,
  basisFromColumn,
  basisLabel,
  claimPricePrefill,
  claimStaysLine,
  countRowName,
  parseAgreedCount,
  parseSelfAddedBasis,
  worksOut,
  worksOutWords,
} from './self-added-price-basis';

test('the basis: posted keys only; the column reads NULL / unknown as One price', () => {
  assert.equal(parseSelfAddedBasis('per_pax'), 'per_pax');
  assert.equal(parseSelfAddedBasis('fixed'), 'fixed');
  assert.equal(parseSelfAddedBasis('per_day'), null);
  assert.equal(parseSelfAddedBasis(undefined), null);
  assert.equal(basisFromColumn(null), 'fixed');
  assert.equal(basisFromColumn('per_hour'), 'per_hour');
  assert.equal(basisLabel('fixed'), 'One price');
});

test('v2 row names: Total agreed + Guests agreed / Hours agreed', () => {
  assert.equal(countRowName('per_pax'), 'Guests agreed');
  assert.equal(countRowName('per_hour'), 'Hours agreed');
});

test('the agreed count: whole guests, hours to two decimals, nothing for One price — 0 is no count', () => {
  assert.equal(parseAgreedCount('per_pax', '120'), 120);
  assert.equal(parseAgreedCount('per_pax', '1,200'), 1200);
  assert.equal(parseAgreedCount('per_pax', '120.5'), null, 'half a guest is not a count');
  assert.equal(parseAgreedCount('per_hour', '6.5'), 6.5);
  assert.equal(parseAgreedCount('per_hour', '5.333'), 5.33);
  for (const bad of ['0', '', 'abc', '-3', null]) assert.equal(parseAgreedCount('per_pax', bad), null, String(bad));
  assert.equal(parseAgreedCount('fixed', '120'), null);
});

test('the stored count follows the basis: guests in pax_quote_base, hours in agreed_hours', () => {
  assert.equal(agreedCountFromRow('per_pax', { pax_quote_base: 120, agreed_hours: null }), 120);
  assert.equal(agreedCountFromRow('per_hour', { pax_quote_base: 120, agreed_hours: '5.00' }), 5);
  assert.equal(agreedCountFromRow('fixed', { pax_quote_base: 120 }), null, 'One price carries no count');
  assert.equal(agreedCountFromRow('per_pax', { pax_quote_base: null }), null, 'missing is null, never 0');
});

test('works out to: ₱162,000 ÷ 120 = ₱1,350 a guest; a rounding is said', () => {
  assert.deepEqual(worksOut(162000, 120), { ratePhp: 1350, rounds: false });
  assert.equal(worksOutWords('per_pax', 162000, 120), 'Works out to ₱1,350 a guest');
  assert.equal(worksOutWords('per_hour', 30000, 5), 'Works out to ₱6,000 an hour');
  assert.deepEqual(worksOut(100000, 120), { ratePhp: 833, rounds: true });
  assert.equal(worksOutWords('per_pax', 100000, 120), 'Works out to about ₱833 a guest');
  assert.equal(worksOutWords('per_pax', null, 120), null, 'no total → no line, never ₱0');
  assert.equal(worksOutWords('per_pax', 162000, null), null);
});

test('the record card: "· 120 guests agreed" / "· 5 hours agreed"; One price and no count draw nothing', () => {
  assert.equal(agreedSuffix({ basis: 'per_pax', count: 120 }), '120 guests agreed');
  assert.equal(agreedSuffix({ basis: 'per_hour', count: 5 }), '5 hours agreed');
  assert.equal(agreedSuffix({ basis: 'per_hour', count: 1 }), '1 hour agreed');
  assert.equal(agreedSuffix({ basis: 'fixed', count: null }), null);
  assert.equal(agreedSuffix({ basis: 'per_pax', count: null }), null);
  assert.equal(agreedSuffix(null), null);
  assert.match(afterClaim('per_pax').line, /^After they claim: /);
  assert.match(afterClaim('fixed').detail, /never added to it/);
});

test('the claim door pre-fill — the Card Maker’s fields from what the couple agreed', () => {
  assert.deepEqual(claimPricePrefill('fixed', 80000, null), { basis: 'fixed', from: '80000' });
  assert.deepEqual(claimPricePrefill('per_pax', 162000, 120), { basis: 'per_pax', perPax: '1350', minPax: '120', rounds: false });
  assert.deepEqual(claimPricePrefill('per_pax', 100000, 120), { basis: 'per_pax', perPax: '833', minPax: '120', rounds: true });
  assert.deepEqual(claimPricePrefill('per_hour', 30000, 5), { basis: 'per_hour', minHours: '5', hourBase: '30000', extraHour: '' });
  // A number the couple did not record is an EMPTY box, never 0.
  assert.deepEqual(claimPricePrefill('per_pax', 162000, null), { basis: 'per_pax', perPax: '', minPax: '', rounds: false });
  assert.deepEqual(claimPricePrefill('fixed', null, null), { basis: 'fixed', from: '' });
});

test('the band: the couple’s agreed total stays as their booking — no band without a total', () => {
  assert.equal(claimStaysLine('Maria & Jose', 'per_pax', 162000, 120), 'Maria & Jose’s ₱162,000 for 120 guests stays as their booking.');
  assert.equal(claimStaysLine('Maria & Jose', 'per_hour', 30000, 5), 'Maria & Jose’s ₱30,000 for 5 hours stays as their booking.');
  assert.match(claimStaysLine('Maria & Jose', 'fixed', 80000, null)!, /one payment for the whole day/);
  assert.equal(claimStaysLine('Maria & Jose', 'per_pax', null, 120), null);
});

test('the sheet reads nothing — no schedule or guest-list read is left on the Add-a-supplier sheet', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/[eventId]/_components/price-basis-rows.tsx'), 'utf8');
  assert.doesNotMatch(src, /get_self_added_price_terms|\/schedule|createClient/);
  // Every box is the shipped TypedRow.
  assert.match(src, /<TypedRow/);
  assert.doesNotMatch(src, /<input(?![^>]*type="hidden")/);
});
