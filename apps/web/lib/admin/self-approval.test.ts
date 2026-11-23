/**
 * The owner approves his own request — typed + 24 h (DECISION_LOG 2026-11-13).
 * The pure half; the database half (its own clock) is
 * tests/db/admin-areas-and-owner-self-approval.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SELF_APPROVAL_WAIT_MS,
  SELF_APPROVAL_WORD,
  expiryAfterConfirm,
  selfApprovalState,
  typedWordMatches,
  waitWords,
} from './self-approval';

const T0 = Date.parse('2026-11-13T00:00:00Z');
const runAfter = new Date(T0 + SELF_APPROVAL_WAIT_MS).toISOString();
const confirmed = { status: 'pending', self_confirmed_at: new Date(T0).toISOString(), run_after: runAfter };

test('the wait is 24 hours', () => {
  assert.equal(SELF_APPROVAL_WAIT_MS, 24 * 60 * 60 * 1000);
});

test('only the word starts the wait', () => {
  assert.equal(typedWordMatches(SELF_APPROVAL_WORD), true);
  assert.equal(typedWordMatches(` ${SELF_APPROVAL_WORD.toLowerCase()} `), true);
  assert.equal(typedWordMatches('yes'), false);
  assert.equal(typedWordMatches(''), false);
  assert.equal(typedWordMatches(null), false);
});

test('not typed yet → not started; never "due"', () => {
  assert.deepEqual(selfApprovalState({ status: 'pending', self_confirmed_at: null, run_after: null }, T0 + 10 * SELF_APPROVAL_WAIT_MS), {
    kind: 'not_started',
  });
});

test('before 24 hours it is WAITING — not due, one minute before or one hour in', () => {
  const a = selfApprovalState(confirmed, T0 + 60 * 60 * 1000);
  assert.equal(a.kind, 'waiting');
  const b = selfApprovalState(confirmed, T0 + SELF_APPROVAL_WAIT_MS - 60_000);
  assert.equal(b.kind, 'waiting');
  assert.equal(b.kind === 'waiting' && waitWords(b.msLeft), '1 min');
});

test('at or after 24 hours it is DUE', () => {
  assert.equal(selfApprovalState(confirmed, T0 + SELF_APPROVAL_WAIT_MS).kind, 'due');
});

test('a closed request is closed, whatever the clock', () => {
  assert.equal(selfApprovalState({ ...confirmed, status: 'withdrawn' }, T0 + 2 * SELF_APPROVAL_WAIT_MS).kind, 'closed');
});

test('waitWords never prints a negative or a decimal', () => {
  assert.equal(waitWords(-5), '0 min');
  assert.equal(waitWords(22 * 3600_000 + 30_000), '22 h 1 min');
  assert.equal(waitWords(3 * 3600_000), '3 h');
});

test('a request confirmed late in its week stays alive past its wait', () => {
  const expiresSoon = new Date(T0 + 60 * 60 * 1000).toISOString();
  const kept = Date.parse(expiryAfterConfirm(expiresSoon, T0));
  assert.ok(kept > T0 + SELF_APPROVAL_WAIT_MS, 'the request would expire mid-wait');
});
