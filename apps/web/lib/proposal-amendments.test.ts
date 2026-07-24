/**
 * proposal-amendments — signed-amount conversion + bundle delta/total math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signedAmount, netDeltaPhp, newTotalPhp } from './proposal-amendments';

test('signedAmount: discount negative, add-on positive, freebie/request null', () => {
  assert.equal(signedAmount('discount', 5000), -5000);
  assert.equal(signedAmount('addon', 8000), 8000);
  assert.equal(signedAmount('freebie', 0), null);
  assert.equal(signedAmount('request', 100), null);
  assert.equal(signedAmount('discount', 0), null); // non-positive magnitude
  assert.equal(signedAmount('discount', undefined), null);
});

test('netDeltaPhp sums money items, ignores null (freebie/request)', () => {
  const items = [
    { amount_php: -5000 }, // discount
    { amount_php: 8000 }, // add-on
    { amount_php: null }, // freebie
    { amount_php: null }, // request
  ];
  assert.equal(netDeltaPhp(items), 3000);
});

test('newTotalPhp = base (centavos→pesos) + net delta, or null with no base', () => {
  // base ₱48,000 (4,800,000 centavos), −5,000 + 8,000 = +3,000 → ₱51,000
  assert.equal(newTotalPhp(4_800_000, [{ amount_php: -5000 }, { amount_php: 8000 }]), 51_000);
  assert.equal(newTotalPhp(null, [{ amount_php: -5000 }]), null);
  assert.equal(newTotalPhp(4_800_000, [{ amount_php: null }]), 48_000); // freebies only
});
