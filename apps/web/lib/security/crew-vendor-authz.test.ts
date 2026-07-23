/**
 * Unit suite for resolveAuthorizedCrewVendorId — the core authorization check
 * for POST /api/crew/register-device. A caller may only register a device for a
 * vendor_profile_id they actually control (from current_vendor_profile_ids());
 * a supplied id outside that set must resolve to null (→ 403).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthorizedCrewVendorId } from './crew-vendor-authz';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

test('accepts a supplied id the caller controls', () => {
  assert.equal(resolveAuthorizedCrewVendorId(A, [A, B]), A);
});

test('rejects a supplied id the caller does NOT control (foreign vendor)', () => {
  assert.equal(resolveAuthorizedCrewVendorId(A, [B]), null);
});

test('rejects when the caller controls no vendor at all', () => {
  assert.equal(resolveAuthorizedCrewVendorId(A, []), null);
});

test('rejects an empty supplied id even if the set is non-empty', () => {
  assert.equal(resolveAuthorizedCrewVendorId('', [A]), null);
});

test('never substitutes a different authorized id for the requested one', () => {
  // Caller controls B but asked for A → must be null, NOT B.
  assert.notEqual(resolveAuthorizedCrewVendorId(A, [B]), B);
  assert.equal(resolveAuthorizedCrewVendorId(A, [B]), null);
});
