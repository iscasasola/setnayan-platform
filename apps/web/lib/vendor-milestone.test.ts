/**
 * Unit suite for the vendor first-year "business monthsary". Invariants: a new
 * shop counts monthly through year one, stops at month 12, and an established
 * business (old in_business_since_year) never reads "Nth month in business".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextBusinessMonthsary } from './vendor-milestone';

test('a new shop surfaces its next business monthsary through year one', () => {
  // Opened Mar 1 2026; on Jul 13 the next monthsary is the 5th (Aug 1).
  const m = nextBusinessMonthsary('2026-03-01', '2026-07-13', 2026);
  assert.ok(m, 'expected a business monthsary');
  assert.equal(m.label, '5th month in business');
  assert.equal(m.dateISO, '2026-08-01');
  assert.ok(m.daysUntil > 0);
});

test('a blank in-business year is treated as new (early-adopter default)', () => {
  const m = nextBusinessMonthsary('2026-05-10', '2026-07-13', null);
  assert.ok(m, 'expected a business monthsary');
  assert.equal(m.label, '3rd month in business');
});

test('the business monthsary STOPS after the first year (month 12+)', () => {
  // Opened 2+ years ago (year left blank so the establishedYear gate is not what
  // stops it) → the first-year cap returns null.
  assert.equal(nextBusinessMonthsary('2024-03-01', '2026-07-13', null), null);
});

test('an ESTABLISHED business that just joined gets no "Nth month" line', () => {
  // Founded 2015 but opened its Setnayan shop 3 months ago → suppressed.
  assert.equal(nextBusinessMonthsary('2026-04-10', '2026-07-13', 2015), null);
});

test('a bad date returns null', () => {
  assert.equal(nextBusinessMonthsary('not-a-date', '2026-07-13', null), null);
  assert.equal(nextBusinessMonthsary('2026-04-10', 'nope', null), null);
});
