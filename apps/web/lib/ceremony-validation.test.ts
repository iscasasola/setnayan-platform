/**
 * Regression test for the ceremony_type validation helpers
 * (isAllowedCeremonyValue / isAllowedSecondaryCeremonyValue).
 *
 * Guards the bug this fixes: the couple dashboard's ceremony/faith edit modal
 * offers all 18 faiths, but setEventCeremonyType (app/dashboard/[eventId]/
 * actions.ts) used to validate against a hardcoded 10-value list — silently
 * rejecting the 8 worldwide-expansion faiths (aglipayan/lds/sda/jw/hindu/sikh/
 * buddhist/orthodox, shipped in PR #1275) server-side even though the DB CHECK
 * (widened by migration 20261120000000) accepts them.
 *
 * The helpers derive from ALLOWED_CEREMONY_VALUES, which mirrors the lowercase
 * `events_ceremony_type_check` DB CHECK. This test pins that lockstep and the
 * Title-Case `faith_vocab` landmine (case-sensitive rejection).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAllowedCeremonyValue,
  isAllowedSecondaryCeremonyValue,
  ALLOWED_CEREMONY_VALUES,
  ALLOWED_SECONDARY_CEREMONY_VALUES,
} from './faith-registry';

// The exact lowercase set the DB CHECK allows, transcribed verbatim from
// supabase/migrations/20261120000000_faith_worldwide_expansion.sql
// (events_ceremony_type_check). This test FAILS if the TS keyspace and the DB
// CHECK ever drift apart.
const DB_CHECK_CEREMONY_TYPES = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'chinese',
  'jewish',
  'born_again',
  'mixed',
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
];

// The 8 worldwide-expansion faiths (PR #1275) that the old hardcoded 10-value
// list silently rejected. The whole point of the fix.
const WORLDWIDE_EXPANSION_FAITHS = [
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
];

test('isAllowedCeremonyValue accepts every value in the DB CHECK (all 18)', () => {
  for (const key of DB_CHECK_CEREMONY_TYPES) {
    assert.ok(isAllowedCeremonyValue(key), `expected "${key}" to be accepted`);
  }
});

test('isAllowedCeremonyValue accepts the 8 worldwide-expansion faiths (the fix)', () => {
  for (const key of WORLDWIDE_EXPANSION_FAITHS) {
    assert.ok(
      isAllowedCeremonyValue(key),
      `worldwide-expansion faith "${key}" must not be rejected server-side`,
    );
  }
});

test('TS keyspace is in exact lockstep with the DB CHECK — no drift', () => {
  assert.deepEqual(
    [...ALLOWED_CEREMONY_VALUES].sort(),
    [...DB_CHECK_CEREMONY_TYPES].sort(),
  );
});

test('isAllowedCeremonyValue rejects Title-Case faith_vocab keys (case-sensitive landmine)', () => {
  // 'Catholic' etc. belong to the Title-Case faith_vocab keyspace, NOT the
  // lowercase ceremony_type keyspace. They MUST be rejected here.
  for (const key of ['Catholic', 'Muslim', 'Hindu', 'Buddhist', 'Orthodox']) {
    assert.equal(
      isAllowedCeremonyValue(key),
      false,
      `Title-Case "${key}" must be rejected — wrong keyspace`,
    );
  }
});

test('isAllowedCeremonyValue rejects garbage and non-string input', () => {
  for (const bad of ['', ' catholic', 'catholic ', 'protestant', 'baha_i', 'CATHOLIC']) {
    assert.equal(isAllowedCeremonyValue(bad), false, `"${bad}" must be rejected`);
  }
  assert.equal(isAllowedCeremonyValue(null), false);
  assert.equal(isAllowedCeremonyValue(undefined), false);
  assert.equal(isAllowedCeremonyValue(123), false);
  assert.equal(isAllowedCeremonyValue({}), false);
});

test('secondary validator accepts every faith + civil but NEVER mixed', () => {
  for (const key of DB_CHECK_CEREMONY_TYPES) {
    if (key === 'mixed') {
      assert.equal(
        isAllowedSecondaryCeremonyValue(key),
        false,
        "'mixed' is a primary-only literal — never a valid secondary/overlay rite",
      );
    } else {
      assert.ok(
        isAllowedSecondaryCeremonyValue(key),
        `secondary "${key}" must be accepted`,
      );
    }
  }
  // Set-level guard: secondary set == primary set minus 'mixed'.
  assert.deepEqual(
    [...ALLOWED_SECONDARY_CEREMONY_VALUES].sort(),
    ALLOWED_CEREMONY_VALUES.filter((v) => v !== 'mixed').sort(),
  );
  assert.ok(!ALLOWED_SECONDARY_CEREMONY_VALUES.includes('mixed'));
});
