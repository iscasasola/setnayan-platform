import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  describeUserDeleteBlocker,
  DELIBERATE_BLOCKER_CONSTRAINTS,
} from './user-delete-blockers';

/** The shape Postgres actually produces for a RESTRICT / NO ACTION refusal. */
const pgFkMessage = (constraint: string, table: string) =>
  `update or delete on table "users" violates foreign key constraint "${constraint}" on table "${table}"`;

test('a deliberate refusal is explained in terms of the record, not the constraint', () => {
  // Was the signature FK until 2026-09-18, when vendor_contract_signatures was
  // DROPPED (contracts are upload-only). supplies_orders is the next-strongest
  // refusal: a completed commercial transaction with a BIR record-keeping duty.
  const msg = describeUserDeleteBlocker(
    pgFkMessage('supplies_orders_buyer_user_id_fkey', 'supplies_orders'),
  );
  assert.ok(msg, 'a deliberate refusal went unrecognised');
  assert.match(msg, /supplies purchase/);
  assert.match(msg, /BIR/);
  // The whole point is that the admin is told what to do instead.
  assert.match(msg, /Erase them instead/);
  // …and NOT handed the constraint name they were handed before.
  assert.doesNotMatch(msg, /_fkey/);
});

test('every deliberate blocker is recognised', () => {
  for (const constraint of DELIBERATE_BLOCKER_CONSTRAINTS) {
    assert.ok(
      describeUserDeleteBlocker(pgFkMessage(constraint, 'irrelevant')),
      `${constraint} is listed as deliberate but produces no explanation`,
    );
  }
});

test('an UNDECIDED refusal returns null rather than a reassuring sentence', () => {
  // This is the load-bearing case. A foreign key nobody decided on is the bug the
  // 2026-08-01 / 08-02 sweeps closed; if it ever comes back, dressing it up as a
  // deliberate retention would hide the regression behind a polite message. null
  // means "keep showing the raw error" on purpose.
  assert.equal(
    describeUserDeleteBlocker(pgFkMessage('some_new_table_created_by_fkey', 'some_new_table')),
    null,
  );
  assert.equal(describeUserDeleteBlocker(''), null);
  assert.equal(describeUserDeleteBlocker('connection terminated unexpectedly'), null);
});
