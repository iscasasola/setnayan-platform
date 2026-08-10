import assert from 'node:assert/strict';
import { test } from 'node:test';

import { locationStepError } from './open-shop-location-gate';
import { OPEN_SHOP_ERRORS } from './open-shop-validation';

const DONE = { hasPin: true, confirmed: true, city: 'Quezon City' };

test('a pin, a yes, and a city finishes the step', () => {
  assert.equal(locationStepError(DONE), null);
});

test('no pin stops the step — the owner-locked rule', () => {
  // Previously this passed. It is how a shop reached the database with no
  // coordinates at all, which was then written as 0,0.
  assert.equal(locationStepError({ ...DONE, hasPin: false }), OPEN_SHOP_ERRORS.locationPin);
});

test('a pin nobody has agreed to stops the step', () => {
  // The whole point of the confirmation: a machine's guess about where a
  // business physically is only counts once a person has looked at it.
  assert.equal(
    locationStepError({ ...DONE, confirmed: false }),
    OPEN_SHOP_ERRORS.locationConfirm,
  );
});

test('a confirmed pin still needs a city, because that is what couples search', () => {
  assert.equal(locationStepError({ ...DONE, city: '' }), OPEN_SHOP_ERRORS.locationCity);
  assert.equal(locationStepError({ ...DONE, city: '   ' }), OPEN_SHOP_ERRORS.locationCity);
});

test('the refusals come in the order the work happens', () => {
  // 🔑 With nothing done at all, the message must be "place your pin" — not
  // "confirm the address", which would name a button that is not on screen yet,
  // and not "add the city", which is not the thing standing in their way.
  assert.equal(
    locationStepError({ hasPin: false, confirmed: false, city: '' }),
    OPEN_SHOP_ERRORS.locationPin,
  );
  // Pin placed, nothing else: the confirmation is next, not the city.
  assert.equal(
    locationStepError({ hasPin: true, confirmed: false, city: '' }),
    OPEN_SHOP_ERRORS.locationConfirm,
  );
});

test('confirming without a pin does not sneak past the pin rule', () => {
  // A stale confirmation left over from a pin that was cleared must not count.
  assert.equal(
    locationStepError({ hasPin: false, confirmed: true, city: 'Quezon City' }),
    OPEN_SHOP_ERRORS.locationPin,
  );
});

test('the three refusals are distinct messages', () => {
  // Three different problems shown as one sentence would leave a vendor
  // re-reading a screen where nothing they change makes the message go away.
  const seen = new Set([
    OPEN_SHOP_ERRORS.locationPin,
    OPEN_SHOP_ERRORS.locationConfirm,
    OPEN_SHOP_ERRORS.locationCity,
  ]);
  assert.equal(seen.size, 3);
  // And each must name something the vendor can actually do.
  for (const msg of seen) assert.ok(msg.trim().length > 10, `unhelpful message: ${msg}`);
});
