/**
 * decideSelfCompAuthority invariants (Node built-in test runner, via tsx).
 *
 * Money fix (b): the vendor self-comp branch of createOrder mints an order at
 * status='paid' and provisions the SKU on a caller-supplied event_id. Comp
 * authority (owner/admin of the vendor) is NOT enough on its own — a
 * self-registered vendor auto-owns their profile — so the caller must ALSO be a
 * couple member of the TARGET event. Both signals required; fail closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideSelfCompAuthority } from './self-comp-authority';

test('owner of the vendor AND couple of the event → allowed', () => {
  assert.deepEqual(
    decideSelfCompAuthority({ vendorRole: 'owner', isCoupleMemberOfEvent: true }),
    { allowed: true, reason: 'ok' },
  );
});

test('admin of the vendor AND couple of the event → allowed', () => {
  assert.deepEqual(
    decideSelfCompAuthority({ vendorRole: 'admin', isCoupleMemberOfEvent: true }),
    { allowed: true, reason: 'ok' },
  );
});

test('vendor owner but NOT a couple member of the target event → denied (the hole)', () => {
  // This is the exact exploit: a vendor owner comping a SKU onto a stranger's
  // event. Comp authority present, event authority absent → must deny.
  assert.deepEqual(
    decideSelfCompAuthority({ vendorRole: 'owner', isCoupleMemberOfEvent: false }),
    { allowed: false, reason: 'not_event_couple' },
  );
});

test('couple of the event but only agent/viewer on the vendor → denied', () => {
  for (const role of ['agent', 'viewer'] as const) {
    assert.deepEqual(
      decideSelfCompAuthority({ vendorRole: role, isCoupleMemberOfEvent: true }),
      { allowed: false, reason: 'not_vendor_owner_admin' },
    );
  }
});

test('not on the vendor team at all → denied', () => {
  assert.deepEqual(
    decideSelfCompAuthority({ vendorRole: null, isCoupleMemberOfEvent: true }),
    { allowed: false, reason: 'not_vendor_owner_admin' },
  );
});

test('neither signal → denied (fails closed, vendor check reported first)', () => {
  assert.deepEqual(
    decideSelfCompAuthority({ vendorRole: null, isCoupleMemberOfEvent: false }),
    { allowed: false, reason: 'not_vendor_owner_admin' },
  );
});
