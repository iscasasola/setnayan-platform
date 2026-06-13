/**
 * Unit suite for the FREE seat-finder query guard (seat-finding PR 1).
 * Load-bearing invariant: a too-short query (0/1 real chars after
 * normalization) returns null so neither the client nor the route ever fires
 * a roster-enumerating lookup, while a valid query is normalized identically
 * to how guest names are stored (so the match lands).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSeatLookupQuery, SEAT_LOOKUP_MIN_LEN } from './seat-lookup';

// Built at runtime so no literal invisible character lives in this source
// (which would trip eslint no-irregular-whitespace and confuse diff tooling).
const ZWSP = String.fromCharCode(0x200b);

test('sanitizeSeatLookupQuery rejects too-short / empty queries', () => {
  assert.equal(sanitizeSeatLookupQuery(''), null);
  assert.equal(sanitizeSeatLookupQuery('a'), null);
  assert.equal(sanitizeSeatLookupQuery('  x  '), null); // trims to 1 real char
  assert.equal(sanitizeSeatLookupQuery(null), null);
  assert.equal(sanitizeSeatLookupQuery(undefined), null);
});

test('sanitizeSeatLookupQuery normalizes and keeps valid queries', () => {
  assert.equal(sanitizeSeatLookupQuery('Maria'), 'Maria');
  assert.equal(sanitizeSeatLookupQuery('  Ben   Santos  '), 'Ben Santos');
  // A zero-width space between letters is stripped, leaving 2 real chars.
  assert.equal(sanitizeSeatLookupQuery(`A${ZWSP}l`), 'Al');
});

test('SEAT_LOOKUP_MIN_LEN guard is 2', () => {
  assert.equal(SEAT_LOOKUP_MIN_LEN, 2);
});
