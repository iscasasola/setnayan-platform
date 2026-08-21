/**
 * people-search.test.ts — the wildcard escape, and the shape a result may take.
 *
 * The search itself needs a database; what is unit-testable here is the part
 * that has already cost this codebase real money once — the ILIKE escape — and
 * the contract the rest of the feature is built on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeLikeQuery, MAX_RESULTS, MIN_QUERY_LENGTH } from './people-search-query';

test('🚨 a typed % searches for a per-cent sign, not for everybody', () => {
  // Unescaped, `%` in an ILIKE pattern means "any run of characters", so a
  // single character would return the whole users table one page at a time.
  assert.equal(escapeLikeQuery('%'), '\\%');
  assert.equal(escapeLikeQuery('%%%'), '\\%\\%\\%');
  assert.equal(escapeLikeQuery('ma%ria'), 'ma\\%ria');
});

test('🚨 a typed _ matches an underscore, not "any character"', () => {
  // This is the exact defect that let an admin correction move a DIFFERENT
  // shop's address (2026-08-12): `banawe_` quietly matched `banawes`.
  assert.equal(escapeLikeQuery('_'), '\\_');
  assert.equal(escapeLikeQuery('ana_cruz'), 'ana\\_cruz');
});

test('a backslash is escaped too — otherwise it escapes the next character', () => {
  assert.equal(escapeLikeQuery('a\\b'), 'a\\\\b');
  // The nastiest case: a trailing backslash would otherwise escape the closing
  // `%` the caller appends, changing what the pattern means.
  assert.equal(escapeLikeQuery('ana\\'), 'ana\\\\');
});

test('ordinary names pass through untouched', () => {
  for (const name of ['Maria', 'José', 'Ana Cruz', "O'Brien", 'Ng', '陳', 'Nguyễn']) {
    assert.equal(escapeLikeQuery(name), name, `${name} was altered`);
  }
});

test('the thresholds are the enumeration guard, and they are not zero', () => {
  // One character is a crawl of the whole table, not a search for a person.
  assert.ok(MIN_QUERY_LENGTH >= 2, 'a single character can be searched — that is enumeration');
  // A result list, not a dataset.
  assert.ok(MAX_RESULTS <= 25, 'the result cap is high enough to page a directory');
});
