/**
 * D2 (2026-09-11): a first-year shop never reads "0 yrs in business".
 *
 * `yearsInBusiness` returned `nowYear - sinceYear` unclamped, so a vendor who
 * declared a start year equal to the current year got `0` — a real number,
 * not the `null` every render site already treats as "no line" — and the
 * public shop page printed "0 yrs in business" (row 3838: a page must never
 * show a stock photo, a zero, or an empty chart).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { yearsInBusiness } from './vendor-experience';

test('a start year equal to now (0 elapsed years) returns null, not 0', () => {
  assert.equal(yearsInBusiness(2026, 2026), null);
});

test('a genuine one full year still counts', () => {
  assert.equal(yearsInBusiness(2025, 2026), 1);
});

test('a real multi-year shop is unaffected', () => {
  assert.equal(yearsInBusiness(2016, 2026), 10);
});

test('unset stays null', () => {
  assert.equal(yearsInBusiness(null, 2026), null);
  assert.equal(yearsInBusiness(undefined, 2026), null);
});

test('implausible years (too old, or in the future) stay null', () => {
  assert.equal(yearsInBusiness(1899, 2026), null);
  assert.equal(yearsInBusiness(2027, 2026), null);
});
