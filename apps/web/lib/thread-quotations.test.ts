/**
 * thread-quotations — pin-latest selection + acceptable-status gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAcceptableStatus, selectCurrentQuote } from './thread-quotations';

test('isAcceptableStatus: only sent + viewed can be accepted from the thread', () => {
  assert.equal(isAcceptableStatus('sent'), true);
  assert.equal(isAcceptableStatus('viewed'), true);
  assert.equal(isAcceptableStatus('accepted'), false);
  assert.equal(isAcceptableStatus('declined'), false);
  assert.equal(isAcceptableStatus('expired'), false);
  assert.equal(isAcceptableStatus('superseded'), false);
  assert.equal(isAcceptableStatus('draft'), false);
});

test('selectCurrentQuote: empty input pins nothing', () => {
  assert.equal(selectCurrentQuote([]), null);
});

test('selectCurrentQuote: single proposal is the current quote, no older trail', () => {
  const rows = [{ proposal_id: 'a', created_at: '2026-07-01T00:00:00Z' }];
  const out = selectCurrentQuote(rows);
  assert.ok(out);
  assert.equal(out.current.proposal_id, 'a');
  assert.deepEqual(out.older, []);
});

test('selectCurrentQuote: newest by created_at is pinned; older kept newest-first', () => {
  // Deliberately out of order; a superseded older quote must remain in the trail.
  const rows = [
    { proposal_id: 'old', created_at: '2026-07-01T09:00:00Z' },
    { proposal_id: 'new', created_at: '2026-07-03T09:00:00Z' },
    { proposal_id: 'mid', created_at: '2026-07-02T09:00:00Z' },
  ];
  const out = selectCurrentQuote(rows);
  assert.ok(out);
  assert.equal(out.current.proposal_id, 'new');
  assert.deepEqual(
    out.older.map((r) => r.proposal_id),
    ['mid', 'old'],
  );
});

test('selectCurrentQuote: does not mutate the input array', () => {
  const rows = [
    { proposal_id: 'a', created_at: '2026-07-01T00:00:00Z' },
    { proposal_id: 'b', created_at: '2026-07-02T00:00:00Z' },
  ];
  const snapshot = rows.map((r) => r.proposal_id);
  selectCurrentQuote(rows);
  assert.deepEqual(
    rows.map((r) => r.proposal_id),
    snapshot,
  );
});

test('selectCurrentQuote: equal timestamps break ties deterministically by proposal_id', () => {
  const ts = '2026-07-02T00:00:00Z';
  const a = selectCurrentQuote([
    { proposal_id: 'aaa', created_at: ts },
    { proposal_id: 'zzz', created_at: ts },
  ]);
  const b = selectCurrentQuote([
    { proposal_id: 'zzz', created_at: ts },
    { proposal_id: 'aaa', created_at: ts },
  ]);
  assert.ok(a && b);
  // Same pin regardless of input order.
  assert.equal(a.current.proposal_id, 'zzz');
  assert.equal(b.current.proposal_id, 'zzz');
});
