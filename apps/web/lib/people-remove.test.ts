/**
 * people-remove.test.ts — Remove on People can never report success for a
 * removal that did not happen (owner 2026-10-23, "why can't i delete anyone").
 *
 * Three ways it used to: an id list that came out empty (the loop ran zero
 * times → ok), a row with no id (filtered away → ok), and a server UPDATE that
 * matched zero rows (no error → ok). Each is asserted here to come back NOT ok.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  removableConnectionFilter,
  removalWriteResult,
  removeFromPeople,
  type RemoveResult,
} from './people-remove';

const ok = async (): Promise<RemoveResult> => ({ ok: true });

test('🔴 an empty list is refused — nothing to remove is not "removed"', async () => {
  let calls = 0;
  const res = await removeFromPeople([], async () => {
    calls += 1;
    return { ok: true };
  });
  assert.equal(res.ok, false);
  assert.equal(calls, 0);
});

test('🔴 a row with no id is refused BEFORE anything is called — no half removal', async () => {
  const called: string[] = [];
  const res = await removeFromPeople(
    [
      { connectionId: 'c-1', name: 'Ana Reyes' },
      { connectionId: null, name: 'Marco Testing' },
    ],
    async (id) => {
      called.push(id);
      return { ok: true };
    },
  );
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /Marco Testing/);
  assert.deepEqual(called, [], 'nothing may be removed when one row cannot be');
});

test('🔴 a refused removal is the answer, not a success', async () => {
  const res = await removeFromPeople([{ connectionId: 'c-1', name: 'Marco Testing' }], async () => ({
    ok: false,
    error: 'Couldn’t remove them.',
  }));
  assert.deepEqual(res, { ok: false, error: 'Couldn’t remove them.' });
});

test('🔴 a partial bulk removal says how many went, and is not ok', async () => {
  let n = 0;
  const res = await removeFromPeople(
    [
      { connectionId: 'c-1', name: 'Ana' },
      { connectionId: 'c-2', name: 'Bianca' },
      { connectionId: 'c-3', name: 'Marco' },
    ],
    async () => (++n === 3 ? { ok: false, error: 'Nothing changed.' } : { ok: true }),
  );
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /^Removed 2 of 3\. Marco: Nothing changed\.$/);
});

test('every row removed → ok, with the count', async () => {
  const seen: string[] = [];
  const res = await removeFromPeople(
    [
      { connectionId: 'c-1', name: 'Ana' },
      { connectionId: 'c-2', name: 'Bianca' },
    ],
    async (id) => {
      seen.push(id);
      return ok();
    },
  );
  assert.deepEqual(res, { ok: true, removed: 2 });
  assert.deepEqual(seen, ['c-1', 'c-2']);
});

test('🔴 a write that changed ZERO rows is a failure — the success-shaped zero', () => {
  assert.equal(removalWriteResult([], null).ok, false);
  assert.equal(removalWriteResult(null, null).ok, false);
  assert.equal(removalWriteResult(null, { message: 'permission denied' }).ok, false);
  assert.equal(removalWriteResult([{ connection_id: 'c-1' }], { message: 'x' }).ok, false);
  assert.deepEqual(removalWriteResult([{ connection_id: 'c-1' }], null), { ok: true });
});

test('the filter reaches every row I declared, and a confirmed row I was asked into — never a pending one', () => {
  const f = removableConnectionFilter('me-123');
  assert.equal(f, 'from_person_id.eq.me-123,and(to_person_id.eq.me-123,status.eq.confirmed)');
});
