/**
 * supplier-client-room.test.ts — "Give them a quick range of how many clients can they serve" · "Yes, clients first"
 * (owner 2026-11-23, DECISION_LOG "SUPPLIER SIZES FIXED").
 *
 *   1 · the count is computed from TIER_CAPS (never typed) and rounded DOWN;
 *   2 · the words: a number below 10,000 clients, the size in words from there up, an asterisk on every one;
 *   3 · the line under it names the size from `storageWords`;
 *   4 · an unknown size draws no count, never a guess; a bigger plan never keeps fewer clients.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { storageWords } from './downgrade-limits';
import { STORAGE_GB, STORAGE_MB, TIER_CAPS, VENDOR_TIERS } from './vendor-tier-caps';
import { CLIENTS_FOOTNOTE, CLIENT_WORDS_FROM, clientsKept, clientsKeptWords, friendlyFloor, planStorageLine } from './supplier-client-room';

test('1 · each plan keeps about: Free 50 MB · Verified 1 GB · Plus 50 GB · Pro 256 GB · Ultra 1 TB', () => {
  assert.equal(clientsKept(TIER_CAPS.free.storageBytes), 60);
  assert.equal(clientsKept(TIER_CAPS.verified.storageBytes), 1_300);
  assert.equal(clientsKept(TIER_CAPS.solo.storageBytes), 65_000);
  assert.equal(clientsKept(TIER_CAPS.pro.storageBytes), 330_000);
  assert.equal(clientsKept(TIER_CAPS.enterprise.storageBytes), 1_300_000);
});

test('1b · it follows the size, not a typed table', () => {
  assert.equal(clientsKept(100 * STORAGE_MB), 120);
  assert.equal(clientsKept(2 * STORAGE_GB), 2_600);
});

test('2 · the headline on each plan card, with its asterisk, and the one footnote', () => {
  assert.equal(clientsKeptWords('free'), 'Keeps about 60 clients at a time*');
  assert.equal(clientsKeptWords('verified'), 'Keeps about 1,300 clients at a time*');
  assert.equal(clientsKeptWords('solo'), 'Keeps tens of thousands of clients*');
  assert.equal(clientsKeptWords('pro'), 'Keeps hundreds of thousands of clients*');
  assert.equal(clientsKeptWords('enterprise'), 'Keeps over a million clients*');
  assert.equal(clientsKeptWords(null), clientsKeptWords('free'), 'an unknown plan reads as Free');
  assert.equal(CLIENTS_FOOTNOTE, '*An estimate: one booked client with 5 photos collected for that event only.');
  for (const t of VENDOR_TIERS) {
    const n = clientsKept(TIER_CAPS[t].storageBytes)!;
    const words = clientsKeptWords(t)!;
    assert.ok(words.endsWith('*'), `${t}: no asterisk`);
    assert.equal(/\d/.test(words), n < CLIENT_WORDS_FROM, `${t}: a number below ${CLIENT_WORDS_FROM}, words from there up`);
  }
});

test('3 · the size line under it is the size from storageWords; a counted plan says how to make room', () => {
  assert.equal(planStorageLine('free'), '50 MB storage · clear older clients’ photos to make room');
  assert.equal(planStorageLine('verified'), '1 GB storage · clear older clients’ photos to make room');
  assert.equal(planStorageLine('pro'), '256 GB storage');
  for (const t of VENDOR_TIERS) assert.ok(planStorageLine(t)!.startsWith(`${storageWords(TIER_CAPS[t].storageBytes!)} storage`), t);
});

test('4 · unknown sizes, rounding down, and order', () => {
  for (const v of [null, undefined, 0, -1, Number.NaN, Infinity]) assert.equal(clientsKept(v as number | null), null, String(v));
  assert.equal(friendlyFloor(128.4), 120);
  assert.equal(friendlyFloor(1_308), 1_300);
  assert.equal(friendlyFloor(62.9), 60);
  assert.equal(friendlyFloor(7.9), 7);
  assert.equal(friendlyFloor(0.4), 0);
  let last = 0;
  for (const t of VENDOR_TIERS) {
    const n = clientsKept(TIER_CAPS[t].storageBytes)!;
    assert.ok(n >= last, `${t}: a bigger plan never keeps fewer clients`);
    last = n;
  }
});
