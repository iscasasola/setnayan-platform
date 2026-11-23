/**
 * supplier-client-room.test.ts — "Give them a quick range of how many clients can they serve" (owner 2026-11-23,
 * DECISION_LOG "SUPPLIER SIZES FIXED").
 *
 *   1 · the range is computed from TIER_CAPS (never typed): the five sizes give the ruled approximate ranges;
 *   2 · the words: a number range below 10,000 clients, the size in words from there up;
 *   3 · an unknown size draws no line, never a guess;
 *   4 · friendly rounding, and a bigger plan never reads fewer clients.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_GB, STORAGE_MB, TIER_CAPS, VENDOR_TIERS } from './vendor-tier-caps';
import { CLIENT_WORDS_FROM, clientRange, clientRangeWords, friendlyRound } from './supplier-client-room';

test('1 · each plan’s range, from its size: Free 128 MB · Verified 1 GB · Plus 100 GB · Pro 500 GB · Ultra 1 TB', () => {
  assert.deepEqual(clientRange(TIER_CAPS.free.storageBytes), { low: 25, high: 150 });
  assert.deepEqual(clientRange(TIER_CAPS.verified.storageBytes), { low: 200, high: 1_200 });
  assert.deepEqual(clientRange(TIER_CAPS.solo.storageBytes), { low: 20_000, high: 120_000 });
  assert.deepEqual(clientRange(TIER_CAPS.pro.storageBytes), { low: 100_000, high: 600_000 });
  assert.deepEqual(clientRange(TIER_CAPS.enterprise.storageBytes), { low: 200_000, high: 1_200_000 });
});

test('1b · it follows the size, not a typed table: a different size gives a different range', () => {
  assert.deepEqual(clientRange(256 * STORAGE_MB), { low: 50, high: 300 });
  assert.deepEqual(clientRange(2 * STORAGE_GB), { low: 400, high: 2_500 });
});

test('2 · the words on each plan card', () => {
  assert.equal(clientRangeWords('free'), 'Room for about 25–150 clients');
  assert.equal(clientRangeWords('verified'), 'Room for about 200–1,200 clients');
  assert.equal(clientRangeWords('solo'), 'Room for tens of thousands of clients');
  assert.equal(clientRangeWords('pro'), 'Room for hundreds of thousands of clients');
  assert.equal(clientRangeWords('enterprise'), 'Room for hundreds of thousands of clients');
  assert.equal(clientRangeWords(null), clientRangeWords('free'), 'an unknown plan reads as Free');
  for (const t of VENDOR_TIERS) {
    const r = clientRange(TIER_CAPS[t].storageBytes)!;
    const words = clientRangeWords(t)!;
    assert.equal(/\d/.test(words), r.low < CLIENT_WORDS_FROM, `${t}: numbers below ${CLIENT_WORDS_FROM}, words from there up`);
  }
});

test('3 · an unknown or empty size: no range, never a guess', () => {
  for (const v of [null, undefined, 0, -1, Number.NaN, Infinity]) assert.equal(clientRange(v as number | null), null, String(v));
});

test('4 · friendly rounding and order', () => {
  assert.equal(friendlyRound(23.5), 25);
  assert.equal(friendlyRound(165), 150);
  assert.equal(friendlyRound(1_308), 1_200);
  assert.equal(friendlyRound(131_000), 120_000);
  assert.equal(friendlyRound(0.4), 1);
  let last = 0;
  for (const t of VENDOR_TIERS) {
    const r = clientRange(TIER_CAPS[t].storageBytes)!;
    assert.ok(r.low < r.high, `${t}: low < high`);
    assert.ok(r.low >= last, `${t}: a bigger plan never reads fewer clients`);
    last = r.low;
  }
});
