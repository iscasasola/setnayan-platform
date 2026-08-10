import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCoord, parseCoordPair } from './parse-coord';

// ── The measured production defect ─────────────────────────────────────────
// A vendor who never dropped a pin was saved at 0,0. These are the two inputs
// that produced it, and they are the reason this file exists.
test('an ABSENT field is not a coordinate — this is the prod bug', () => {
  // formData.get() returns null for a field that was never submitted, and
  // Number(null) === 0, which is finite and inside ±90.
  assert.equal(parseCoord(null, 90), null);
  assert.equal(parseCoordPair(null, null), null);
});

test('a BLANK field is not a coordinate either — Number("") is also 0', () => {
  assert.equal(parseCoord('', 90), null);
  assert.equal(parseCoord('   ', 90), null);
  assert.equal(parseCoordPair('', ''), null);
});

test('the exact pair 0,0 is refused as the no-data artifact it is', () => {
  assert.equal(parseCoordPair('0', '0'), null);
  assert.equal(parseCoordPair('0.0000000', '0.0000000'), null);
});

test('but zero on ONE axis is a real place and is kept', () => {
  // The equator through Kenya; the Greenwich meridian through England.
  assert.deepEqual(parseCoordPair('0', '37.9'), { lat: 0, lng: 37.9 });
  assert.deepEqual(parseCoordPair('51.48', '0'), { lat: 51.48, lng: 0 });
});

test('a real Manila pin survives intact', () => {
  assert.deepEqual(parseCoordPair('14.686602', '121.068413'), {
    lat: 14.686602,
    lng: 121.068413,
  });
  assert.deepEqual(parseCoordPair(' 14.5995 ', ' 120.9842 '), {
    lat: 14.5995,
    lng: 120.9842,
  });
});

test('out-of-range and unparseable values are refused', () => {
  assert.equal(parseCoord('91', 90), null);
  assert.equal(parseCoord('-90.1', 90), null);
  assert.equal(parseCoord('181', 180), null);
  assert.equal(parseCoord('abc', 90), null);
  assert.equal(parseCoord('NaN', 90), null);
  assert.equal(parseCoord('Infinity', 90), null);
  // The boundaries themselves are valid.
  assert.equal(parseCoord('90', 90), 90);
  assert.equal(parseCoord('-180', 180), -180);
});

test('half a pin is not a pin', () => {
  // A latitude with no longitude would put the business on the Greenwich
  // meridian — a different continent, from one missing field.
  assert.equal(parseCoordPair('14.5995', null), null);
  assert.equal(parseCoordPair(null, '120.9842'), null);
  assert.equal(parseCoordPair('14.5995', 'not-a-number'), null);
});

test('non-string form values are refused rather than coerced', () => {
  // A File lands here if someone renames an input; coercing it would be the
  // same class of accident as coercing null.
  assert.equal(parseCoord(42 as unknown, 90), null);
  assert.equal(parseCoord(undefined, 90), null);
  assert.equal(parseCoord({} as unknown, 90), null);
});
