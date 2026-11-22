/** Who may move a client, and what each op writes (#8013 (f), controller row 6). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handoverWrite, mayAnswerHandOver, mayMoveClient } from './client-handover';

const am = { memberId: 'joy', duty: 'account_manager', branchId: 'makati' };
const bm = { memberId: 'rico', duty: 'branch_manager', branchId: 'makati' };
const sm = { memberId: null, duty: 'shop_manager', branchId: null };

test('the holder, or a Shop / Branch Manager, answers a Hand over; another Account Manager does not', () => {
  assert.equal(mayAnswerHandOver(am, 'joy', 'makati'), true);
  assert.equal(mayAnswerHandOver({ ...am, memberId: 'bea' }, 'joy', 'makati'), false);
  assert.equal(mayAnswerHandOver(bm, 'joy', 'makati'), true);
  assert.equal(mayAnswerHandOver(bm, 'joy', 'cebu'), false);
  assert.equal(mayAnswerHandOver(sm, 'joy', 'cebu'), true);
});

test('"Handled by ▾" is a manager’s, never an Account Manager’s', () => {
  assert.equal(mayMoveClient(am, 'makati'), false);
  assert.equal(mayMoveClient(bm, 'makati'), true);
  assert.equal(mayMoveClient(bm, null), false);
  assert.equal(mayMoveClient(sm, 'cebu'), true);
});

test('Keep tells nobody new; Give and a move tell the client; nothing to answer writes nothing', () => {
  assert.deepEqual(handoverWrite('keep', { handledBy: 'joy', handOver: 'bea' }, null), { handledBy: 'joy', tellClient: false });
  assert.deepEqual(handoverWrite('give', { handledBy: 'joy', handOver: 'bea' }, null), { handledBy: 'bea', tellClient: true });
  assert.equal(handoverWrite('give', { handledBy: 'joy', handOver: null }, null), null);
  assert.deepEqual(handoverWrite('move', { handledBy: 'joy', handOver: null }, 'mark'), { handledBy: 'mark', tellClient: true });
  assert.equal(handoverWrite('move', { handledBy: 'joy', handOver: null }, 'joy'), null);
});
