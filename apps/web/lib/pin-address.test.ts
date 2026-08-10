import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addressFromPin } from './pin-address';

test('a tapped pin writes the street down for a vendor who typed nothing', () => {
  assert.equal(addressFromPin('', '12 Banawe St, Quezon City'), '12 Banawe St, Quezon City');
  assert.equal(addressFromPin('   ', '12 Banawe St, Quezon City'), '12 Banawe St, Quezon City');
});

test('what the vendor typed is never replaced by the lookup', () => {
  // The document check compares against the vendor's own wording. Silently
  // rewriting it is how a form ends up disagreeing with the Mayor's Permit.
  assert.equal(addressFromPin('Unit 4B, 12 Banawe', 'Barangay 123, Fourth District'), null);
  assert.equal(addressFromPin('anything at all', ''), null);
});

test('a lookup that found no street leaves the box alone rather than blanking it', () => {
  assert.equal(addressFromPin('', ''), null);
  assert.equal(addressFromPin('', '   '), null);
});
