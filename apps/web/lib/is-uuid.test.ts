/**
 * is-uuid.test.ts — the predicate must agree with Postgres, not with taste.
 *
 * A stricter test than Postgres refuses ids the database accepts, turning a
 * logged 400 into a page that wrongly says "not found" — worse than the bug.
 * A looser one lets the 22P02 back through. Both directions are asserted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUuid } from './is-uuid';

test('accepts the ids the database actually mints', () => {
  for (const v of [
    '00000000-0000-0000-0000-000000000000', // nil uuid — Postgres accepts it
    'f47ac10b-58cc-4372-a567-0e02b2c3d479', // v4, the shape gen_random_uuid() emits
    'F47AC10B-58CC-4372-A567-0E02B2C3D479', // upper case is the same uuid
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // v1 — a stricter regex would refuse this
    'ffffffff-ffff-ffff-ffff-ffffffffffff', // no version/variant nibbles at all
  ]) {
    assert.equal(isUuid(v), true, `${v} is a uuid Postgres would accept`);
  }
});

test('refuses what made Postgres reject the whole query', () => {
  for (const v of [
    'zzzbad', // the literal value from the 2026-08-15 production log
    'sample-maria-and-juan', // the editorial sentinel, same 22P02 family
    '', // an empty segment
    'f47ac10b58cc4372a5670e02b2c3d479', // undashed — nothing here ever mints one
    '{f47ac10b-58cc-4372-a567-0e02b2c3d479}', // braced — same
    'f47ac10b-58cc-4372-a567-0e02b2c3d479 ', // trailing space
    ' f47ac10b-58cc-4372-a567-0e02b2c3d479', // leading space
    'f47ac10b-58cc-4372-a567-0e02b2c3d4790', // one hex too many
    'g47ac10b-58cc-4372-a567-0e02b2c3d479', // 'g' is not hex
  ]) {
    assert.equal(isUuid(v), false, `${JSON.stringify(v)} must not reach a uuid column`);
  }
});

test('a non-string can never be a uuid', () => {
  for (const v of [null, undefined, 42, {}, [], true]) {
    assert.equal(isUuid(v), false);
  }
});

test('the pattern is anchored — a uuid INSIDE a longer string is not one', () => {
  // Unanchored, `/join/f47ac10b-…/../../etc` would pass the guard and then be
  // rejected by Postgres anyway — the exact bug, one layer further in.
  assert.equal(isUuid('prefix-f47ac10b-58cc-4372-a567-0e02b2c3d479'), false);
  assert.equal(isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479/suffix'), false);
  assert.equal(isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479\nf47ac10b-58cc-4372-a567-0e02b2c3d479'), false);
});
