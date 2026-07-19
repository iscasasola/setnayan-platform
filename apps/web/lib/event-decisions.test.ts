/**
 * Guard suite for summarizeEventDecisions — the pure folder behind the launcher
 * card's "needs a decision now" line. Locks the priority order (pay → approve →
 * message → overdue), the count-led labels, and the total that drives "· N more".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEventDecisions } from './event-decisions';

const NONE = { pay: 0, approve: 0, message: 0, overdue: 0 };

test('nothing pending → no line', () => {
  const s = summarizeEventDecisions({ ...NONE });
  assert.equal(s.total, 0);
  assert.equal(s.top, null);
});

test('priority: pay outranks everything', () => {
  const s = summarizeEventDecisions({ pay: 1, approve: 3, message: 2, overdue: 9 });
  assert.equal(s.top?.kind, 'pay');
  assert.equal(s.top?.label, '1 payment to settle');
  assert.equal(s.total, 15);
});

test('priority: approve outranks message + overdue', () => {
  const s = summarizeEventDecisions({ pay: 0, approve: 2, message: 5, overdue: 1 });
  assert.equal(s.top?.kind, 'approve');
  assert.equal(s.top?.label, '2 quotes to approve');
});

test('priority: message outranks overdue, labeled as chats not messages', () => {
  const s = summarizeEventDecisions({ pay: 0, approve: 0, message: 1, overdue: 4 });
  assert.equal(s.top?.kind, 'message');
  assert.equal(s.top?.label, '1 unread chat');
});

test('overdue is the fallback', () => {
  const s = summarizeEventDecisions({ pay: 0, approve: 0, message: 0, overdue: 3 });
  assert.equal(s.top?.kind, 'overdue');
  assert.equal(s.top?.label, '3 tasks overdue');
});

test('pluralization: singular vs plural per kind', () => {
  assert.equal(
    summarizeEventDecisions({ ...NONE, pay: 2 }).top?.label,
    '2 payments to settle',
  );
  assert.equal(
    summarizeEventDecisions({ ...NONE, approve: 1 }).top?.label,
    '1 quote to approve',
  );
  assert.equal(
    summarizeEventDecisions({ ...NONE, message: 3 }).top?.label,
    '3 unread chats',
  );
  assert.equal(
    summarizeEventDecisions({ ...NONE, overdue: 1 }).top?.label,
    '1 task overdue',
  );
});

test('total counts every kind (drives "· N more")', () => {
  const s = summarizeEventDecisions({ pay: 2, approve: 0, message: 0, overdue: 1 });
  assert.equal(s.total, 3);
  assert.equal(s.top?.count, 2); // → "2 payments to settle · 1 more"
});
