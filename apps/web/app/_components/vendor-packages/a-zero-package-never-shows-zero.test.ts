/** FINAL CHECK A1-123: a package saved at ₱0 never shows "₱0" to couples. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packagePriceLabel } from './package-card';

test('₱0 and a missing price read "Price on request"; a real price reads the peso figure', () => {
  assert.equal(packagePriceLabel(0, false), 'Price on request');
  assert.equal(packagePriceLabel(null, false), 'Price on request');
  assert.doesNotMatch(packagePriceLabel(0, false), /₱/);
  assert.match(packagePriceLabel(1_500_000, false), /₱/);
  assert.equal(packagePriceLabel(1_500_000, true), 'Price on inquiry');
});
