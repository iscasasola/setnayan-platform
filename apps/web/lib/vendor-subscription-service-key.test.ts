import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vendorSubscriptionServiceKey,
  purchaseIdFromVendorSubscriptionServiceKey as parse,
} from './vendor-subscription-service-key';

const ID = '3f1c9a2e-7b41-4d55-9c3a-2e8f0b6d1a77';

test('round-trips a purchase id', () => {
  assert.equal(parse(vendorSubscriptionServiceKey(ID)), ID);
});

test('refuses a key that is not ours', () => {
  assert.equal(parse('vendor_extra_seat__' + ID), null);
  assert.equal(parse('vendor_subscription'), null);
  assert.equal(parse(null), null);
  assert.equal(parse(undefined), null);
});

test('refuses a suffix that is not a uuid — the hook must MISS, not call the RPC with rubbish', () => {
  assert.equal(parse('vendor_subscription__'), null);
  assert.equal(parse('vendor_subscription__not-a-uuid'), null);
  assert.equal(parse('vendor_subscription__' + ID + ' or 1=1'), null);
});

test('accepts an uppercased id by normalising it', () => {
  assert.equal(parse('vendor_subscription__' + ID.toUpperCase()), ID);
});
