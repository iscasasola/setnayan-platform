/**
 * Unit suite for the shop "business milestone" — a monthsary through year one,
 * then a yearly anniversary. Invariants: a new shop counts monthly, an
 * established shop counts its TRUE years (never "Nth month"), and the year count
 * comes from the recorded founding year when present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { businessMilestone } from './vendor-milestone';

test('a new shop (this year) surfaces its next monthsary through year one', () => {
  // Opened Mar 1 2026, "in business since" 2026; on Jul 13 the next monthsary is
  // the 5th (Aug 1).
  const m = businessMilestone('2026-03-01', '2026-07-13', 2026);
  assert.ok(m);
  assert.equal(m.kind, 'monthsary');
  assert.equal(m.label, '5th month in business');
  assert.equal(m.dateISO, '2026-08-01');
});

test('a blank founding year falls back to Setnayan tenure (new → monthsary)', () => {
  const m = businessMilestone('2026-05-10', '2026-07-13', null);
  assert.ok(m);
  assert.equal(m.kind, 'monthsary');
  assert.equal(m.label, '3rd month in business');
});

test('an ESTABLISHED shop shows its TRUE years in business, never "Nth month"', () => {
  // Founded 2015 but only opened its Setnayan shop 3 months ago (Apr 10 2026).
  const m = businessMilestone('2026-04-10', '2026-07-13', 2015);
  assert.ok(m);
  assert.equal(m.kind, 'anniversary');
  // Next Setnayan-open anniversary is Apr 10 2027 → 2027 - 2015 = 12 years.
  assert.equal(m.label, '12th year in business');
  assert.equal(m.dateISO, '2027-04-10');
});

test('a shop past its first year (no founding year) graduates to the anniversary', () => {
  // Opened 2+ years ago, no founding year on file → Setnayan-tenure anniversary.
  const m = businessMilestone('2024-03-01', '2026-07-13', null);
  assert.ok(m);
  assert.equal(m.kind, 'anniversary');
  assert.equal(m.dateISO, '2027-03-01');
  assert.equal(m.label, '3rd year in business');
});

test('a bad date returns null', () => {
  assert.equal(businessMilestone('not-a-date', '2026-07-13', null), null);
  assert.equal(businessMilestone('2026-04-10', 'nope', null), null);
});
