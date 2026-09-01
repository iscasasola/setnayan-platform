/**
 * business-alaga.test.ts — the record a shop becomes, and the two promises it
 * makes: EXACTLY ONE, and NOTHING SENSITIVE.
 *
 * The idempotency has two halves and this file asserts the app's half; the
 * database's half (the partial UNIQUE index) is proved in the migration's own
 * prod dry-run, because a unique index cannot be asserted from a pure module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALAGA_NAME_MAX,
  buildBusinessAlagaInsert,
  businessAlagaName,
  isAlreadyRecorded,
} from './business-alaga';

test('a shop becomes a business alaga owned by the caller', () => {
  const row = buildBusinessAlagaInsert({
    ownerUserId: 'user-1',
    vendorProfileId: 'shop-1',
    shopName: '  Aling Nena’s Store  ',
  });
  assert.deepEqual(row, {
    owner_user_id: 'user-1',
    vendor_profile_id: 'shop-1',
    dependent_kind: 'business',
    name: 'Aling Nena’s Store',
  });
});

/**
 * 🔴 THE RULE THAT IS NOW ENFORCING ON A LIVE SURFACE. Only the PERSON kind may
 * carry sensitive personal data (a child's birthdate, religion, sex — RA 10173
 * §3(l) + minors). A business may NOT, and it gets no consent stamp either: a
 * company's founding date is not sensitive PI, and stamping it would dilute the
 * stamp that guards a child's birthday.
 *
 * Asserted as the ABSENCE OF KEYS, not as `=== null`, because a null column is
 * still a column this writer would be claiming to have considered.
 */
test('a business row carries no sensitive field and no consent stamp', () => {
  const row = buildBusinessAlagaInsert({
    ownerUserId: 'user-1',
    vendorProfileId: 'shop-1',
    shopName: 'Cebu Lechon Co.',
  });
  assert.ok(row);
  assert.deepEqual(Object.keys(row).sort(), [
    'dependent_kind',
    'name',
    'owner_user_id',
    'vendor_profile_id',
  ]);
  for (const forbidden of [
    'birth_date',
    'birth_date_consent_at',
    'religion',
    'religion_consent_at',
    'sex',
    'relationship',
    'shared_with_spouse',
  ]) {
    assert.equal(forbidden in row, false, `${forbidden} must never be written for a business`);
  }
});

/** A row we cannot name is a row the People surface already refuses to render. */
test('nothing is written without an owner, a shop and a name', () => {
  assert.equal(
    buildBusinessAlagaInsert({ ownerUserId: '', vendorProfileId: 'shop-1', shopName: 'A' }),
    null,
  );
  assert.equal(
    buildBusinessAlagaInsert({ ownerUserId: 'u', vendorProfileId: null, shopName: 'A' }),
    null,
  );
  assert.equal(
    buildBusinessAlagaInsert({ ownerUserId: 'u', vendorProfileId: 'shop-1', shopName: '   ' }),
    null,
  );
  assert.equal(
    buildBusinessAlagaInsert({ ownerUserId: 'u', vendorProfileId: 'shop-1', shopName: null }),
    null,
  );
});

/** Same 128 cap `addDependent` applies, so one business is never stored two lengths. */
test('the name is capped exactly where a hand-typed alaga is capped', () => {
  assert.equal(ALAGA_NAME_MAX, 128);
  const long = 'x'.repeat(200);
  assert.equal(businessAlagaName(long).length, 128);
  assert.equal(buildBusinessAlagaInsert({
    ownerUserId: 'u',
    vendorProfileId: 's',
    shopName: long,
  })?.name.length, 128);
});

/**
 * The unique index doing its job is the outcome we wanted, not a failure. If
 * this read the other way, "exactly one, never a duplicate" would surface to a
 * supplier as an error on the screen that just opened their shop.
 */
test('a lost race on the idempotency key reads as already recorded', () => {
  assert.equal(isAlreadyRecorded({ code: '23505', message: 'duplicate key value' }), true);
  assert.equal(
    isAlreadyRecorded({
      code: null,
      message: 'duplicate key value violates unique constraint "dependents_owner_vendor_profile_key"',
    }),
    true,
  );
  // …and a real failure is still a real failure.
  assert.equal(isAlreadyRecorded({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isAlreadyRecorded(null), false);
});
