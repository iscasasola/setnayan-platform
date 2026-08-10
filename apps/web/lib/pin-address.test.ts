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

test('a street WE wrote from a pin follows the pin when it moves', () => {
  // The defect this closes: tap the map (box fills with street A), realise the
  // pin is off, tap again — the box kept street A while the card showed street
  // B and B's coordinates were saved. Two addresses on screen at once, and a
  // shop filed with a street that does not match its own pin.
  assert.equal(addressFromPin('12 Banawe St', '9 Kalayaan Ave', true), '9 Kalayaan Ave');
});

test('what the VENDOR typed still never moves, no matter how the pin moves', () => {
  assert.equal(addressFromPin('Unit 4B, 12 Banawe', '9 Kalayaan Ave', false), null);
  // And the default is theirs — a caller that forgets the flag must fail safe
  // toward keeping what a person wrote, never toward overwriting it.
  assert.equal(addressFromPin('Unit 4B, 12 Banawe', '9 Kalayaan Ave'), null);
});

test('even ours is not replaced by nothing', () => {
  // A lookup that named no street must not blank an address that is on screen
  // and correct.
  assert.equal(addressFromPin('12 Banawe St', '', true), null);
  assert.equal(addressFromPin('12 Banawe St', '   ', true), null);
});
