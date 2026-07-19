/**
 * Unit suite for the vendor fit-QR verdict (2026-07-09).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVendorFitUrl, computeVendorFit } from './vendor-fit-qr';

test('buildVendorFitUrl encodes the ref onto /vendor/fit', () => {
  assert.match(buildVendorFitUrl('isla-and-light'), /\/vendor\/fit\/isla-and-light$/);
  assert.match(buildVendorFitUrl('a/b?c'), /\/vendor\/fit\/a%2Fb%3Fc$/);
});

test('all three checks pass → fits, no false', () => {
  const v = computeVendorFit({
    eventDate: '2027-02-14',
    vendorAvailableOnDate: true,
    distanceKm: 12,
    serviceRadiusKm: 50,
    startingPricePhp: 45000,
    remainingBudgetPhp: 100000,
  });
  assert.equal(v.fits, true);
  assert.deepEqual(v.checks.map((c) => c.ok), [true, true, true]);
});

test('a known failing check → does not fit; label is specific', () => {
  const v = computeVendorFit({
    eventDate: '2027-02-14',
    vendorAvailableOnDate: false,
    distanceKm: 80,
    serviceRadiusKm: 20,
    startingPricePhp: 200000,
    remainingBudgetPhp: 100000,
  });
  assert.equal(v.fits, false);
  assert.deepEqual(v.checks.map((c) => c.ok), [false, false, false]);
  assert.equal(v.checks[0]!.label, 'Booked on your date');
  assert.equal(v.checks[1]!.label, 'Beyond their 20km range');
  assert.equal(v.checks[2]!.label, 'Over your remaining budget');
});

test('warn-only: unknown inputs read null and never fail the fit', () => {
  const v = computeVendorFit({
    eventDate: null, // no locked date
    vendorAvailableOnDate: null,
    distanceKm: null, // unknown coords
    serviceRadiusKm: null,
    startingPricePhp: null, // no price / no budget
    remainingBudgetPhp: null,
  });
  assert.equal(v.fits, true, 'unknowns never fail — matches the fail-open dashboard rule');
  assert.deepEqual(v.checks.map((c) => c.ok), [null, null, null]);
});

test('reach fails open when only one side is known', () => {
  const v = computeVendorFit({
    eventDate: '2027-02-14',
    vendorAvailableOnDate: true,
    distanceKm: 999, // huge distance…
    serviceRadiusKm: null, // …but vendor is unscoped/nationwide → unknown, not a fail
    startingPricePhp: 10000,
    remainingBudgetPhp: 100000,
  });
  assert.equal(v.checks[1]!.ok, null);
  assert.equal(v.fits, true);
});
