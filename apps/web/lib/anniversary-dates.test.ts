/**
 * Unit test for the anniversary heads-up date helper. The heads-up target must
 * be exactly 6 weeks (42 days) ahead on the Manila civil calendar — that's what
 * makes `years_ago === 1` at the target equal "the 1st anniversary is 6 weeks out".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDaysToIso } from './anniversary-dates';

test('addDaysToIso: 42 days ahead, month/year rollover correct', () => {
  assert.equal(addDaysToIso('2026-07-12', 42), '2026-08-23');
  assert.equal(addDaysToIso('2026-12-25', 42), '2027-02-05'); // year rollover
  assert.equal(addDaysToIso('2026-01-01', 0), '2026-01-01');
});

test('addDaysToIso: leap-year span', () => {
  assert.equal(addDaysToIso('2028-02-01', 42), '2028-03-14');
});
